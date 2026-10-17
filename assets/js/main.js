// One locale-independent taxonomy for fields, previews and future matching.
// Keep static HTML fallbacks readable when JavaScript is unavailable.
const KTG_JOB_FIELDS = Object.freeze([
  { code: 'it_digital', KR: 'IT·디지털', EN: 'IT & Digital', VI: 'CNTT & kỹ thuật số' },
  { code: 'engineering_tech', KR: '엔지니어링·기술', EN: 'Engineering & Technology', VI: 'Kỹ thuật & công nghệ' },
  { code: 'manufacturing_skilled', KR: '제조·기능·숙련', EN: 'Manufacturing & Skilled Trades', VI: 'Sản xuất & lao động lành nghề' },
  { code: 'business_trade_office', KR: '비즈니스·무역·사무', EN: 'Business, Trade & Administration', VI: 'Kinh doanh, thương mại & hành chính' },
  { code: 'service_tourism_culinary', KR: '서비스·관광·조리', EN: 'Services, Tourism & Culinary', VI: 'Dịch vụ, du lịch & ẩm thực' },
  { code: 'content_art_sports', KR: '콘텐츠·예술·스포츠', EN: 'Content, Arts & Sports', VI: 'Nội dung, nghệ thuật & thể thao' }
].map(Object.freeze));
const KTG_FIELD_COPY = {
  KR: { other: '기타 분야', legacy: '기존 분류 — 확인 필요', choose: '선택해주세요', prepare: '이 분야로 프로필 준비하기', talent: '내 프로필 등록하기', company: '채용 문의하기' },
  EN: { other: 'Other fields', legacy: 'Previous field — review needed', choose: 'Select an option', prepare: 'Prepare my profile in this field', talent: 'Create My Profile', company: 'Share Your Hiring Needs' },
  VI: { other: 'Lĩnh vực khác', legacy: 'Phân loại cũ — cần xem xét', choose: 'Vui lòng chọn', prepare: 'Chuẩn bị hồ sơ theo lĩnh vực này', talent: 'Tạo hồ sơ của tôi', company: 'Gửi nhu cầu tuyển dụng' }
};
const normalizeJobCategory = value => {
  const original = typeof value === 'string' ? value : '';
  const key = original.trim().toLowerCase();
  const field = KTG_JOB_FIELDS.find(item => [item.code, item.KR.toLowerCase(), item.EN.toLowerCase(), item.VI.toLowerCase()].includes(key));
  if (field) return { job_category: field.code, job_category_legacy: '' };
  if (key === 'other') return { job_category: 'other', job_category_legacy: '' };
  const aliases = {
    'it·소프트웨어': 'it_digital', 'it & software': 'it_digital',
    '엔지니어링': 'engineering_tech', 'engineering': 'engineering_tech',
    '해외영업·무역': 'business_trade_office', 'global sales & trade': 'business_trade_office'
  };
  if (Object.hasOwn(aliases, key)) return { job_category: aliases[key], job_category_legacy: original };
  // Technical / other professional fields have no unambiguous new equivalent.
  return { job_category: original ? 'legacy' : '', job_category_legacy: original };
};
window.KTGTaxonomy = Object.freeze({ fields: KTG_JOB_FIELDS, normalize: normalizeJobCategory });
const ktgLocale = ({ ko: 'KR', en: 'EN', vi: 'VI' })[document.documentElement.lang.toLowerCase().split('-')[0]] || 'EN';
const fieldCopy = KTG_FIELD_COPY[ktgLocale];
const categoryLabel = code => KTG_JOB_FIELDS.find(field => field.code === code)?.[ktgLocale] || fieldCopy[code] || '';

document.querySelectorAll('[data-job-category]').forEach(element => {
  const label = categoryLabel(element.dataset.jobCategory);
  if (label) element.textContent = label;
});
document.querySelectorAll('[data-job-categories]').forEach(list => {
  list.replaceChildren(...KTG_JOB_FIELDS.map(field => {
    const item = document.createElement('li');
    item.textContent = field[ktgLocale];
    return item;
  }));
});
document.querySelectorAll('select[name="job_category"]').forEach(select => {
  select.replaceChildren(...[
    ['', fieldCopy.choose], ...KTG_JOB_FIELDS.map(field => [field.code, field[ktgLocale]]), ['other', fieldCopy.other]
  ].map(([value, label]) => new Option(label, value)));
  const form = select.form;
  const raw = new URLSearchParams(location.search).get('job_category');
  const normalized = normalizeJobCategory(raw);
  if (normalized.job_category === 'legacy') select.add(new Option(fieldCopy.legacy, 'legacy'));
  select.value = normalized.job_category;
  select.dataset.legacy = normalized.job_category_legacy;
  const preview = document.querySelector('[data-category-preview]');
  const updatePreview = () => {
    if (preview) preview.textContent = select.value ? categoryLabel(select.value) : KTG_JOB_FIELDS.slice(0, 2).map(field => field[ktgLocale]).join(' · ');
  };
  select.addEventListener('change', () => { select.dataset.legacy = ''; updatePreview(); });
  form.addEventListener('reset', () => { select.dataset.legacy = ''; queueMicrotask(updatePreview); });
  updatePreview();
});

// Preserve only campaign attribution and category selection in URLs, never form data.
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign'];
const currentQuery = new URLSearchParams(location.search);
const safeCampaignValue = value => value && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';
const campaign = new URLSearchParams();
campaignKeys.forEach(key => {
  const value = safeCampaignValue(currentQuery.get(key));
  if (value) campaign.set(key, value);
});
document.querySelectorAll('a[href]').forEach(link => {
  const target = new URL(link.getAttribute('href'), location.href);
  if (target.origin !== location.origin || !['http:', 'https:'].includes(target.protocol)) return;
  let changed = false;
  campaign.forEach((value, key) => {
    if (!target.searchParams.has(key)) { target.searchParams.set(key, value); changed = true; }
  });
  if (link.closest('.languages') && currentQuery.has('job_category')) {
    const category = normalizeJobCategory(currentQuery.get('job_category'));
    if (KTG_JOB_FIELDS.some(field => field.code === category.job_category)) {
      target.searchParams.set('job_category', category.job_category); changed = true;
    }
  }
  if (changed) {
    // Preserve relative paths so both custom-domain and project-path hosting work.
    const original = link.getAttribute('href').split(/[?#]/)[0];
    link.setAttribute('href', `${original}?${target.searchParams}${target.hash}`);
  }
});
// Same action, same wording. Navigation and informational guide links stay distinct.
document.querySelectorAll('a.button').forEach(link => {
  const target = new URL(link.href, location.href);
  const type = /\/talent\/$/.test(target.pathname) || target.hash === '#talent-registration' ? 'talent'
    : /\/companies\/$/.test(target.pathname) || target.hash === '#company-registration' ? 'company' : '';
  if (!type) return;
  const text = [...link.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (text) text.textContent = `${fieldCopy[type]} `;
});

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

// Pause offscreen without JavaScript animation or overriding the manual pause state.
const connectionArt = document.querySelector('.connection-art');
if (connectionArt && 'IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    connectionArt.classList.toggle('is-offscreen', !entries[0].isIntersecting);
  }, { threshold: 0 }).observe(connectionArt);
}

// Public Apps Script Web App URL. No secrets belong here.
const KTG_API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwQalWdJy1yKaJIjKD8e17nGBMjNXhinvc-2Z_p4r9W56GkKEJPH4HTHiBNqmfdscZgRQ/exec';
const KTG_RESUME_MAX_BYTES = 5 * 1024 * 1024;
const KTG_PRIVACY_POLICY_VERSION = 'privacy-v1.0-2026-10';
const ktgLanguage = ktgLocale;
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
  },
  VI: {
    submitting: 'Đang gửi thông tin. Vui lòng chờ.',
    failure: 'Không thể gửi thông tin. Vui lòng thử lại sau ít phút.',
    talent: 'Hồ sơ của bạn đã được gửi thành công. Chúng tôi sẽ liên hệ nếu cần thêm thông tin hoặc xác định được cơ hội phù hợp.',
    company: 'Nhu cầu tuyển dụng đã được gửi thành công. Chúng tôi sẽ liên hệ sau khi xem xét thông tin.'
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

// Normalize only exact, known country names or ISO alpha-2 codes. Free text stays intact.
const countryCodeFor = value => {
  const original = value.trim();
  if (!original || typeof Intl.DisplayNames !== 'function') return '';
  const displays = (ktgLocale === 'VI' ? ['vi', 'en', 'ko'] : ['en', 'ko']).map(locale => new Intl.DisplayNames([locale], { type: 'region' }));
  const regions = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const key = original.toLowerCase();
  return regions.find(code => code.toLowerCase() === key || displays.some(display => display.of(code).toLowerCase() === key)) || '';
};

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
  const categorySelect = form.elements.namedItem('job_category');
  payload.set('job_category', categorySelect.value);
  payload.set('job_category_legacy', categorySelect.dataset.legacy || '');
  payload.set('job_taxonomy_version', 'ktg-fields-v1');
  campaign.forEach((value, key) => payload.set(key, value));
  const consentTime = new Date().toISOString();
  payload.set('privacy_consent_at', payload.get('privacy_consent') === 'yes' ? consentTime : '');
  payload.set('privacy_policy_version', KTG_PRIVACY_POLICY_VERSION);
  if (type === 'talent') {
    // Existing human-entered values remain available to the current backend.
    payload.set('nationality_code', countryCodeFor(payload.get('nationality') || ''));
    payload.set('residence_country_code', countryCodeFor(payload.get('residence_country') || ''));
    const visa = (payload.get('visa_status') || '').trim().toUpperCase();
    payload.set('visa_status_code', payload.get('in_korea') === 'no' ? 'not_applicable'
      : /^[A-Z]-[0-9]{1,2}(?:-[0-9]+)?$/.test(visa) ? visa.toLowerCase() : 'legacy');
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
