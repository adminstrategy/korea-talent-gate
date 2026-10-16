const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
let locked = true;
let flushes = 0;
const context = vm.createContext({
  LockService: { getScriptLock: () => ({ hasLock: () => locked }) },
  SpreadsheetApp: {
    newRichTextValue: () => ({ setText(text) { this.text = text; return this; }, build() { return { literalText: this.text }; } }),
    flush: () => { flushes++; }
  }
});
vm.runInContext(fs.readFileSync(path.join(root, 'backend/apps-script/SubmissionExtras.gs'), 'utf8'), context);
const writeExtras = (...args) => context.ktgWriteSubmissionExtras_(...args, { hasLock: () => locked });
class Sheet {
  constructor(rows, maxColumns = rows[0].length) { this.rows = structuredClone(rows); this.max = maxColumns; this.writes = []; }
  getLastColumn() { return Math.max(...this.rows.map(row => row.length)); }
  getLastRow() { return this.rows.length; }
  getMaxColumns() { return this.max; }
  insertColumnsAfter(after, count) { assert.equal(after, this.max); this.max += count; }
  getRange(row, column, height, width) {
    assert.equal(height, 1);
    const write = (values, kind) => {
      assert.equal(values[0].length, width);
      this.writes.push({ row, column, width, kind });
      for (let i = 0; i < width; i++) this.rows[row - 1][column - 1 + i] = kind === 'rich' ? values[0][i].literalText : values[0][i];
    };
    return {
      getValues: () => [Array.from({ length: width }, (_, i) => this.rows[row - 1]?.[column - 1 + i] ?? '')],
      setValues: values => write(values, 'values'),
      setRichTextValues: values => write(values, 'rich')
    };
  }
  value(row, name) { return this.rows[row - 1][this.rows[0].indexOf(name)] ?? ''; }
}
let cases = 0;
function test(name, run) { run(); cases++; console.log('PASS ' + name); }
const coreHeaders = ['id', 'registration_language', 'desired_role', 'hiring_role', 'privacy_consent_at', 'privacy_policy_version', 'opportunity_review_consent_at', 'resume_name', 'resume_type', 'resume_file_id', 'resume_link'];
function savedSheet(language = 'KR') {
  return new Sheet([coreHeaders, ['OLD-ID', 'EN', 'old role', '', 'old consent', 'old version', '', 'old.pdf', 'application/pdf', 'OLD_FILE', 'PRIVATE_OLD'], ['TEST-ID', language, '백엔드 개발자 — original', 'Electrical Engineer', '2026-10-16T00:00:00.000Z', 'privacy-v1.0-2026-10', '', 'qa.pdf', 'application/pdf', 'PRIVATE_FILE_ID', 'PRIVATE_LINK']]);
}
for (const language of ['KR', 'EN']) for (const type of ['talent', 'company']) {
  test(`${language} ${type}: new columns preserve core values and historical rows`, () => {
    const sheet = savedSheet(language), before = structuredClone(sheet.rows);
    writeExtras(sheet, 3, { job_category: 'it_digital', utm_source: 'qa', utm_medium: 'manual', utm_campaign: 'launch', job_taxonomy_version: 'ktg-fields-v1', nationality_code: 'VN', residence_country_code: 'VN', visa_status_code: 'not_applicable' }, type);
    assert.deepEqual(sheet.rows[0].slice(0, coreHeaders.length), coreHeaders);
    assert.deepEqual(sheet.rows[1], before[1]);
    assert.deepEqual(sheet.rows[2].slice(0, coreHeaders.length), before[2]);
    assert.deepEqual(sheet.rows[0].slice(coreHeaders.length, coreHeaders.length + 4), ['job_category', 'utm_source', 'utm_medium', 'utm_campaign']);
    assert.equal(sheet.value(3, 'job_category'), 'it_digital');
    for (const [name, value] of Object.entries({ utm_source: 'qa', utm_medium: 'manual', utm_campaign: 'launch' })) assert.equal(sheet.value(3, name), value);
    assert.equal(sheet.rows.length, 3);
    assert.equal(sheet.rows[0].includes('nationality_code'), type === 'talent');
    assert.ok(sheet.writes.filter(w => w.row === 3).every(w => w.kind === 'rich'));
  });
}
test('missing fields remain empty; old clients still save', () => {
  const sheet = savedSheet(); writeExtras(sheet, 3, {}, 'talent');
  for (const name of sheet.rows[0].slice(coreHeaders.length)) assert.equal(sheet.value(3, name), '');
});
test('unknown category and independent legacy original both preserved', () => {
  const sheet = savedSheet(); writeExtras(sheet, 3, { job_category: '  future_field_未知  ', job_category_legacy: '기존 원문' }, 'company');
  assert.equal(sheet.value(3, 'job_category'), 'legacy');
  assert.equal(sheet.value(3, 'job_category_raw'), '  future_field_未知  ');
  assert.equal(sheet.value(3, 'job_category_legacy'), '기존 원문');
});
test('known old labels map; ambiguous labels do not guess', () => {
  for (const [raw, code] of [['IT·소프트웨어', 'it_digital'], ['Engineering', 'engineering_tech'], ['해외영업·무역', 'business_trade_office'], ['기술 전문직', 'legacy'], ['Other Professional Fields', 'legacy']]) {
    const mapped = context.ktgNormalizeExtraCategory_(raw);
    assert.equal(mapped.job_category, code); assert.equal(mapped.job_category_raw, raw); assert.equal(mapped.job_category_legacy, raw);
  }
});
test('frontend/backend canonical codes and normalization stay aligned', () => {
  const front = fs.readFileSync(path.join(root, 'assets/js/main.js'), 'utf8');
  const frontContext = vm.createContext({ window: {} });
  vm.runInContext(front.slice(0, front.indexOf('const ktgLocale')), frontContext);
  const taxonomy = frontContext.window.KTGTaxonomy;
  assert.deepEqual(Array.from(context.KTG_EXTRA_JOB_CODES_), Array.from(taxonomy.fields, f => f.code));
  for (const field of taxonomy.fields) for (const raw of [field.code, field.KR, field.EN]) assert.equal(context.ktgNormalizeExtraCategory_(raw).job_category, taxonomy.normalize(raw).job_category);
});
test('already added/reordered columns work without shifting or duplicate headers', () => {
  const sheet = new Sheet([['id', 'utm_campaign', 'email', 'job_category', 'unrelated'], ['OLD', 'previous', 'old@example.invalid', 'legacy', 'KEEP'], ['NEW', '', 'qa@example.invalid', '', 'KEEP_NEW']], 30);
  const old = structuredClone(sheet.rows[1]);
  writeExtras(sheet, 3, { job_category: 'engineering_tech', utm_campaign: 'new' }, 'company');
  assert.deepEqual(sheet.rows[0].slice(0, 5), ['id', 'utm_campaign', 'email', 'job_category', 'unrelated']);
  assert.deepEqual(sheet.rows[1], old); assert.equal(sheet.value(3, 'email'), 'qa@example.invalid'); assert.equal(sheet.value(3, 'unrelated'), 'KEEP_NEW');
  assert.equal(sheet.value(3, 'utm_campaign'), 'new'); assert.equal(new Set(sheet.rows[0]).size, sheet.rows[0].length);
});
test('same-row retries are idempotent and never append a submission', () => {
  const sheet = savedSheet(), p = { job_category: 'other', utm_source: 'x' };
  writeExtras(sheet, 3, p, 'talent'); const before = structuredClone(sheet.rows);
  writeExtras(sheet, 3, p, 'talent'); assert.deepEqual(sheet.rows, before);
});
test('literal/formula-like metadata uses rich text and preserves exact original', () => {
  const sheet = savedSheet(), value = '=IMPORTXML("https://example.invalid", "//x")';
  writeExtras(sheet, 3, { job_category: value, utm_source: value, utm_campaign: '+1' }, 'company');
  assert.equal(sheet.value(3, 'job_category_raw'), value); assert.equal(sheet.value(3, 'utm_source'), value); assert.equal(sheet.value(3, 'utm_campaign'), '+1');
  assert.ok(sheet.writes.filter(w => w.row === 3).every(w => w.kind === 'rich'));
});
test('invalid headers, row/type, missing lock and oversize data fail before mutation', () => {
  for (const headers of [['id', 'id'], ['id', ''], ['id', ' email']]) {
    const sheet = new Sheet([headers, ['a', 'b']]); assert.throws(() => writeExtras(sheet, 2, {}, 'company')); assert.equal(sheet.writes.length, 0);
  }
  const sheet = savedSheet();
  assert.throws(() => writeExtras(sheet, 1, {}, 'company'));
  assert.throws(() => writeExtras(sheet, 99, {}, 'company'));
  assert.throws(() => writeExtras(sheet, 3, {}, 'wrong'));
  assert.throws(() => writeExtras(sheet, 3, { utm_source: 'a'.repeat(50001) }, 'company'));
  assert.throws(() => context.ktgWriteSubmissionExtras_(sheet, 3, {}, 'company'));
  locked = false; assert.throws(() => writeExtras(sheet, 3, {}, 'company')); locked = true;
  assert.equal(sheet.writes.length, 0);
});
console.log(`${cases} tests passed; ${flushes} mocked flushes. No external requests, actual Sheet/Drive/email checks not performed.`);
