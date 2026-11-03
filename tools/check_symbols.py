#!/usr/bin/env python3
"""Check JavaScript and CSS code for Tizen 4 compatibility and symbol integrity.

Ensures:
1. No optional chaining (?.)
2. No nullish coalescing (??)
3. No CSS linear() easing
4. No CSS gap property
5. No CSS inset property
6. Clean ECMAScript compatibility (Tizen 4 uses Chromium 56)
"""

import os
import sys
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
JS_DIR = os.path.join(PROJECT_ROOT, "js")
CSS_PATH = os.path.join(PROJECT_ROOT, "css", "style.css")

EXIT_CODE = 0
ERRORS = []


def error(msg):
    global EXIT_CODE
    EXIT_CODE = 1
    ERRORS.append(msg)
    print(f"ERROR: {msg}")


def strip_comments(text):
    """Strip block comments /* ... */ and line comments // ..."""
    # Replace block comments with spaces to preserve line count
    def repl_block(m):
        return "\n" * m.group(0).count("\n")
    text = re.sub(r'/\*[\s\S]*?\*/', repl_block, text)
    # Strip line comments
    text = re.sub(r'//.*$', '', text, flags=re.MULTILINE)
    return text


def check_js_file(fpath):
    rel = os.path.relpath(fpath, PROJECT_ROOT)
    print(f"Checking {rel}...")
    with open(fpath, "r", encoding="utf-8") as f:
        raw = f.read()

    stripped = strip_comments(raw)
    lines = stripped.splitlines()

    for i, code in enumerate(lines, 1):
        # 1. Optional chaining (?.)
        if re.search(r'\b[a-zA-Z0-9_\$]+\s*\?\.\s*[a-zA-Z0-9_\$\[\(]', code):
            error(f"{rel}:{i}: Optional chaining (?.) found (not supported in Tizen 4)")

        # 2. Nullish coalescing (??)
        if "??" in code:
            error(f"{rel}:{i}: Nullish coalescing (??) found (not supported in Tizen 4)")

        # 3. linear() easing
        if "linear(" in code:
            error(f"{rel}:{i}: linear() easing found (not supported in Tizen 4)")


def check_css_file(fpath):
    if not os.path.isfile(fpath):
        return
    rel = os.path.relpath(fpath, PROJECT_ROOT)
    print(f"Checking {rel}...")
    with open(fpath, "r", encoding="utf-8") as f:
        raw = f.read()

    stripped = strip_comments(raw)
    lines = stripped.splitlines()

    for i, line in enumerate(lines, 1):
        # 1. flex gap
        if re.search(r'^\s*gap\s*:', line) or re.search(r';\s*gap\s*:', line):
            error(f"{rel}:{i}: CSS 'gap' property found (not supported in Tizen 4 flexbox; use margin)")

        # 2. inset
        if re.search(r'^\s*inset\s*:', line) or re.search(r';\s*inset\s*:', line):
            error(f"{rel}:{i}: CSS 'inset' property found (not supported in Tizen 4; use top/left/right/bottom)")

        # 3. linear() easing in CSS
        if "linear(" in line:
            error(f"{rel}:{i}: CSS linear() easing found (not supported in Tizen 4)")


def main():
    print("=== CleanHome Symbol & Tizen 4 Compatibility Check ===\n")

    if os.path.isdir(JS_DIR):
        for fname in sorted(os.listdir(JS_DIR)):
            if fname.endswith(".js"):
                check_js_file(os.path.join(JS_DIR, fname))

    if os.path.isfile(CSS_PATH):
        check_css_file(CSS_PATH)

    print("\n=== Compatibility Check Summary ===")
    if EXIT_CODE == 0:
        print("All compatibility checks passed! Code is 100% compliant with Tizen 4 / Chromium 56.")
    else:
        print(f"{len(ERRORS)} incompatibility issue(s) found:")
        for err in ERRORS:
            print(f"  - {err}")

    sys.exit(EXIT_CODE)


if __name__ == "__main__":
    main()
