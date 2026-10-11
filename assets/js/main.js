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
