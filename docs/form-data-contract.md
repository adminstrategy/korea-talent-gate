# Form data contract — ktg-fields-v1

The browser retains every existing backend field, including `desired_role` (talent),
`hiring_role` (company), `nationality`, `visa_status`, and `work_experience`.
Free text is never translated, truncated, or inferred into a new career category.
`registration_language` identifies the interface language, not necessarily the
language used in free text. Future translations must use separate fields.

## Shared job taxonomy

`window.KTGTaxonomy.fields` in `assets/js/main.js` is the runtime source of codes
and KR/EN labels. HTML includes readable no-JavaScript fallbacks. New locales add
labels to the same dictionary rather than inventing new stored codes.

- `it_digital`
- `engineering_tech`
- `manufacturing_skilled`
- `business_trade_office`
- `service_tourism_culinary`
- `content_art_sports`

Both forms add `job_category` and retain their existing detailed-role input.
`other` allows fields outside the six. Unknown/ambiguous imported values normalize
to `legacy`, with their exact original value in `job_category_legacy`.
`KTGTaxonomy.normalize(value)` maps exact current labels/codes and unambiguous
old KR/EN labels. Technical Professionals / 기술 전문직 and Other Professional
Fields / 기타 전문직 are deliberately not guessed. No stored data is migrated.
The current site has no saved-profile reader or company review dashboard.
Future importers must call this normalizer explicitly; never overwrite source rows.
The hero preview shows the selected category, not a retrieved/saved profile.

## Additive submission fields

Both forms send:

- `job_category`, `job_category_legacy`, `job_taxonomy_version` (`ktg-fields-v1`)
- `utm_source`, `utm_medium`, `utm_campaign`, only when present in the URL

Talent additionally sends:

- `nationality_code`, `residence_country_code`: ISO alpha-2 for exact known KR/EN
  country names or ISO codes; blank for unknown/free-form nationality descriptions.
  Original `nationality` / `residence_country` strings remain unchanged.
- `visa_status_code`: lowercase literal visa code when explicitly entered;
  `not_applicable` when outside Korea; otherwise `legacy`. No eligibility inference.

Education and language selects already store locale-independent codes. Experience
is currently a free-text description, not a years selector; years are not guessed
from prose. A future years selector should store a numeric value separately from
`work_experience`. Countries and visa status stay free text to preserve existing
input coverage and backend compatibility.

## Apps Script / Sheets integration required outside this repository

The deployed Apps Script source and sheet schema are not in this repository.
An undeployed additive helper is provided in
`backend/apps-script/SubmissionExtras.gs`; see `docs/apps-script-integration.md`
for header order, integration points, deployment and live-test instructions. Keep existing
parameter handling, resume private-file storage and notification behavior unchanged.
Add the new fields above to the server's allowlist/row mapping and both appropriate
sheet headers before relying on stored taxonomy or campaign data. Store all category
codes as text, retain the legacy original, and do not reinterpret `desired_role` or
`hiring_role` as the category. An old backend may ignore additive parameters; browser
payload tests do not prove sheet persistence. Test this with an approved test entry
once the server is updated. No live submissions have been made in this environment. The helper also stores
`job_category_raw` to preserve an unknown incoming category even when a separate
legacy original is supplied. This is a backend-added audit field, not a new form input.

UTM values travel only through same-origin links and the submission payload (max
200 characters each). No analytics, cookies or web storage are added. Attribution
is not restored after visiting a URL without those parameters. Do not put personal
information in campaign query parameters.
