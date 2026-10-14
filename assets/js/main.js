const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const closeMenu = () => {
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', toggle.dataset.open);
  nav.classList.remove('is-open');
};
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? toggle.dataset.close : toggle.dataset.open);
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header-inner')) closeMenu();
  });
  matchMedia('(min-width: 1100px)').addEventListener('change', closeMenu);
}
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

// CSS owns the lightweight SVG motion; this control only pauses or resumes it.
const animationToggle = document.querySelector('.animation-toggle');
if (animationToggle) {
  animationToggle.addEventListener('click', () => {
    const paused = animationToggle.getAttribute('aria-pressed') !== 'true';
    animationToggle.setAttribute('aria-pressed', String(paused));
    animationToggle.textContent = paused ? animationToggle.dataset.resume : animationToggle.dataset.pause;
    animationToggle.closest('.connection-art').classList.toggle('is-paused', paused);
  });
}

// Public Apps Script Web App URL. No secrets belong here.
const KTG_API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwQalWdJy1yKaJIjKD8e17nGBMjNXhinvc-2Z_p4r9W56GkKEJPH4HTHiBNqmfdscZgRQ/exec';
const KTG_RESUME_MAX_BYTES = 5 * 1024 * 1024;
const KTG_PRIVACY_POLICY_VERSION = 'privacy-v1.0-2026-10';
const ktgLanguage = document.documentElement.lang.toLowerCase().startsWith('ko') ? 'KR' : 'EN';
const submissionMessages = {
  KR: {
    submitting: '제출 중입니다. 잠시 기다려주세요.',
    failure: '전송 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    talent: '프로필이 정상적으로 등록되었습니다. 검토 후 필요한 경우 연락드리겠습니다.',
    company: '채용 문의가 정상적으로 접수되었습니다. 검토 후 연락드리겠습니다.'
  },
  EN: {
    submitting: 'Submitting your information. Please wait.',
    failure: 'We could not submit your information. Please try again shortly.',
    talent: 'Your profile has been submitted successfully. We will contact you if further information or a suitable opportunity is identified.',
    company: 'Your hiring inquiry has been submitted successfully. We will contact you after reviewing the details.'
  }
};
const resumeAsBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const result = reader.result;
    const separator = typeof result === 'string' ? result.indexOf(';base64,') : -1;
    if (separator < 0) reject(new Error('Resume conversion failed'));
    else resolve(result.slice(separator + 8));
  });
  reader.addEventListener('error', () => reject(new Error('Resume conversion failed')));
  reader.addEventListener('abort', () => reject(new Error('Resume conversion aborted')));
  reader.readAsDataURL(file);
});

const buildSubmissionPayload = async (form, fields, type) => {
  const payload = new URLSearchParams();
  fields.forEach(field => {
    if (!field.name || field.type === 'file') return;
    if (field.type === 'radio') {
      if (field.checked) payload.set(field.name, field.value);
    } else if (field.type === 'checkbox') {
      payload.set(field.name, field.checked ? 'yes' : 'no');
    } else payload.set(field.name, field.value);
  });
  const consentTime = new Date().toISOString();
  payload.set('privacy_consent_at', payload.get('privacy_consent') === 'yes' ? consentTime : '');
  payload.set('privacy_policy_version', KTG_PRIVACY_POLICY_VERSION);
  if (type === 'talent') {
    payload.set('opportunity_review_consent_at', payload.get('opportunity_review_consent') === 'yes' ? consentTime : '');
  }
  payload.set('submission_type', type);
  payload.set('registration_language', ktgLanguage);
  payload.set('website_confirm', form.elements.namedItem('website_confirm').value);
  payload.set('form_started_at', form.elements.namedItem('form_started_at').value);
  if (type === 'talent') {
    const file = form.elements.namedItem('resume').files[0];
    payload.set('resume_name', file ? file.name : '');
    payload.set('resume_type', '');
    payload.set('resume_base64', '');
    if (file) {
      const extension = file.name.split('.').pop().toLowerCase();
      const types = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
      if (!types[extension] || file.size > KTG_RESUME_MAX_BYTES) throw new Error('Invalid resume');
      payload.set('resume_type', types[extension]);
      payload.set('resume_base64', await resumeAsBase64(file));
    }
  }
  return payload;
};

// The Web App reads e.parameter and returns JSON { ok: true, id, message } after saving.
// Form encoding is a CORS simple request; follow Apps Script's ContentService redirect.
const postSubmission = async payload => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(KTG_API_ENDPOINT, {
      method: 'POST', body: payload, mode: 'cors', redirect: 'follow',
      credentials: 'omit', signal: controller.signal
    });
    if (!response.ok) throw new Error('Submission failed');
    const data = await response.json();
    if (!data || data.ok !== true) throw new Error('Submission failed');
  } finally {
    clearTimeout(timeout);
  }
};

const initializeSubmission = ({ form, button, status, fields, validate, type, afterReset }) => {
  let submitting = false;
  const messages = submissionMessages[ktgLanguage];
  const startedAt = form.elements.namedItem('form_started_at');
  const refreshStartTime = () => { startedAt.value = String(Date.now()); };
  refreshStartTime();
  const clearStatus = () => {
    if (submitting) return;
    status.textContent = '';
    status.className = 'profile-status';
  };
  const submit = async event => {
    event.preventDefault();
    if (submitting) return;
    if (form.elements.namedItem('website_confirm').value.trim()) {
      status.textContent = messages.failure;
      status.className = 'profile-status is-error';
      return;
    }
    const invalid = fields.filter(field => !validate(field));
    if (invalid.length) {
      status.textContent = form.dataset.errorSummary;
      status.className = 'profile-status is-error';
      invalid[0].focus();
      return;
    }
    submitting = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = messages.submitting;
    status.className = 'profile-status is-notice';
    try {
      // Validate the public endpoint; configuration errors use the same safe UI message.
      const endpoint = new URL(KTG_API_ENDPOINT);
      if (endpoint.protocol !== 'https:' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname) || endpoint.hostname !== 'script.google.com') {
        throw new Error('Endpoint not configured');
      }
      const payload = await buildSubmissionPayload(form, fields, type);
      await postSubmission(payload);
      form.reset();
      form.elements.namedItem('website_confirm').value = '';
      refreshStartTime();
      fields.forEach(field => field.removeAttribute('aria-invalid'));
      form.querySelectorAll('.field-error').forEach(error => { error.textContent = ''; error.hidden = true; });
      afterReset?.();
      status.textContent = messages[type];
      status.className = 'profile-status is-notice';
    } catch {
      // Do not show backend responses, input values or file contents in errors or logs.
      status.textContent = messages.failure;
      status.className = 'profile-status is-error';
    } finally {
      submitting = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  };
  form.addEventListener('submit', submit);
  // Remain disabled without JS so the browser cannot navigate with personal data in a URL.
  button.disabled = false;
  return { clearStatus };
};

// Preserve profile validation and the conditional visa field.
const profileForm = document.querySelector('#talent-registration');
if (profileForm) {
  const submitButton = profileForm.querySelector('[data-profile-submit]');
  const status = profileForm.querySelector('#profile-status');
  const fields = [...profileForm.querySelectorAll('input, select, textarea')]
    .filter(field => field.type !== 'hidden' && field.name !== 'website_confirm');
  const visa = profileForm.querySelector('#profile-5');
  const errorFor = field => document.getElementById(
    field.type === 'radio' ? 'korea-status-error' : `${field.id}-error`
  );
  const validate = field => {
    let message = '';
    if (field.type === 'file' && field.files.length) {
      const file = field.files[0];
      if (!/\.(pdf|doc|docx)$/i.test(file.name) || file.size > KTG_RESUME_MAX_BYTES) {
        message = profileForm.dataset.fileError;
      }
    } else if (!field.validity.valid || (field.required && field.type === 'text' && !field.value.trim())) {
      message = field.validity.typeMismatch ? profileForm.dataset.emailError : profileForm.dataset.requiredError;
    }
    field.setAttribute('aria-invalid', String(Boolean(message)));
    const error = errorFor(field);
    error.textContent = message;
    error.hidden = !message;
    return !message;
  };
  const updateVisa = () => {
    const outsideKorea = profileForm.querySelector('#korea-no').checked;
    visa.readOnly = outsideKorea;
    visa.required = !outsideKorea;
    // Only clear an automatic placeholder when returning to the Korea option.
    if (outsideKorea) visa.value = visa.dataset.notApplicable;
    else if (visa.value === visa.dataset.notApplicable) visa.value = '';
    visa.closest('.form-field').querySelector('.field-meta').textContent =
      profileForm.querySelector(outsideKorea ? '#profile-12' : '#profile-1')
        .closest('.form-field').querySelector('.field-meta').textContent;
    visa.setAttribute('aria-invalid', 'false');
    errorFor(visa).hidden = true;
  };
  fields.forEach(field => {
    field.addEventListener('blur', () => {
      if (field.value || field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('input', () => {
      submission.clearStatus();
      if (field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('change', () => {
      submission.clearStatus();
      if (field.type === 'radio') {
        updateVisa();
        profileForm.querySelectorAll('[name="in_korea"]').forEach(validate);
      } else validate(field);
    });
  });
  const submission = initializeSubmission({
    form: profileForm, button: submitButton, status, fields, validate,
    type: 'talent', afterReset: updateVisa
  });
}

// Preserve company validation; shared submission code handles transient payloads.
const hiringForm = document.querySelector('#company-registration');
if (hiringForm) {
  const submitButton = hiringForm.querySelector('[data-hiring-submit]');
  const status = hiringForm.querySelector('#hiring-status');
  const fields = [...hiringForm.querySelectorAll('input, select, textarea')]
    .filter(field => field.type !== 'hidden' && field.name !== 'website_confirm');
  const validate = field => {
    let message = '';
    if (field.type === 'number' && !field.validity.valid) {
      message = field.validity.valueMissing ? hiringForm.dataset.requiredError : hiringForm.dataset.numberError;
    } else if (field.type === 'url' && field.value &&
      (!field.validity.valid || !/^https?:\/\//i.test(field.value))) {
      message = hiringForm.dataset.urlError;
    } else if (!field.validity.valid ||
      (field.required && ['text', 'tel'].includes(field.type) && !field.value.trim())) {
      message = field.validity.typeMismatch ? hiringForm.dataset.emailError : hiringForm.dataset.requiredError;
    }
    field.setAttribute('aria-invalid', String(Boolean(message)));
    const error = document.getElementById(
      field.type === 'radio' ? 'hiring-experience-error' : `${field.id}-error`
    );
    error.textContent = message;
    error.hidden = !message;
    return !message;
  };
  fields.forEach(field => {
    field.addEventListener('blur', () => {
      if (field.value || field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('input', () => {
      submission.clearStatus();
      if (field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('change', () => {
      submission.clearStatus();
      if (field.type === 'radio') hiringForm.querySelectorAll('[name="foreign_hiring_experience"]').forEach(validate);
      else validate(field);
    });
  });
  const submission = initializeSubmission({
    form: hiringForm, button: submitButton, status, fields, validate, type: 'company'
  });
}
