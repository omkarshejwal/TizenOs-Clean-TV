#!/usr/bin/env python3
"""
CleanHome Packaging Tool
=========================
Builds an unsigned .wgt package and prints signing/install commands.

Flow:
  1. Run validate.py to check project integrity
  2. If tizen CLI is on PATH: run `tizen build-web` and `tizen package -t wgt -s <profile>`
  3. If tizen CLI not available: print exact manual commands

Models on Nuvio's Tizen packaging flow, written from scratch.
Never stores certificates or passwords in files.

Features:
  - Brand icons included by default
  - --no-brand-icons flag to exclude them for smaller shareable builds
  - --include-brand-icons flag to force include brand icons even in shareable mode
"""

import os
import sys
import shutil
import subprocess
import argparse

# Paths
SCRIPT_PATH = os.path.abspath(__file__)
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_PATH))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
BUILD_DIR = os.path.join(PROJECT_ROOT, "build")
WGT_DIR = os.path.join(PROJECT_ROOT, "dist")
ASSETS_DIR = os.path.join(PROJECT_ROOT, "assets")
ICONS_DIR = os.path.join(ASSETS_DIR, "icons")

# Brand logo names that should be included/excluded
BRAND_ICON_NAMES = [
    "netflix",
    "youtube",
    "primevideo",
    "disney",
    "jiocinema",
    "spotify",
    "samsung-internet",
]


def print_header(title):
    """Print a formatted section header."""
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def check_tizen_cli():
    """Check if tizen CLI is available on PATH."""
    tizen_path = shutil.which("tizen")
    if tizen_path:
        try:
            result = subprocess.run(
                ["tizen", "version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return True, tizen_path, result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False, None, "tizen CLI found but not responding"
    return False, None, "tizen CLI not found on PATH"


def run_validate():
    """Run validate.py and return success status."""
    print_header("STEP 1: Validate Project")

    validate_script = os.path.join(TOOLS_DIR, "validate.py")
    if not os.path.exists(validate_script):
        print(f"ERROR: validate.py not found at {validate_script}")
        return False

    try:
        result = subprocess.run(
            [sys.executable, validate_script],
            capture_output=True,
            text=True,
            timeout=30
        )

        print(result.stdout)

        if result.returncode == 0:
            print("✓ Validation PASSED")
            return True
        else:
            print("✗ Validation FAILED")
            if result.stderr:
                print("Errors:", result.stderr)
            return False

    except subprocess.TimeoutExpired:
        print("ERROR: Validation timed out")
        return False
    except Exception as e:
        print(f"ERROR running validation: {e}")
        return False


def copy_brand_icons(include_brand):
    """Copy brand icons to the appropriate location based on the include flag."""
    if include_brand:
        print("\n[Brand Icons] Including brand logos by default (as requested)")
        # Copy brand icons to the main icons directory
        for icon_name in BRAND_ICON_NAMES:
            # Look for PNG and SVG versions in various locations
            possible_sources = [
                os.path.join(PROJECT_ROOT, "docs", "reference-icons", f"{icon_name}.png"),
                os.path.join(PROJECT_ROOT, "docs", "reference-icons", f"{icon_name}.svg"),
                os.path.join(PROJECT_ROOT, "assets", "icons", f"{icon_name}.png"),
                os.path.join(PROJECT_ROOT, "assets", "icons", f"{icon_name}.svg"),
            ]
            for source in possible_sources:
                if os.path.exists(source):
                    dest = os.path.join(ICONS_DIR, os.path.basename(source))
                    shutil.copy2(source, dest)
                    print(f"  Copied {os.path.basename(source)} → {os.path.basename(dest)}")
                    break
            else:
                # Also check if they already exist in assets/icons
                icon_png = os.path.join(ICONS_DIR, f"{icon_name}.png")
                icon_svg = os.path.join(ICONS_DIR, f"{icon_name}.svg")
                if not os.path.exists(icon_png) and not os.path.exists(icon_svg):
                    print(f"  ⚠ Brand icon {icon_name} not found in any source location")
    else:
        print("\n[Brand Icons] Excluding brand icons (--no-brand-icons)")


def build_with_tizen_cli(tizen_path, profile_name, include_brand):
    """Build using tizen CLI if available."""
    print_header("STEP 2: Build with tizen CLI")

    # Create build directory
    os.makedirs(BUILD_DIR, exist_ok=True)
    os.makedirs(WGT_DIR, exist_ok=True)

    # Step 2a: tizen build-web
    print("\n[2a] Running 'tizen build-web'...")
    try:
        result = subprocess.run(
            ["tizen", "build-web", "-t", "wgt", "-o", BUILD_DIR],
            capture_output=True,
            text=True,
            timeout=60
        )
        print(result.stdout)
        if result.returncode != 0:
            print("✗ build-web FAILED")
            if result.stderr:
                print("Errors:", result.stderr)
            return False
        print("✓ build-web completed")
    except subprocess.TimeoutExpired:
        print("✗ build-web timed out")
        return False
    except Exception as e:
        print(f"✗ build-web error: {e}")
        return False

    # Step 2b: tizen package
    print(f"\n[2b] Running 'tizen package -t wgt -s {profile_name}'...")
    try:
        result = subprocess.run(
            ["tizen", "package", "-t", "wgt", "-s", profile_name, "-o", WGT_DIR],
            cwd=BUILD_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )
        print(result.stdout)
        if result.returncode != 0:
            print("✗ package FAILED")
            if result.stderr:
                print("Errors:", result.stderr)
            return False
        print("✓ package completed")
    except subprocess.TimeoutExpired:
        print("✗ package timed out")
        return False
    except Exception as e:
        print(f"✗ package error: {e}")
        return False

    # List generated files
    print("\nGenerated files in dist/:")
    if os.path.exists(WGT_DIR):
        for f in os.listdir(WGT_DIR):
            full_path = os.path.join(WGT_DIR, f)
            if os.path.isfile(full_path):
                size_kb = os.path.getsize(full_path) / 10024
                print(f"  {f} ({size_kb:.1f} KB)")

    return True


def print_manual_commands(include_brand):
    """Print manual signing/install commands for when tizen CLI is not available."""
    print_header("STEP 2: Manual Build Commands")

    brand_note = ""
    if not include_brand:
        brand_note = "\n--- Brand Icons Note ---\nBrand icons were excluded via --no-brand-icons flag.\nUse --include-brand-icons to include them.\n"

    print("""If tizen CLI is not on PATH, follow these manual steps:""")

    print("""=== PREREQUISITES ===

1. Install Tizen Studio from:
   https://developer.tizen.org/development/tizen-studio/download

2. Add tizen CLI to PATH (typically):
   - Windows: C:\\tizen-studio\\tools\\tizen-studio\\bin
   - Linux/Mac: ~/tizen-studio/tools/tizen-studio/bin

3. Install certificate manager:
   tizen install -g tizen-studio-certificate-manager
   tizen install -g tizen-studio-sign-tool

=== STEP A: CREATE CERTIFICATE PROFILE ===

1. Open Certificate Manager:
   tizen-certificate-manager

2. Create Author certificate:
   - Select 'Create New Author Certificate'
   - Enter your name and email
   - Save password (DO NOT store in files!)

3. Create Distributor certificate:
   - Select 'Create New Distributor Certificate'
   - Use default Samsung distributor
   - Add TV device DUID (see below)
   - Save password (DO NOT store in files!)

4. Export the profile:
   tizen-certificate-manager --export <profile-name> --pass <password>

=== STEP B: DISCOVER TV DUID ===

Connect TV in Developer Mode, then:

  sdb connect <TV-IP-address>
  sdb shel

Example output:
  DUID: 545a3f4b5a3f4b5a

Add this DUID to your Distributor certificate profile.

=== STEP C: BUILD WEB APP ===

  cd cleanhome
  tizen build-web -t wgt

This creates a .wgt file (ZIP format) in the build/ directory.

=== STEP D: PACKAGE WITH SIGNING ===

  tizen package -t wgt -s <profile-name> -o dist/

This signs the .wgt with your certificate profile.

=== STEP E: INSTALL ON TV ===

1. Connect TV in Developer Mode:
   sdb connect <TV-IP-address>

2. List connected devices:
   sdb devices

3. Install the signed .wgt:
   tizen install -n <path-to-wgt-file> -t <device-name>

4. Run the app:
   tizen run -p com.cleanhome.tv -t <device-name>

=== NOTES ---

- NEVER store certificate passwords in files or scripts
- For development/testing, you can use -n flag to bypass signature check:
  tizen install -n <wgt-file> -t <device-name> -n
- TV must have Developer Mode enabled (type 12345 in Apps panel)
- Find TV IP: Settings > General > System > Network > Network Status
""" + brand_note)

    return True


def package_icons(include_brand):
    """Package the icon assets into the build directory."""
    print_header("STEP 3: Package Icons")

    # Ensure icons directory exists in build
    build_icons_dir = os.path.join(BUILD_DIR, "icons")
    os.makedirs(build_icons_dir, exist_ok=True)

    # Copy all regular (non-brand) icons first
    if os.path.exists(ICONS_DIR):
        for f in os.listdir(ICONS_DIR):
            full = os.path.join(ICONS_DIR, f)
            if os.path.isfile(full) and f.split(".")[0] not in BRAND_ICON_NAMES:
                shutil.copy2(full, os.path.join(build_icons_dir, f))
                print(f"  Copied icon: {f}")

    # Handle brand icons based on the include_brand flag
    if include_brand:
        print("[Icons] Including brand logos in build")
        # Copy brand icons
        for icon_name in BRAND_ICON_NAMES:
            png_src = os.path.join(ICONS_DIR, f"{icon_name}.png")
            svg_src = os.path.join(ICONS_DIR, f"{icon_name}.svg")
            if os.path.exists(png_src):
                shutil.copy2(png_src, os.path.join(build_icons_dir, f"{icon_name}.png"))
                print(f"  Copied brand icon: {icon_name}.png")
            elif os.path.exists(svg_src):
                shutil.copy2(svg_src, os.path.join(build_icons_dir, f"{icon_name}.svg"))
                print(f"  Copied brand icon: {icon_name}.svg")
            else:
                print(f"  ⚠ Brand icon {icon_name} not found in assets/icons")
    else:
        print("[Icons] Excluding brand icons from build (--no-brand-icons)")
        # Do not copy brand icons

    print(f"  Total icons in build: {len(os.listdir(build_icons_dir))}")


def main():
    """Main packaging workflow."""
    parser = argparse.ArgumentParser(
        description="CleanHome Packaging Tool - Build and sign .wgt package"
    )
    parser.add_argument(
        "-p", "--profile",
        default="cleanhome-profile",
        help="Certificate profile name (default: cleanhome-profile)"
    )
    parser.add_argument(
        "--skip-validate",
        action="store_true",
        help="Skip validation step (NOT recommended)"
    )
    parser.add_argument(
        "--manual-only",
        action="store_true",
        help="Only print manual commands, don't attempt build"
    )
    parser.add_argument(
        "--no-brand-icons",
        action="store_true",
        help="Exclude brand logos (Netflix, YouTube, etc.) from the build for smaller package. Default: included."
    )
    parser.add_argument(
        "--include-brand-icons",
        action="store_true",
        help="Force include brand icons in the build (overrides --no-brand-icons)"
    )

    args = parser.parse_args()

    # Determine if brand icons should be included
    # Default: include brand icons (as requested by user for personal launcher)
    include_brand = True
    if args.no_brand_icons:
        include_brand = False
    if args.include_brand_icons:
        include_brand = True

    print()
    print("*" * 60)
    print("  CleanHome Packaging Tool")
    print("*" * 60)
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Brand icons: {'INCLUDED' if include_brand else 'EXCLUDED'}")

    # Step 1: Validate
    if not args.skip_validate:
        if not run_validate():
            print("\nFIX VALIDATION ERRORS BEFORE PACKAGING")
            sys.exit(1)
    else:
        print("\nWARNING: Skipping validation (--skip-validate)")

    # Step 2: Copy brand icons based on preference
    copy_brand_icons(include_brand)

    # Step 2: Check tizen CLI
    if args.manual_only:
        print_manual_commands(include_brand)
        return

    tizen_available, tizen_path, tizen_version = check_tizen_cli()

    if tizen_available:
        print(f"\ntizen CLI found: {tizen_path}")
        print(f"Version: {tizen_version}")

        # Build with tizen CLI
        if build_with_tizen_cli(tizen_path, profile_name, include_brand):
            print_header("SUCCESS")
            print("""
Package built successfully!

Next steps:
1. Connect TV in Developer Mode
2. Install with: tizen install -n <wgt-file> -t <device-name>
3. Run with: tizen run -p com.cleanhome.tv -t <device-name>

Or use manual commands if signing is needed.
""")
        else:
            print_header("BUILD FAILED")
            print("""
Build failed. Falling back to manual commands...
""")
            print_manual_commands(include_brand)
    else:
        print(f"\ntizen CLI not available: {tizen_version}")
        print("\nFalling back to manual commands...")
        print_manual_commands(include_brand)


if __name__ == "__main__":
    main()