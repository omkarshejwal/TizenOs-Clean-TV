import os
import re
import sys

errors = []

# 1. Check index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Check for external URLs, localhost in index.html
for line_no, line in enumerate(html.splitlines(), 1):
    for match in re.finditer(r'(https?://[^\s"\'<>]+)', line):
        errors.append(f'index.html:{line_no}: external URL: {match.group(1)}')
    for match in re.finditer(r'(localhost|127\.0\.0\.1)', line):
        errors.append(f'index.html:{line_no}: localhost URL: {match.group(1)}')

# Check referenced files in index.html (src and href)
for match in re.finditer(r'(?:src|href)=["\']([^"\']+)["\']', html):
    src = match.group(1)
    if src.startswith(('http:', 'https:', '#', 'data:')):
        continue
    if src.startswith('/') or (len(src) > 1 and src[1] == ':'):
        errors.append(f'index.html: absolute path referenced: {src}')
    elif not os.path.exists(src):
        errors.append(f'index.html: referenced file not found: {src}')

# 2. Check CSS files
for root, _, files in os.walk('css'):
    for file in files:
        if file.endswith('.css'):
            p = os.path.join(root, file)
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()
            for line_no, line in enumerate(content.splitlines(), 1):
                for match in re.finditer(r'(https?://[^\s"\'<>]+)', line):
                    errors.append(f'{p}:{line_no}: external URL: {match.group(1)}')
                for match in re.finditer(r'(localhost|127\.0\.0\.1)', line):
                    errors.append(f'{p}:{line_no}: localhost URL: {match.group(1)}')
                for match in re.finditer(r'url\(\s*["\']?([^"\'\)]+)["\']?\s*\)', line):
                    u = match.group(1)
                    if u.startswith('data:'):
                        continue
                    if u.startswith('/') or (len(u) > 1 and u[1] == ':'):
                        errors.append(f'{p}:{line_no}: absolute path in url(): {u}')
                    # relative to css directory or root
                    rel_to_css = os.path.normpath(os.path.join(root, u))
                    rel_to_root = os.path.normpath(u)
                    if not os.path.exists(rel_to_css) and not os.path.exists(rel_to_root):
                        errors.append(f'{p}:{line_no}: CSS url() target not found: {u} (checked {rel_to_css})')

# 3. Check JS files
for root, _, files in os.walk('js'):
    for file in files:
        if file.endswith('.js'):
            p = os.path.join(root, file)
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()
            for line_no, line in enumerate(content.splitlines(), 1):
                # Check for network requests (fetch, XMLHttpRequest, script/link tags) or localhost
                for match in re.finditer(r'(?:fetch|loadScript|open)\s*\(\s*["\'`](https?://[^\s"\'`<>]+)["\'`]', line):
                    errors.append(f'{p}:{line_no}: external resource fetch: {match.group(1)}')
                for match in re.finditer(r'["\'`](localhost|127\.0\.0\.1)[^"\'`]*["\'`]', line):
                    errors.append(f'{p}:{line_no}: localhost URL: {match.group(0)}')

# 4. Check config/apps.json, config/icons.json, config/wallpapers.json
for conf in ['config/apps.json', 'config/icons.json', 'config/wallpapers.json']:
    if os.path.exists(conf):
        with open(conf, 'r', encoding='utf-8') as f:
            c = f.read()
            # check any file paths referenced in JSON
            for match in re.finditer(r'["\'](assets/[^"\']+)["\']', c):
                path = match.group(1)
                if not os.path.exists(path):
                    errors.append(f'{conf}: asset path not found: {path}')

print('=== PACKAGING VERIFICATION REPORT ===')
if not errors:
    print('ALL CHECKS PASSED:')
    print('- Zero absolute paths')
    print('- Zero external HTTP/HTTPS CDN or font resources')
    print('- Zero localhost URLs in code/html/css')
    print('- All referenced local assets and files exist')
else:
    print(f'Found {len(errors)} issues:')
    for e in errors:
        print(' -', e)
    sys.exit(1)
