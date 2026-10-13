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

// Keep future destinations explicit without creating unfinished detail pages.
const availabilityDialog = document.querySelector('.availability-dialog');
if (availabilityDialog) {
  let dialogTrigger;
  document.querySelectorAll('[data-coming-soon]').forEach(button => {
    button.addEventListener('click', () => {
      dialogTrigger = button;
      availabilityDialog.querySelector('h2').textContent = button.dataset.comingSoon;
      availabilityDialog.showModal();
    });
  });
  availabilityDialog.addEventListener('close', () => dialogTrigger?.focus());
}

// UI-only profile validation. Never send data, read resume contents, or persist fields.
const profileForm = document.querySelector('#talent-registration');
if (profileForm) {
  const submitPreview = profileForm.querySelector('[data-profile-submit]');
  const status = profileForm.querySelector('#profile-status');
  const fields = [...profileForm.querySelectorAll('input, select, textarea')];
  const visa = profileForm.querySelector('#profile-5');
  const errorFor = field => document.getElementById(
    field.type === 'radio' ? 'korea-status-error' : `${field.id}-error`
  );
  const validate = field => {
    let message = '';
    if (field.type === 'file' && field.files.length) {
      const file = field.files[0];
      if (!/\.(pdf|doc|docx)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
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
      status.textContent = '';
      status.className = 'profile-status';
      if (field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('change', () => {
      if (field.type === 'radio') {
        updateVisa();
        profileForm.querySelectorAll('[name="in_korea"]').forEach(validate);
      } else validate(field);
    });
  });
  const showPreviewResult = event => {
    event.preventDefault();
    const invalid = fields.filter(field => !validate(field));
    status.textContent = invalid.length ? profileForm.dataset.errorSummary : profileForm.dataset.inactive;
    status.className = `profile-status ${invalid.length ? 'is-error' : 'is-notice'}`;
    if (invalid.length) invalid[0].focus();
  };
  profileForm.addEventListener('submit', showPreviewResult);
  submitPreview.addEventListener('click', showPreviewResult);
  // No active submit control is exposed until the UI-only handler is installed.
  submitPreview.disabled = false;
}

// UI-only company request validation: no backend, analytics, or persistence.
const hiringForm = document.querySelector('#company-registration');
if (hiringForm) {
  const submitPreview = hiringForm.querySelector('[data-hiring-submit]');
  const status = hiringForm.querySelector('#hiring-status');
  const fields = [...hiringForm.querySelectorAll('input, select, textarea')];
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
  const clearStatus = () => {
    status.textContent = '';
    status.className = 'profile-status';
  };
  fields.forEach(field => {
    field.addEventListener('blur', () => {
      if (field.value || field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('input', () => {
      clearStatus();
      if (field.getAttribute('aria-invalid') === 'true') validate(field);
    });
    field.addEventListener('change', () => {
      clearStatus();
      if (field.type === 'radio') hiringForm.querySelectorAll('[name="foreign_hiring_experience"]').forEach(validate);
      else validate(field);
    });
  });
  const showPreviewResult = event => {
    event.preventDefault();
    const invalid = fields.filter(field => !validate(field));
    status.textContent = invalid.length ? hiringForm.dataset.errorSummary : hiringForm.dataset.inactive;
    status.className = `profile-status ${invalid.length ? 'is-error' : 'is-notice'}`;
    if (invalid.length) invalid[0].focus();
  };
  hiringForm.addEventListener('submit', showPreviewResult);
  submitPreview.addEventListener('click', showPreviewResult);
  submitPreview.disabled = false;
}
