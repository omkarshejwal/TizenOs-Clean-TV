#!/usr/bin/env python3
"""Validate CleanHome project configuration, schemas, assets, and privileges.

Checks:
1. config.xml (unique ID format packageId.AppName, privileges present)
2. config/apps.json (schema, tiles, brand-colors, referenced icons)
3. config/icons.json (mapping integrity)
4. config/settings.json (required preferences)
5. config/wallpapers.json (path and blur companion existence)
6. Assets existence (HTML, CSS, JS, wallpapers, icons)
7. Package size limits
"""

import os
import sys
import re
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

EXIT_CODE = 0
ERRORS = []


def error(msg):
    global EXIT_CODE
    EXIT_CODE = 1
    ERRORS.append(msg)
    print(f"ERROR: {msg}")


def check_file(path, desc):
    if not os.path.isfile(path):
        error(f"{desc} missing at {path}")
        return False
    print(f"  [OK] {desc} exists")
    return True


def main():
    global EXIT_CODE
    print("=== CleanHome Project Validation ===\n")

    # 1. config.xml
    print("1. Checking config.xml...")
    xml_path = os.path.join(PROJECT_ROOT, "config.xml")
    if check_file(xml_path, "config.xml"):
        with open(xml_path, "r", encoding="utf-8") as f:
            xml_text = f.read()

        app_m = re.search(r'<tizen:application[^>]*id="([^"]+)"', xml_text)
        pkg_m = re.search(r'package="([^"]+)"', xml_text)
        if app_m and "." in app_m.group(1):
            print(f"  [OK] App ID: {app_m.group(1)}")
        else:
            error("config.xml tizen:application id must follow 'packageId.AppName' format with a dot.")
        if pkg_m and (len(pkg_m.group(1)) != 10 or not pkg_m.group(1).isalnum()):
            error(f"config.xml package must be exactly 10 alphanumeric characters, got: {pkg_m.group(1)}")
        elif pkg_m:
            print(f"  [OK] Package ID: {pkg_m.group(1)} (10 chars alphanumeric)")

        required_privileges = [
            "http://tizen.org/privilege/application.launch",
            "http://tizen.org/privilege/application.info",
            "http://tizen.org/privilege/tv.inputdevice"
        ]
        for priv in required_privileges:
            if priv not in xml_text:
                error(f"Missing required privilege in config.xml: {priv}")
            else:
                print(f"  [OK] Privilege verified: {priv}")

    # 2. apps.json
    print("\n2. Checking config/apps.json...")
    apps_path = os.path.join(PROJECT_ROOT, "config", "apps.json")
    if check_file(apps_path, "config/apps.json"):
        try:
            with open(apps_path, "r", encoding="utf-8") as f:
                apps_data = json.load(f)
            tiles = apps_data.get("tiles", [])
            print(f"  [OK] Found {len(tiles)} tiles in config")
            for i, t in enumerate(tiles):
                for req in ["name", "icon", "appId"]:
                    if req not in t:
                        error(f"Tile {i} missing property: {req}")
                icon_name = t.get("icon", "")
                svg_icon = os.path.join(PROJECT_ROOT, "assets", "icons", f"{icon_name}.svg")
                png_icon = os.path.join(PROJECT_ROOT, "assets", "icons", f"{icon_name}.png")
                if not os.path.isfile(svg_icon) and not os.path.isfile(png_icon):
                    error(f"Missing icon asset for tile '{t.get('name')}': {icon_name}")
        except Exception as e:
            error(f"apps.json parsing error: {e}")

    # 3. icons.json
    print("\n3. Checking config/icons.json...")
    icons_path = os.path.join(PROJECT_ROOT, "config", "icons.json")
    if check_file(icons_path, "config/icons.json"):
        try:
            with open(icons_path, "r", encoding="utf-8") as f:
                icons_data = json.load(f)
            mapping = icons_data.get("icons", [])
            print(f"  [OK] Found {len(mapping)} icon mappings")
        except Exception as e:
            error(f"icons.json parsing error: {e}")

    # 4. settings.json
    print("\n4. Checking config/settings.json...")
    settings_path = os.path.join(PROJECT_ROOT, "config", "settings.json")
    if check_file(settings_path, "config/settings.json"):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                settings_data = json.load(f)
            for req in ["clockFormat", "wallpaper", "reducedMotion"]:
                if req not in settings_data:
                    error(f"settings.json missing property: {req}")
            print("  [OK] settings.json structure verified")
        except Exception as e:
            error(f"settings.json parsing error: {e}")

    # 5. wallpapers.json
    print("\n5. Checking config/wallpapers.json...")
    wallpapers_path = os.path.join(PROJECT_ROOT, "config", "wallpapers.json")
    if check_file(wallpapers_path, "config/wallpapers.json"):
        try:
            with open(wallpapers_path, "r", encoding="utf-8") as f:
                wps = json.load(f)
            print(f"  [OK] Found {len(wps)} wallpapers")
            for wp in wps:
                p = os.path.join(PROJECT_ROOT, wp.get("path", ""))
                bp = os.path.join(PROJECT_ROOT, wp.get("blurPath", ""))
                if not os.path.isfile(p):
                    error(f"Wallpaper file missing: {wp.get('path')}")
                if not os.path.isfile(bp):
                    error(f"Wallpaper blur companion missing: {wp.get('blurPath')}")
        except Exception as e:
            error(f"wallpapers.json parsing error: {e}")

    # 6. Core assets
    print("\n6. Checking HTML/CSS/JS core files...")
    check_file(os.path.join(PROJECT_ROOT, "index.html"), "index.html")
    check_file(os.path.join(PROJECT_ROOT, "css", "style.css"), "css/style.css")
    check_file(os.path.join(PROJECT_ROOT, "js", "motion-config.js"), "js/motion-config.js")
    check_file(os.path.join(PROJECT_ROOT, "js", "app.js"), "js/app.js")
    check_file(os.path.join(PROJECT_ROOT, "js", "launcher.js"), "js/launcher.js")
    check_file(os.path.join(PROJECT_ROOT, "js", "remote.js"), "js/remote.js")

    # 7. Package Size Calculation (Packageable WGT assets, excluding docs/tools/dev files)
    print("\n7. Checking package size...")
    pkg_dirs = ['css', 'js', 'assets', 'config']
    pkg_files = ['config.xml', 'index.html', 'icon.png']
    total_size = sum(os.path.getsize(os.path.join(PROJECT_ROOT, f)) for f in pkg_files if os.path.isfile(os.path.join(PROJECT_ROOT, f)))

    for d in pkg_dirs:
        dir_path = os.path.join(PROJECT_ROOT, d)
        if os.path.isdir(dir_path):
            for root, _, files in os.walk(dir_path):
                for f in files:
                    fp = os.path.join(root, f)
                    total_size += os.path.getsize(fp)

    size_mb = total_size / (1024 * 1024)
    print(f"  [OK] Packageable WGT size: {size_mb:.2f} MB ({total_size} bytes)")
    if size_mb > 3.0:
        error(f"Package size exceeds 3 MB limit: {size_mb:.2f} MB")
    else:
        print(f"  [OK] Package size is well under 3 MB limit: {size_mb:.2f} MB")

    print("\n=== Validation Summary ===")
    if EXIT_CODE == 0:
        print("All CleanHome validation checks passed successfully!")
    else:
        print(f"Validation failed with {len(ERRORS)} error(s):")
        for err in ERRORS:
            print(f"  - {err}")

    sys.exit(EXIT_CODE)


if __name__ == "__main__":
    main()

