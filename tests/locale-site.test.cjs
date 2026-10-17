// Uses the existing Playwright installation; no live submissions or new dependencies.
// Start a local server first, then set KTG_BASE_URL (and NODE_PATH if needed).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = (process.env.KTG_BASE_URL || 'http://127.0.0.1:8034/korea-talent-gate/').replace(/\/?$/, '/');
const locales = ['kr', 'en', 'vi'];
const widths = [1920, 1440, 1280, 1100, 1024, 768, 375];
const routes = fs.readdirSync(path.join(root, 'en'), { recursive: true }).filter(f => f.endsWith('index.html')).map(f => f.replaceAll(path.sep, '/').replace(/index\.html$/, ''));
const codes = ['it_digital', 'engineering_tech', 'manufacturing_skilled', 'business_trade_office', 'service_tourism_culinary', 'content_art_sports'];
const viLabels = ['CNTT & kỹ thuật số', 'Kỹ thuật & công nghệ', 'Sản xuất & lao động lành nghề', 'Kinh doanh, thương mại & hành chính', 'Dịch vụ, du lịch & ẩm thực', 'Nội dung, nghệ thuật & thể thao'];
let scenarios = 0;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.KTG_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const locale of locales) for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 1080 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://script.google.com/**', route => route.abort());
      for (const route of routes) {
        await page.goto(`${base}${locale}/${route}`);
        assert.equal(await page.locator('html').getAttribute('lang'), locale === 'kr' ? 'ko' : locale);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${locale}/${route} @${width}`);
        assert.equal(errors.length, 0, errors.join('\n'));
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), `https://koreatalentgate.com/${locale}/${route}`);
        for (const [language, lang] of [['kr', 'ko'], ['en', 'en'], ['vi', 'vi']]) {
          assert.equal(await page.locator(`link[rel=alternate][hreflang=${lang}]`).getAttribute('href'), `https://koreatalentgate.com/${language}/${route}`);
          const links = await page.locator(`.languages a[lang=${lang}]`).evaluateAll(es => es.map(e => ({ href: e.href, active: e.getAttribute('aria-current') })));
          assert.equal(links.length, 2);
          links.forEach(link => {
            assert.equal(link.href, `${base}${language}/${route}`);
            assert.equal(link.active, language === locale ? 'page' : null);
          });
        }
        assert.equal(await page.locator('.languages [aria-disabled=true]').count(), 0);
        if (width === 375) {
          await page.locator('.menu-toggle').click();
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        }
        if (!route) {
          assert.equal(await page.locator('.role').count(), 6);
          assert.equal(await page.locator('.role-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), width >= 1100 ? 3 : width > 700 ? 2 : 1);
          const heights = await page.locator('.role').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
          assert.ok(Math.max(...heights) - Math.min(...heights) < 1);
          if (locale === 'vi') assert.deepEqual(await page.locator('.role h3').allTextContents(), viLabels);
          if (width === 375) assert.equal(await page.locator('.profile-traveler').evaluate(e => getComputedStyle(e).animationName), 'none');
        }
        if (route === 'talent/' || route === 'companies/') {
          const field = page.locator('[name=job_category]');
          await field.scrollIntoViewIfNeeded();
          assert.ok(await field.isVisible());
          assert.ok((await field.boundingBox()).height >= 46);
          await field.focus();
          assert.notEqual(await field.evaluate(e => getComputedStyle(e).outlineStyle), 'none');
        }
        scenarios++;
      }
      await page.close();
      console.log(`PASS ${locale.toUpperCase()} ${width}px: 11 pages`);
    }
    // Runtime form field/value/required contracts match across all three locales.
    for (const type of ['talent', 'companies']) {
      const shapes = [];
      for (const locale of locales) {
        const page = await browser.newPage();
        await page.goto(`${base}${locale}/${type}/`);
        shapes.push(await page.locator('form input,form select,form textarea').evaluateAll(es => es.map(e => ({ id: e.id, name: e.name, type: e.type, required: e.required, value: ['radio', 'checkbox'].includes(e.type) ? e.value : '', options: e.tagName === 'SELECT' ? [...e.options].map(o => o.value) : null, accept: e.accept || '', min: e.min || '', max: e.max || '', maxLength: e.maxLength }))));
        await page.close();
      }
      assert.deepEqual(shapes[0], shapes[1]); assert.deepEqual(shapes[1], shapes[2]);
    }
    for (const locale of locales) for (const type of ['talent', 'companies']) {
      const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
      const requests = [];
      let responseOk = false;
      await page.route('https://script.google.com/**', async route => {
        requests.push(new URLSearchParams(route.request().postData()));
        await new Promise(resolve => setTimeout(resolve, 180));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: responseOk, id: 'LOCAL_MOCK_ONLY' }) });
      });
      await page.goto(`${base}${locale}/${type}/?job_category=it_digital&utm_source=local_qa&utm_medium=mock&utm_campaign=vi_rebuild`);
      assert.equal(await page.locator('[name=job_category]').inputValue(), 'it_digital');
      const options = await page.locator('[name=job_category] option').evaluateAll(es => es.map(e => ({ code: e.value, label: e.textContent })));
      assert.deepEqual(options.slice(1).map(o => o.code), [...codes, 'other']);
      if (locale === 'vi') assert.deepEqual(options.slice(1, 7).map(o => o.label), viLabels);
      await page.locator('button[type=submit]').click();
      assert.equal(requests.length, 0);
      assert.equal(await page.locator('[name=privacy_consent]').getAttribute('aria-invalid'), 'true');
      if (locale === 'vi') assert.match(await page.locator('.profile-status').innerText(), /Vui lòng/);
      await page.locator('[name=email]').fill('not-an-email'); await page.locator('[name=email]').blur();
      assert.equal(await page.locator('[name=email]').getAttribute('aria-invalid'), 'true');
      if (locale === 'vi') assert.match(await page.locator('[name=email]').evaluate(e => document.getElementById(e.id + '-error').textContent), /email hợp lệ/);
      if (type === 'talent') {
        for (const fixture of [{ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('local fixture') }, { name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }]) {
          await page.locator('[name=resume]').setInputFiles(fixture); await page.locator('[name=resume]').dispatchEvent('change');
          assert.equal(await page.locator('[name=resume]').getAttribute('aria-invalid'), 'true');
        }
        if (locale === 'vi') assert.match(await page.locator('#profile-16-error').innerText(), /5 MB/);
      }
      await page.evaluate(() => {
        for (const field of document.querySelectorAll('form input,form select,form textarea')) {
          if (field.name === 'website_confirm' || ['hidden', 'file'].includes(field.type)) continue;
          if (field.type === 'radio') { field.checked = field.value === 'no'; continue; }
          if (field.type === 'checkbox') { field.checked = field.required; continue; }
          if (field.tagName === 'SELECT') { field.value = field.name === 'job_category' ? 'it_digital' : field.querySelector('option[value]:not([value=""])').value; continue; }
          field.value = field.type === 'email' ? 'local-qa@example.invalid' : field.type === 'url' ? 'https://example.invalid' : field.type === 'number' ? '2' : 'QA_LOCAL — nguyên văn / original';
        }
        document.querySelector('input[type=radio][value=no]').dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (type === 'talent') {
        await page.locator('[name=resume]').setInputFiles({ name: 'local-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('local fixture only') });
        assert.equal(await page.locator('[name=visa_status]').getAttribute('readonly'), '');
        if (locale === 'vi') assert.equal(await page.locator('[name=visa_status]').inputValue(), 'Không áp dụng');
        assert.equal(await page.locator('[name=opportunity_review_consent]').getAttribute('required'), null);
      }
      const honey = page.locator('[name=website_confirm]');
      assert.equal(await honey.getAttribute('tabindex'), '-1'); assert.equal(await honey.getAttribute('aria-hidden'), 'true');
      assert.equal(await honey.evaluate(e => getComputedStyle(e).clip), 'rect(0px, 0px, 0px, 0px)');
      const startedAt = await page.locator('[name=form_started_at]').inputValue();
      await page.locator('button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      assert.equal(requests.length, 1);
      assert.equal(await page.locator('[name=form_started_at]').inputValue(), startedAt);
      assert.equal(await page.locator('[name=job_category]').inputValue(), 'it_digital');
      if (locale === 'vi') assert.match(await page.locator('.profile-status').innerText(), /Không thể gửi thông tin/);
      const payload = requests[0];
      assert.equal(payload.get('registration_language'), locale.toUpperCase());
      assert.equal(payload.get('submission_type'), type === 'talent' ? 'talent' : 'company');
      assert.equal(payload.get('job_category'), 'it_digital'); assert.equal(payload.get('job_taxonomy_version'), 'ktg-fields-v1');
      assert.equal(payload.get('utm_source'), 'local_qa'); assert.equal(payload.get('utm_medium'), 'mock'); assert.equal(payload.get('utm_campaign'), 'vi_rebuild');
      assert.equal(payload.get('privacy_consent'), 'yes'); assert.ok(payload.get('privacy_consent_at'));
      assert.equal(payload.get('privacy_policy_version'), 'privacy-v1.0-2026-10');
      assert.match(payload.get(type === 'talent' ? 'desired_role' : 'hiring_role'), /nguyên văn/);
      if (type === 'talent') {
        assert.equal(payload.get('opportunity_review_consent'), 'no'); assert.equal(payload.get('opportunity_review_consent_at'), '');
        assert.equal(payload.get('resume_base64'), Buffer.from('local fixture only').toString('base64'));
        assert.equal(payload.get('resume_type'), 'application/pdf'); assert.equal(payload.get('resume_name'), 'local-qa.pdf');
        assert.equal(payload.get('visa_status_code'), 'not_applicable'); await page.locator('[name=opportunity_review_consent]').check();
      }
      responseOk = true;
      await page.locator('button[type=submit]').click();
      await page.evaluate(() => document.querySelector('form').requestSubmit());
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      assert.equal(requests.length, 2);
      assert.notEqual(await page.locator('[name=form_started_at]').inputValue(), startedAt);
      assert.equal(await honey.inputValue(), ''); assert.equal(await page.locator('[name=job_category]').inputValue(), '');
      if (type === 'talent') assert.ok(requests[1].get('opportunity_review_consent_at'));
      if (locale === 'vi') assert.match(await page.locator('.profile-status').innerText(), /thành công/);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      scenarios++; await page.close(); console.log(`PASS ${locale.toUpperCase()} ${type}: mocked failure/success and payload`);
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}kr/?utm_source=qa&utm_medium=local&utm_campaign=language_switch`);
    await page.locator('.role-prepare').first().click();
    for (const locale of ['vi', 'en', 'kr']) {
      await page.locator(`.header-inner .languages a[lang=${locale === 'kr' ? 'ko' : locale}]`).click();
      assert.match(page.url(), new RegExp(`/${locale}/talent/`)); assert.match(page.url(), /utm_campaign=language_switch/);
      assert.equal(await page.locator('[name=job_category]').inputValue(), 'it_digital');
    }
    await page.goto(`${base}vi/`);
    assert.equal(await page.evaluate(() => countryCodeFor('Việt Nam')), 'VN');
    assert.equal(await page.evaluate(() => KTGTaxonomy.normalize('Kỹ thuật & công nghệ').job_category), 'engineering_tech');
    await page.locator('.animation-toggle').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.animation-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.animation-toggle').innerText(), 'Tiếp tục chuyển động');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.profile-traveler').evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.close();
    const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
    for (const type of ['talent', 'companies']) {
      await noJs.goto(`${base}vi/${type}/`);
      assert.match(await noJs.locator('noscript').innerText(), /Vui lòng bật JavaScript/);
      assert.equal(await noJs.locator('button[type=submit]').isDisabled(), true);
      assert.equal(await noJs.locator('[name=job_category] option[value=it_digital]').innerText(), viLabels[0]);
    }
    await noJs.close();
    console.log(`PASS: ${scenarios} responsive/form scenarios; 231 page/viewport checks + six mocked submission cycles; UTM, language switching, taxonomy, consent, resume, validation, success/failure, reduced-motion, no-JS. No live submissions.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
