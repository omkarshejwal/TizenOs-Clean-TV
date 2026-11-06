#!/usr/bin/env python3
"""tools/make_hero_backgrounds.py - Generate pre-blurred, color-graded hero backgrounds per app.

Pillow only. Creates 960x540 JPEGs under 60 KB each.
If an app specifies a backgroundImage in config/hero.json, it cover-crops, blurs, and darkens it.
Otherwise, generates a smooth multi-stop gradient with soft organic shapes based on the app's accent color.
"""

import os
import sys
import json
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS_JSON = os.path.join(PROJECT_ROOT, "config", "apps.json")
HERO_JSON = os.path.join(PROJECT_ROOT, "config", "hero.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "assets", "hero_backgrounds")

TARGET_WIDTH = 960
TARGET_HEIGHT = 540
MAX_BYTES = 60 * 1024  # 60 KB limit

os.makedirs(OUTPUT_DIR, exist_ok=True)


def hex_to_rgb(hex_str):
    h = hex_str.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def generate_gradient_background(accent_hex, app_name):
    """Generate smooth multi-stop gradient with organic soft shapes from accent color."""
    rgb = hex_to_rgb(accent_hex)

    # Base canvas: dark charcoal/black (#08080C)
    img = Image.new("RGB", (TARGET_WIDTH, TARGET_HEIGHT), (8, 8, 12))

    # Render on high-res scratch layer for smooth blur
    scratch = Image.new("RGBA", (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(scratch)

    # 1. Broad deep ambient glow in upper-left and center
    # Scale accent color with varying intensities
    r, g, b = rgb
    dark_accent = (int(r * 0.45), int(g * 0.45), int(b * 0.45))
    bright_accent = (int(min(255, r * 1.1)), int(min(255, g * 1.1)), int(min(255, b * 1.1)))

    # Large soft radial shape on top-right / center (mimicking the atmospheric flow in reference image)
    draw.ellipse((200, -80, 880, 480), fill=(*dark_accent, 140))
    # Soft secondary cloud on middle-left
    draw.ellipse((-100, 100, 520, 600), fill=(*bright_accent, 110))
    # Subtle accent pool near dock bottom
    draw.ellipse((100, 360, 860, 640), fill=(*dark_accent, 90))
    # Highlight orb in upper center
    draw.ellipse((380, 60, 720, 340), fill=(*bright_accent, 130))

    # Apply heavy Gaussian blur to create smooth cinematic blend
    scratch = scratch.filter(ImageFilter.GaussianBlur(65))

    # Composite over base
    img.paste(scratch, (0, 0), scratch)

    # Add very subtle vignette darkening along edges for TV contrast
    vignette = Image.new("RGBA", (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    vdraw.rectangle((0, 0, TARGET_WIDTH, TARGET_HEIGHT), fill=(0, 0, 0, 60))
    # Darken bottom dock region slightly so tiles and text have crisp contrast
    vdraw.rectangle((0, int(TARGET_HEIGHT * 0.65), TARGET_WIDTH, TARGET_HEIGHT), fill=(0, 0, 0, 80))
    vignette = vignette.filter(ImageFilter.GaussianBlur(30))
    img.paste(vignette, (0, 0), vignette)

    return img


def process_custom_background(image_path):
    """Cover-crop, blur, and darken custom image."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    target_ratio = TARGET_WIDTH / TARGET_HEIGHT
    current_ratio = w / h

    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        offset = (w - new_w) // 2
        img = img.crop((offset, 0, offset + new_w, h))
    else:
        new_h = int(w / target_ratio)
        offset = (h - new_h) // 2
        img = img.crop((0, offset, w, offset + new_h))

    img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)
    img = img.filter(ImageFilter.GaussianBlur(28))

    # Darken
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(0.55)
    return img


def main():
    print("=================================================================")
    print("       CleanHome Hero Backgrounds Generator (Pillow)             ")
    print("=================================================================\n")

    if not os.path.exists(APPS_JSON):
        print(f"Error: {APPS_JSON} not found!")
        sys.exit(1)

    with open(APPS_JSON, "r", encoding="utf-8") as f:
        apps_data = json.load(f)

    hero_data = {}
    if os.path.exists(HERO_JSON):
        with open(HERO_JSON, "r", encoding="utf-8") as f:
            hero_data = json.load(f)

    brand_colors = apps_data.get("brand-colors", {})
    tiles = apps_data.get("tiles", [])

    generated_count = 0

    for tile in tiles:
        app_id = tile.get("appId", "")
        name = tile.get("name", "app")
        icon = tile.get("icon", name.lower())
        accent = brand_colors.get(icon, "#555555")

        app_hero = hero_data.get(app_id, {}) or hero_data.get(icon, {})
        custom_bg = app_hero.get("backgroundImage")

        out_name = f"{icon}.jpg"
        out_path = os.path.join(OUTPUT_DIR, out_name)

        if custom_bg and os.path.exists(os.path.join(PROJECT_ROOT, custom_bg)):
            print(f"  Processing custom background for {name} ({custom_bg})...")
            bg_img = process_custom_background(os.path.join(PROJECT_ROOT, custom_bg))
        else:
            print(f"  Generating procedural gradient background for {name} ({accent})...")
            bg_img = generate_gradient_background(accent, name)

        # Save JPEG with quality tuned to stay well under 60 KB
        quality = 85
        bg_img.save(out_path, "JPEG", quality=quality, optimize=True)

        size = os.path.getsize(out_path)
        while size > MAX_BYTES and quality > 40:
            quality -= 5
            bg_img.save(out_path, "JPEG", quality=quality, optimize=True)
            size = os.path.getsize(out_path)

        print(f"    [OK] Saved {out_name}: {size} bytes ({size / 1024:.1f} KB, quality={quality})")
        generated_count += 1

    # Also generate default/neutral fallback
    fallback_path = os.path.join(OUTPUT_DIR, "default.jpg")
    default_img = generate_gradient_background("#4A5568", "default")
    default_img.save(fallback_path, "JPEG", quality=82, optimize=True)
    print(f"  [OK] Saved default.jpg: {os.path.getsize(fallback_path)} bytes")

    print(f"\nCompleted: generated {generated_count + 1} hero backgrounds in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

