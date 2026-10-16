/**
 * Add to the EXISTING Apps Script project. This file is not a replacement doPost.
 * Call ktgWriteSubmissionExtras_ AFTER the existing successful row/resume metadata
 * write, BEFORE sending notification / returning {ok:true}, while holding the
 * existing ScriptLock used by all submissions. See docs/apps-script-integration.md.
 * No Drive, mail, frontend endpoint or existing submission columns are changed.
 */
var KTG_EXTRA_JOB_CODES_ = Object.freeze([
  'it_digital', 'engineering_tech', 'manufacturing_skilled',
  'business_trade_office', 'service_tourism_culinary', 'content_art_sports'
]);
var KTG_EXTRA_HEADERS_ = Object.freeze([
  'job_category', 'utm_source', 'utm_medium', 'utm_campaign',
  'job_category_legacy', 'job_taxonomy_version', 'job_category_raw'
]);
var KTG_EXTRA_TALENT_HEADERS_ = Object.freeze([
  'nationality_code', 'residence_country_code', 'visa_status_code'
]);

function ktgExtraText_(value) {
  return value === undefined || value === null ? '' : String(value);
}

function ktgNormalizeExtraCategory_(value, legacyValue) {
  var raw = ktgExtraText_(value);
  var key = raw.trim().toLowerCase();
  var legacy = ktgExtraText_(legacyValue);
  var aliases = {
    'it·디지털': 'it_digital', 'it & digital': 'it_digital',
    '엔지니어링·기술': 'engineering_tech', 'engineering & technology': 'engineering_tech',
    '제조·기능·숙련': 'manufacturing_skilled', 'manufacturing & skilled trades': 'manufacturing_skilled',
    '비즈니스·무역·사무': 'business_trade_office', 'business, trade & administration': 'business_trade_office',
    '서비스·관광·조리': 'service_tourism_culinary', 'services, tourism & culinary': 'service_tourism_culinary',
    '콘텐츠·예술·스포츠': 'content_art_sports', 'content, arts & sports': 'content_art_sports',
    'it·소프트웨어': 'it_digital', 'it & software': 'it_digital',
    '엔지니어링': 'engineering_tech', 'engineering': 'engineering_tech',
    '해외영업·무역': 'business_trade_office', 'global sales & trade': 'business_trade_office'
  };
  var code = '';
  if (KTG_EXTRA_JOB_CODES_.indexOf(key) !== -1 || key === 'other') code = key;
  else if (Object.prototype.hasOwnProperty.call(aliases, key)) {
    code = aliases[key];
    if (!legacy) legacy = raw;
  } else if (raw) {
    code = 'legacy';
    if (!legacy && key !== 'legacy') legacy = raw;
  }
  return { job_category: code, job_category_legacy: legacy, job_category_raw: raw };
}

function ktgBuildSubmissionExtras_(parameters, type) {
  if (type !== 'talent' && type !== 'company') throw new Error('Invalid submission type');
  var p = parameters || {};
  var category = ktgNormalizeExtraCategory_(p.job_category, p.job_category_legacy);
  var result = {
    job_category: category.job_category,
    utm_source: ktgExtraText_(p.utm_source),
    utm_medium: ktgExtraText_(p.utm_medium),
    utm_campaign: ktgExtraText_(p.utm_campaign),
    job_category_legacy: category.job_category_legacy,
    job_taxonomy_version: ktgExtraText_(p.job_taxonomy_version),
    job_category_raw: category.job_category_raw
  };
  if (type === 'talent') {
    KTG_EXTRA_TALENT_HEADERS_.forEach(function (name) {
      result[name] = ktgExtraText_(p[name]);
    });
  }
  return result;
}

/**
 * Inspect first; never move, rename, delete or rewrite existing header cells.
 * New headers append at the right in documented order, skipping existing names.
 * Abort on blank/duplicate headers rather than risk writing to the wrong column.
 */
function ktgEnsureExtraHeaders_(sheet, required) {
  var width = sheet.getLastColumn();
  if (width < 1) throw new Error('Existing submission headers are required');
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var seen = Object.create(null);
  headers.forEach(function (header) {
    if (typeof header !== 'string' || !header.trim() || header !== header.trim() || seen[header]) {
      throw new Error('Existing submission headers need review');
    }
    seen[header] = true;
  });
  var missing = required.filter(function (name) { return !seen[name]; });
  if (missing.length) {
    var needed = width + missing.length;
    if (sheet.getMaxColumns() < needed) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
    sheet.getRange(1, width + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }
  return headers;
}

/**
 * savedRow must come from the SAME existing submission save, not a delayed
 * getLastRow() after releasing its lock. Existing fields are never overwritten.
 * Rich text stores exact literal strings (including '=...') as text, not formulas.
 * Re-running on the same savedRow is idempotent and creates no new submission.
 */
function ktgWriteSubmissionExtras_(sheet, savedRow, parameters, type, submissionLock) {
  if (!submissionLock || !submissionLock.hasLock()) throw new Error('Existing submission ScriptLock is required');
  if (!Number.isInteger(savedRow) || savedRow < 2 || savedRow > sheet.getLastRow()) {
    throw new Error('A saved submission row is required');
  }
  var extras = ktgBuildSubmissionExtras_(parameters, type);
  var names = KTG_EXTRA_HEADERS_.slice();
  if (type === 'talent') names = names.concat(KTG_EXTRA_TALENT_HEADERS_);
  // Prebuild values before touching the sheet; malformed oversized text fails early.
  var values = names.map(function (name) {
    var value = extras[name];
    if (value.length > 50000) throw new Error('Submission metadata exceeds cell limit');
    return SpreadsheetApp.newRichTextValue().setText(value).build();
  });
  var headers = ktgEnsureExtraHeaders_(sheet, names);
  // Write only named addon columns, even when older deployments already added
  // them in another order. Group adjacent columns to reduce service calls.
  var cells = names.map(function (name, index) {
    return { column: headers.indexOf(name) + 1, value: values[index] };
  }).sort(function (a, b) { return a.column - b.column; });
  var groups = [];
  cells.forEach(function (cell) {
    var last = groups[groups.length - 1];
    if (last && cell.column === last.start + last.values.length) last.values.push(cell.value);
    else groups.push({ start: cell.column, values: [cell.value] });
  });
  groups.forEach(function (group) {
    sheet.getRange(savedRow, group.start, 1, group.values.length).setRichTextValues([group.values]);
  });
  SpreadsheetApp.flush();
  return savedRow;
}
