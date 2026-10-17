"""Read-only locale/SEO/form regression checks against the approved KR/EN baseline."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import subprocess
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = '64daef835142cd31c336e86772a13c6a5ef269b7'
ORIGIN = 'https://koreatalentgate.com/'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = []; self.ids = set(); self.canonical = []; self.alternates = {}
        self.fields = []; self.lang = ''; self.title = ''; self.description = ''
        self.in_title = False
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'html': self.lang = data.get('lang')
        if tag == 'title': self.in_title = True
        if tag == 'meta' and data.get('name') == 'description': self.description = data.get('content', '')
        if data.get('id'): self.ids.add(data['id'])
        if tag == 'a' and data.get('href'): self.links.append(data['href'])
        if tag in ['script', 'img'] and data.get('src'): self.links.append(data['src'])
        if tag == 'link' and data.get('rel') == 'stylesheet': self.links.append(data['href'])
        if tag == 'link' and data.get('rel') == 'canonical': self.canonical.append(data['href'])
        if tag == 'link' and data.get('rel') == 'alternate': self.alternates[data['hreflang']] = data['href']
        if tag in ['input', 'select', 'textarea', 'option']:
            self.fields.append((tag, tuple((k, v) for k, v in attrs if k in ['id', 'name', 'value', 'type', 'required', 'accept', 'min', 'max', 'maxlength'])))
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, text):
        if self.in_title: self.title += text

def baseline(name):
    return subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=ROOT)

routes = sorted(f.relative_to(ROOT / 'en') for f in (ROOT / 'en').rglob('index.html'))
assert len(routes) == 11
for locale in ['kr', 'vi']:
    assert sorted(f.relative_to(ROOT / locale) for f in (ROOT / locale).rglob('index.html')) == routes
pages = {}
for locale in ['kr', 'en', 'vi']:
    for route in routes:
        file = ROOT / locale / route
        text = file.read_text()
        page = Page(text); pages[file.resolve()] = page
        suffix = route.parent.as_posix()
        suffix = '' if suffix == '.' else suffix + '/'
        assert page.lang == ('ko' if locale == 'kr' else locale)
        assert page.canonical == [ORIGIN + locale + '/' + suffix], file
        assert page.alternates == {tag: ORIGIN + language + '/' + suffix for language, tag in [('kr', 'ko'), ('en', 'en'), ('vi', 'vi')]}, file
        assert page.title and page.description, file
        assert len(re.findall(r'src="[^"]*/assets/js/main\.js\?v=20261017-vi"', text)) == 1, file
        assert 'coming soon' not in text.lower(), file
        if locale in ['kr', 'en']:
            # Undo ONLY allowed additions and demand byte-for-byte equality.
            restored = text.replace('main.js?v=20261017-vi', 'main.js').replace(f'<link rel="alternate" hreflang="vi" href="{ORIGIN}vi/{suffix}">', '')
            restored = re.sub(r'<a href="[^"]+" lang="vi" hreflang="vi">VI</a>', '<span aria-disabled="true" title="Tiếng Việt — coming soon" lang="vi">VI<span class="sr-only"> — coming soon</span></span>', restored)
            assert restored.encode() == baseline(file.relative_to(ROOT).as_posix()), file

links = 0
for file, page in pages.items():
    for href in page.links:
        url = urlsplit(href)
        if url.scheme or url.netloc: continue
        dest = (file.parent / unquote(url.path)).resolve() if url.path else file
        if dest.is_dir(): dest = dest / 'index.html'
        assert dest.is_file(), (file, href)
        if url.fragment: assert unquote(url.fragment) in pages[dest].ids, (file, href)
        links += 1
for kind in ['talent', 'companies']:
    fields = [pages[(ROOT / locale / kind / 'index.html').resolve()].fields for locale in ['kr', 'en', 'vi']]
    assert fields[0] == fields[1] == fields[2], kind
locs = [e.text for e in ET.parse(ROOT / 'sitemap.xml').findall('{*}url/{*}loc')]
assert len(locs) == len(set(locs)) == 33
assert set(locs) == {p.canonical[0] for p in pages.values()}

# Keep backend/infrastructure and JS submission/validation logic identical.
for file in [*ROOT.glob('backend/**/*'), ROOT/'CNAME', ROOT/'robots.txt', ROOT/'index.html']:
    if file.is_file(): assert file.read_bytes() == baseline(file.relative_to(ROOT).as_posix()), file
js = (ROOT / 'assets/js/main.js').read_text()
old_js = baseline('assets/js/main.js').decode()
for pattern in [r"const KTG_API_ENDPOINT = '[^']+';", r'const KTG_RESUME_MAX_BYTES = .*?;', r"const KTG_PRIVACY_POLICY_VERSION = '[^']+';", r'const buildSubmissionPayload = async .*?\n};', r'const postSubmission = async .*?\n};', r'const initializeSubmission = .*?\n};', r'const profileForm = .*\Z']:
    assert re.search(pattern, js, re.S)[0] == re.search(pattern, old_js, re.S)[0], pattern
css = (ROOT / 'assets/css/styles.css').read_text()
old_css = baseline('assets/css/styles.css').decode()
assert css.startswith(old_css)
assert css[len(old_css):].strip() == '/* Vietnamese navigation needs a little more room at small desktop widths. */\n@media(min-width:1100px) and (max-width:1279px){html[lang=vi] .site-nav{font-size:14px;gap:16px}}'

expected = {
    'talent': ['Chuẩn bị cho sự nghiệp tại Hàn Quốc', 'cơ hội nghề nghiệp', 'Tình trạng lưu trú tại Hàn Quốc', 'Nơi bạn đang sinh sống và tình trạng lưu trú tại Hàn Quốc, nếu có.', 'Chúng tôi xem xét kinh nghiệm và các yêu cầu thực tế cần đáp ứng.', 'Tư cách lưu trú hiện tại', 'Korea Talent Gate thu thập, sử dụng thông tin cá nhân của tôi', 'sẽ tự động được chia sẻ'],
    'companies': ['Tìm kiếm nhân tài quốc tế cho doanh nghiệp', 'Yêu cầu kinh nghiệm', 'Yêu cầu ngôn ngữ', 'Vị trí cần tuyển', 'Korea Talent Gate thu thập, sử dụng thông tin cá nhân của tôi'],
    'privacy': ['để xem xét hồ sơ, nhu cầu tuyển dụng và liên hệ', 'Khi mục đích sử dụng đã đạt được', 'Việc đồng ý này không có nghĩa là', 'sẽ tự động được chia sẻ với một doanh nghiệp cụ thể'],
    'work-in-korea': ['Thông tin thiết thực về nghề nghiệp, các bước chuẩn bị làm việc và cuộc sống tại Hàn Quốc.', 'Chuẩn bị tìm việc', 'Chuẩn bị visa và lưu trú'],
    'work-in-korea/visa-stay': ['điều kiện nộp hồ sơ'],
    'work-in-korea/workplace-culture': ['Tìm hiểu cách giao tiếp, phối hợp, tham gia họp và những yêu cầu thường gặp trong công việc hằng ngày.']
}
for route, strings in expected.items():
    text = (ROOT / 'vi' / route / 'index.html').read_text()
    for string in strings: assert string in text, (route, string)
assert 'các kỳ vọng chuyên nghiệp' not in (ROOT/'vi/work-in-korea/workplace-culture/index.html').read_text()
print(f'PASS: 33 pages; {links} internal asset/link/anchor references; 33 sitemap URLs; reciprocal SEO; exact KR/EN preservation; identical form names/values/required; approved VI copy; backend and submit logic unchanged.')
