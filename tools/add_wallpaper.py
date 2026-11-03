#!/usr/bin/env python3
"""Add a wallpaper image to CleanHome project.

Validates the file, cover-crops to 1920x1080,
saves optimized JPEG (quality ~82) to assets/wallpapers/NAME.jpg,
creates NAME_blur.jpg (Gaussian blur radius ~40 on half-size, upscaled) for fake glass look,
creates 320x180 thumbnail, and updates config/wallpapers.json.
"""

import sys
import os
import json
import argparse
from PIL import Image, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
WALLPAPERS_DIR = os.path.join(PROJECT_ROOT, "assets", "wallpapers")
JSON_PATH = os.path.join(PROJECT_ROOT, "config", "wallpapers.json")

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB limit
TARGET_WIDTH = 1920
TARGET_HEIGHT = 1080

os.makedirs(WALLPAPERS_DIR, exist_ok=True)


def cover_crop(img, target_w, target_h):
    img_w, img_h = img.size
    target_ratio = target_w / target_h
    img_ratio = img_w / img_h

    if img_ratio > target_ratio:
        new_w = img_h * target_ratio
        new_h = img_h
    else:
        new_w = img_w
        new_h = img_w / target_ratio

    left = (img_w - new_w) / 2
    top = (img_h - new_h) / 2
    right = (img_w + new_w) / 2
    bottom = (img_h + new_h) / 2

    img = img.crop((left, top, right, bottom))
    return img.resize((target_w, target_h), Image.LANCZOS)


def create_blur(image, blur_radius=40):
    """Gaussian blur on half-size image, upscaled back to 1920x1080."""
    small = image.resize((image.width // 2, image.height // 2), Image.BILINEAR)
    blurred = small.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    return blurred.resize(image.size, Image.BILINEAR)


def generate_thumbnail(image, width=320, height=180):
    return image.resize((width, height), Image.LANCZOS)


def process_image(image_path, name=None):
    if not os.path.isfile(image_path):
        print(f"Error: File not found: {image_path}")
        return False

    file_size = os.path.getsize(image_path)
    if file_size > MAX_FILE_SIZE:
        print(f"Error: File over 20 MB ({file_size} bytes)")
        return False

    if not name:
        name = os.path.splitext(os.path.basename(image_path))[0]

    try:
        img = Image.open(image_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        return False

    if img.mode != "RGB":
        img = img.convert("RGB")

    # 1. 1920x1080 main JPEG
    cropped = cover_crop(img, TARGET_WIDTH, TARGET_HEIGHT)
    jpg_path = os.path.join(WALLPAPERS_DIR, f"{name}.jpg")
    cropped.save(jpg_path, "JPEG", quality=82, optimize=True)

    # 2. 1920x1080 blurred JPEG for fake glass
    blurred = create_blur(cropped, blur_radius=40)
    blur_path = os.path.join(WALLPAPERS_DIR, f"{name}_blur.jpg")
    blurred.save(blur_path, "JPEG", quality=82, optimize=True)

    # 3. 320x180 thumbnail
    thumb = generate_thumbnail(cropped, 320, 180)
    thumb_path = os.path.join(WALLPAPERS_DIR, f"{name}_thumb.jpg")
    thumb.save(thumb_path, "JPEG", quality=82, optimize=True)

    # 4. Update config/wallpapers.json
    wallpapers = []
    if os.path.isfile(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                wallpapers = json.load(f)
        except Exception:
            wallpapers = []

    entry = next((w for w in wallpapers if w.get("name") == name), None)
    if entry:
        entry["path"] = f"assets/wallpapers/{name}.jpg"
        entry["blurPath"] = f"assets/wallpapers/{name}_blur.jpg"
        entry["thumbPath"] = f"assets/wallpapers/{name}_thumb.jpg"
    else:
        wallpapers.append({
            "name": name,
            "path": f"assets/wallpapers/{name}.jpg",
            "blurPath": f"assets/wallpapers/{name}_blur.jpg",
            "thumbPath": f"assets/wallpapers/{name}_thumb.jpg"
        })

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(wallpapers, f, indent=2)

    print(f"Wallpaper '{name}' successfully generated and added to {JSON_PATH}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Add a wallpaper to CleanHome")
    parser.add_argument("image", help="Path to wallpaper image")
    parser.add_argument("--name", help="Custom name for wallpaper")
    args = parser.parse_args()

    success = process_image(args.image, args.name)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

