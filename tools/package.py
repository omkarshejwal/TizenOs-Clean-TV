#!/usr/bin/env python3
"""
tools/package.py - CleanHome Samsung Tizen TV Packaging Automation

Automates:
  1. tizen build-web with strict exclusions (tools, docs, node_modules, .git, backups).
  2. tizen package -t wgt -s <profile> packaging the BUILD OUTPUT folder (.buildResult).
  3. Prints the exact .wgt file name produced.
  4. Prints the install command using that real package name.
  5. If tizen CLI is missing, displays the exact commands to run after installing Tizen Studio.
"""

import os
import sys
import shutil
import argparse
import subprocess
import glob
import xml.etree.ElementTree as ET

def get_app_info(root_dir):
    config_xml = os.path.join(root_dir, "config.xml")
    if not os.path.exists(config_xml):
        return "c1eanhome1", "CleanHome", "1.0.0", "c1eanhome1.CleanHome"
    try:
        tree = ET.parse(config_xml)
        root = tree.getroot()
        widget_id = root.get("id", "c1eanhome1.CleanHome")
        version = root.get("version", "1.0.0")
        
        # Check tizen:application across namespaces
        app_elem = None
        for elem in root.iter():
            if elem.tag.endswith("application") and "id" in elem.attrib:
                app_elem = elem
                break
        
        if app_elem is not None:
            app_id = app_elem.get("id", "c1eanhome1.CleanHome")
            pkg_id = app_elem.get("package", "c1eanhome1")
        else:
            app_id = "c1eanhome1.CleanHome"
            pkg_id = "c1eanhome1"
        
        app_name = app_id.split(".")[-1] if "." in app_id else "CleanHome"
        return pkg_id, app_name, version, app_id
    except Exception:
        return "c1eanhome1", "CleanHome", "1.0.0", "c1eanhome1.CleanHome"

def main():
    parser = argparse.ArgumentParser(description="Package CleanHome for Samsung Tizen TV")
    parser.add_argument("-s", "--profile", default="CleanHomeCert", help="Samsung certificate profile name")
    parser.add_argument("-t", "--target", default="<DeviceNameOrIP>", help="Target TV device name or IP for install command")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without executing")
    args = parser.parse_args()

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(project_root)

    pkg_id, app_name, version, app_id = get_app_info(project_root)

    print("=================================================================")
    print("          CleanHome Tizen TV Packaging Pipeline                  ")
    print("=================================================================")
    print(f"Project Directory : {project_root}")
    print(f"Package ID        : {pkg_id}")
    print(f"Application ID    : {app_id}")
    print(f"Version           : {version}")
    print(f"Signing Profile   : {args.profile}")
    print("=================================================================\n")

    tizen_bin = shutil.which("tizen")

    # Command lines
    exclusions = [
        "-e", ".*",
        "-e", "docs",
        "-e", "tools",
        "-e", "node_modules",
        "-e", "cleanhome-backup*",
        "-e", "*.log",
        "-e", "*.wgt",
        "-e", "package.json",
        "-e", "package-lock.json"
    ]
    
    build_cmd = ["tizen", "build-web"] + exclusions
    package_cmd = ["tizen", "package", "-t", "wgt", "-s", args.profile, "--", ".buildResult"]
    expected_wgt_names = [
        f"{app_id}.wgt",
        f"{pkg_id}-{version}.wgt",
        f"{app_name}.wgt",
        f"{pkg_id}.CleanHome.wgt"
    ]
    default_wgt_name = expected_wgt_names[0]

    if not tizen_bin or args.dry_run:
        print("[INFO] 'tizen' CLI was not found in PATH (or --dry-run specified)." if not tizen_bin else "[INFO] Running in --dry-run mode.")
        print("\nExact commands to build and package CleanHome:\n")
        print("1. Build Web Application (excluding tools, docs, backups):")
        print("   " + " ".join(build_cmd))
        print("\n2. Package the build output directory (.buildResult) into WGT:")
        print("   " + " ".join(package_cmd))
        print(f"\n3. Expected WGT Package Name: {default_wgt_name}")
        print("\n4. Install command on target Samsung TV:")
        print(f"   tizen install -n {default_wgt_name} -t {args.target}")
        print("\n5. Run command on target Samsung TV:")
        print(f"   tizen run -p {app_id} -t {args.target}")
        print("\nNote: Install Tizen Studio with Samsung Certificate Extension to enable CLI execution.")
        return 0

    print("Step 1: Running 'tizen build-web' with strict exclusions...")
    print("Command: " + " ".join(build_cmd))
    res_build = subprocess.run(build_cmd)
    if res_build.returncode != 0:
        print(f"[ERROR] 'tizen build-web' failed with exit code {res_build.returncode}")
        return res_build.returncode

    build_output_dir = os.path.join(project_root, ".buildResult")
    if not os.path.exists(build_output_dir):
        print(f"[WARNING] Build output directory not found at {build_output_dir}; checking current directory.")
        build_output_dir = project_root

    print(f"\nStep 2: Packaging BUILD OUTPUT folder ({os.path.relpath(build_output_dir, project_root)})...")
    print("Command: " + " ".join(package_cmd))
    res_pkg = subprocess.run(package_cmd)
    if res_pkg.returncode != 0:
        print(f"[ERROR] 'tizen package' failed with exit code {res_pkg.returncode}")
        return res_pkg.returncode

    # Step 3: Find generated .wgt file
    wgt_files = glob.glob(os.path.join(project_root, "*.wgt"))
    if not wgt_files:
        wgt_files = glob.glob(os.path.join(build_output_dir, "*.wgt"))

    if wgt_files:
        # Sort by modification time, newest first
        wgt_files.sort(key=os.path.getmtime, reverse=True)
        produced_wgt = wgt_files[0]
        wgt_name = os.path.basename(produced_wgt)
        wgt_size = os.path.getsize(produced_wgt)
        print("\n=================================================================")
        print(f"[SUCCESS] Package produced: {wgt_name} ({wgt_size:,d} bytes / {wgt_size/(1024*1024):.2f} MB)")
        print("=================================================================")
    else:
        wgt_name = default_wgt_name
        print(f"\n[INFO] Assumed package name: {wgt_name}")

    # Step 4: Print install and run commands
    print("\nTarget Installation & Run Commands:")
    print(f"  tizen install -n {wgt_name} -t {args.target}")
    print(f"  tizen run -p {app_id} -t {args.target}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
