import os
import re
import sys

# Unsupported features in Chromium 56 / Tizen 4.0
PATTERNS = {
    "JS: Optional chaining (?.)": (
        r'(?<!\?)\?\.(?!\?)[a-zA-Z_$\[(]',
        ['.js']
    ),
    "JS: Nullish coalescing (??)": (
        r'\?\?',
        ['.js']
    ),
    "JS: Object.fromEntries()": (
        r'\bObject\.fromEntries\b',
        ['.js']
    ),
    "JS: Array.prototype.flat / flatMap": (
        r'\.(?:flat|flatMap)\s*\(',
        ['.js']
    ),
    "JS: Promise.finally": (
        r'\.finally\s*\(',
        ['.js']
    ),
    "JS: String.prototype.matchAll": (
        r'\.matchAll\s*\(',
        ['.js']
    ),
    "JS: String.prototype.replaceAll": (
        r'\.replaceAll\s*\(',
        ['.js']
    ),
    "JS: globalThis": (
        r'\bglobalThis\b',
        ['.js']
    ),
    "JS: BigInt": (
        r'\bBigInt\b|\b\d+n\b',
        ['.js']
    ),
    "JS: Promise.allSettled / any": (
        r'\bPromise\.(?:allSettled|any)\b',
        ['.js']
    ),
    "CSS: gap property (flex/grid)": (
        r'(?<![a-zA-Z0-9_-])gap\s*:',
        ['.css']
    ),
    "CSS: inset shorthand": (
        r'(?<![a-zA-Z0-9_-])inset\s*:',
        ['.css']
    ),
    "CSS: aspect-ratio": (
        r'(?<![a-zA-Z0-9_-])aspect-ratio\s*:',
        ['.css']
    ),
    "CSS: :is() pseudo-class": (
        r':is\(',
        ['.css']
    ),
    "CSS: :where() pseudo-class": (
        r':where\(',
        ['.css']
    ),
    "CSS: :focus-visible pseudo-class": (
        r':focus-visible\b',
        ['.css']
    ),
    "CSS: backdrop-filter": (
        r'(?<![a-zA-Z0-9_-])backdrop-filter\s*:',
        ['.css']
    ),
    "CSS: clamp()": (
        r'(?<![a-zA-Z0-9_-])clamp\s*\(',
        ['.css']
    ),
    "CSS: min() / max() math functions": (
        r'(?<![a-zA-Z0-9_-])(?:min|max)\s*\([^)]*,\s*[^)]*\)',
        ['.css']
    ),
    "CSS: linear() easing function": (
        r'(?<![a-zA-Z0-9_-])linear\s*\([^)]*,\s*[^)]*\)',
        ['.css']
    ),
    "CSS: color-mix()": (
        r'(?<![a-zA-Z0-9_-])color-mix\s*\(',
        ['.css']
    )
}

def remove_comments(content, ext):
    # Remove block comments /* ... */
    content = re.sub(r'/\*[\s\S]*?\*/', lambda m: '\n' * m.group(0).count('\n'), content)
    if ext == '.js':
        # Remove single line comments
        content = re.sub(r'//[^\n]*', '', content)
    return content

def scan_files(targets):
    results = []
    for target_dir in targets:
        if not os.path.exists(target_dir):
            continue
        for root, _, files in os.walk(target_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    raw_content = f.read()
                
                clean_content = remove_comments(raw_content, ext)
                raw_lines = raw_content.splitlines()
                clean_lines = clean_content.splitlines()

                for line_idx, line_clean in enumerate(clean_lines, 1):
                    for feat_name, (pattern, exts) in PATTERNS.items():
                        if ext in exts:
                            if re.search(pattern, line_clean):
                                results.append({
                                    "file": filepath,
                                    "line": line_idx,
                                    "feature": feat_name,
                                    "snippet": raw_lines[line_idx - 1].strip() if line_idx <= len(raw_lines) else ""
                                })
    return results

if __name__ == '__main__':
    targets = ['js', 'css']
    hits = scan_files(targets)
    print(f"=== Chromium 56 / Tizen 4 Compatibility Scanner ===")
    print(f"Scanned directories: {targets}")
    print(f"Total incompatibilities detected: {len(hits)}")
    if hits:
        print("\nFindings:")
        for h in hits:
            print(f"  {h['file']}:{h['line']} [{h['feature']}] -> {h['snippet']}")
        sys.exit(1)
    else:
        print("\n[PASS] No Chromium 56 / Tizen 4 incompatibilities found.")
        sys.exit(0)
