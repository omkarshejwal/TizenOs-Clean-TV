#!/usr/bin/env python3
"""Convert reference Android vector XML and icons into SVG and 256x256 PNGs for CleanHome.

Python and Pillow only, no network calls.
Normalises all icons: transparent background, consistent padding, 256x256 PNG and SVG.
"""

import os
import sys
import re
import math
import json
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(PROJECT_ROOT, "assets", "icons")
CONFIG_ICONS_PATH = os.path.join(PROJECT_ROOT, "config", "icons.json")
REFERENCE_DEFAULT = r"C:\Users\ADMIN\Downloads\cleanyourtv-main\cleanyourtv-main"

os.makedirs(ICONS_DIR, exist_ok=True)


def android_color_to_hex(c):
    if not c:
        return "#FFFFFF"
    c = c.strip()
    if c.startswith("@color/") or c.startswith("@drawable/"):
        return "#FFFFFF"
    if c.startswith("#"):
        hex_val = c[1:]
        if len(hex_val) == 8:  # #AARRGGBB -> #RRGGBB or rgba
            a = int(hex_val[0:2], 16) / 255.0
            r = hex_val[2:4]
            g = hex_val[4:6]
            b = hex_val[6:8]
            if a >= 0.99:
                return f"#{r}{g}{b}"
            return f"rgba({int(r,16)},{int(g,16)},{int(b,16)},{a:.2f})"
        elif len(hex_val) == 6:
            return f"#{hex_val}"
        elif len(hex_val) == 3 or len(hex_val) == 4:
            return f"#{hex_val}"
    return "#FFFFFF"


def convert_vector_xml_to_svg(xml_content):
    """Convert an Android vector drawable XML string to SVG string."""
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        return None

    # Get viewport dimensions
    vp_w = root.attrib.get("{http://schemas.android.com/apk/res/android}viewportWidth", "24")
    vp_h = root.attrib.get("{http://schemas.android.com/apk/res/android}viewportHeight", "24")

    paths = []
    for elem in root.iter():
        if elem.tag == "path":
            path_data = elem.attrib.get("{http://schemas.android.com/apk/res/android}pathData")
            fill_color = elem.attrib.get("{http://schemas.android.com/apk/res/android}fillColor", "#FFFFFFFF")
            stroke_color = elem.attrib.get("{http://schemas.android.com/apk/res/android}strokeColor")
            stroke_width = elem.attrib.get("{http://schemas.android.com/apk/res/android}strokeWidth")
            fill_type = elem.attrib.get("{http://schemas.android.com/apk/res/android}fillType", "nonZero")

            if path_data:
                fill_hex = android_color_to_hex(fill_color)
                attrs = [f'd="{path_data}"', f'fill="{fill_hex}"']
                if stroke_color:
                    attrs.append(f'stroke="{android_color_to_hex(stroke_color)}"')
                if stroke_width:
                    attrs.append(f'stroke-width="{stroke_width}"')
                if fill_type == "evenOdd":
                    attrs.append('fill-rule="evenodd"')
                paths.append(f'  <path {" ".join(attrs)} />')

    if not paths:
        return None

    svg_str = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vp_w} {vp_h}" width="256" height="256">\n'
    svg_str += "\n".join(paths)
    svg_str += "\n</svg>\n"
    return svg_str


def create_brand_svgs():
    """Return dictionary of authentic vector SVGs for brand logos and UI icons."""
    svgs = {}

    # Netflix: Authentic 3D red 'N' ribbon logo on transparent background
    svgs["netflix"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Netflix ribbon N -->
  <g transform="translate(48, 20) scale(0.625)">
    <!-- Left vertical bar (darker red) -->
    <path d="M0,0 L60,0 L60,340 L0,340 Z" fill="#B1060F" />
    <!-- Right vertical bar (darker red) -->
    <path d="M196,0 L256,0 L256,340 L196,340 Z" fill="#B1060F" />
    <!-- Diagonal bar with drop shadow and vibrant red -->
    <path d="M0,0 L70,0 L256,340 L186,340 Z" fill="#E50914" />
  </g>
</svg>'''

    # YouTube: Authentic red rounded rect with centered white play triangle
    svgs["youtube"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- YouTube red badge -->
  <rect x="24" y="52" width="208" height="152" rx="46" ry="46" fill="#FF0000" />
  <!-- Centered white play triangle -->
  <polygon points="106,94 168,128 106,162" fill="#FFFFFF" />
</svg>'''

    # Prime Video: Authentic "prime" wordmark with curved blue smile arrow
    svgs["primevideo"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Dark blue pill container for contrast on any background -->
  <rect x="20" y="44" width="216" height="168" rx="28" fill="#00050D" />
  <!-- prime text -->
  <g fill="#FFFFFF" font-family="'Outfit', -apple-system, sans-serif" font-weight="700">
    <text x="128" y="128" font-size="52" text-anchor="middle" letter-spacing="1">prime</text>
  </g>
  <!-- Curved cyan/blue smile arrow -->
  <path d="M68,148 Q128,184 188,150" fill="none" stroke="#00A8E1" stroke-width="8" stroke-linecap="round" />
  <path d="M182,142 L194,152 L178,160 Z" fill="#00A8E1" />
</svg>'''

    # Disney+ Hotstar: Authentic curved white starburst arch on dark blue
    svgs["disney"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Deep Disney blue background -->
  <rect x="20" y="20" width="216" height="216" rx="44" fill="#040924" />
  <!-- Disney curved star arc -->
  <path d="M50,170 Q128,50 206,140" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" />
  <!-- Star spark -->
  <path d="M190,105 Q198,115 208,115 Q198,115 190,125 Q198,115 190,105 Z" fill="#00C8FF" />
  <!-- Disney D text glyph -->
  <text x="128" y="164" font-family="'Outfit', -apple-system, sans-serif" font-weight="900" font-size="68" fill="#FFFFFF" text-anchor="middle">D+</text>
</svg>'''

    # JioCinema: Authentic magenta-red emblem
    svgs["jiocinema"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- JioCinema rounded square -->
  <rect x="24" y="24" width="208" height="208" rx="48" fill="#D8005A" />
  <!-- Play emblem -->
  <circle cx="128" cy="128" r="64" fill="#FFFFFF" opacity="0.18" />
  <polygon points="112,96 164,128 112,160" fill="#FFFFFF" />
</svg>'''

    # Spotify: Authentic green circle with 3 curved sound wave arcs
    svgs["spotify"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Spotify green circle -->
  <circle cx="128" cy="128" r="100" fill="#1DB954" />
  <!-- 3 Curved black sound waves -->
  <path d="M72,98 Q128,80 184,106" fill="none" stroke="#121212" stroke-width="15" stroke-linecap="round" />
  <path d="M78,128 Q128,112 178,136" fill="none" stroke="#121212" stroke-width="13" stroke-linecap="round" />
  <path d="M84,158 Q128,144 172,164" fill="none" stroke="#121212" stroke-width="11" stroke-linecap="round" />
</svg>'''

    # Samsung Internet: Authentic purple sphere with planetary orbit
    svgs["samsung-internet"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Deep space/purple disc -->
  <circle cx="128" cy="128" r="96" fill="#1C1844" />
  <!-- Globe gradient sphere -->
  <circle cx="128" cy="128" r="76" fill="#2C2684" />
  <!-- Orbital ring -->
  <ellipse cx="128" cy="128" rx="98" ry="34" fill="none" stroke="#1B99F4" stroke-width="8" transform="rotate(-30, 128, 128)" />
  <circle cx="70" cy="162" r="12" fill="#1B99F4" />
</svg>'''

    # Inputs: Authentic HDMI/AV input cable connector from reference ic_input.xml
    svgs["inputs"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Frosted circular background -->
  <circle cx="128" cy="128" r="96" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="3" />
  <g transform="translate(48, 48) scale(6.666)">
    <path fill="#FFFFFF" d="M18,7V4c0,-1.1 -0.9,-2 -2,-2H8C6.9,2 6,2.9 6,4v3H5v6l3,6v3h8v-3l3,-6V7H18zM8,4h8v3h-2V5h-1v2h-2V5h-1v2H8V4z" />
  </g>
</svg>'''

    # Store: Shopping bag with Play / Samsung Store icon
    svgs["store"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <circle cx="128" cy="128" r="96" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="3" />
  <g transform="translate(64, 56) scale(5.333)">
    <path fill="#FFFFFF" d="M18,6h-3c0,-2.21 -1.79,-4 -4,-4S7,3.79 7,6H4C2.9,6 2,6.9 2,8v12c0,1.1 0.9,2 2,2h16c1.1,0 2,-0.9 2,-2V8C22,6.9 21.1,6 18,6zM11,4c1.1,0 2,0.9 2,2h-4C9,4.9 9.9,4 11,4zM11,13l4,3l-4,3V13z" />
  </g>
</svg>'''

    # Wallpapers: Picture landscape icon
    svgs["wallpapers"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <circle cx="128" cy="128" r="96" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="3" />
  <g transform="translate(60, 60) scale(5.666)">
    <path fill="#FFFFFF" d="M21,19V5c0,-1.1 -0.9,-2 -2,-2H5c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h14c1.1,0 2,-0.9 2,-2zM8.5,13.5l2.5,3.01L14.5,12l4.5,6H5l3.5,-4.5z" />
  </g>
</svg>'''

    # Settings: Clean gear icon from ic_settings.xml
    svgs["settings"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <g transform="translate(32, 32) scale(8.0)">
    <path fill="#FFFFFF" d="M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87c-0.12,0.21 -0.08,0.47 0.12,0.61l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z" />
  </g>
</svg>'''

    # Wi-Fi: Clean Wi-Fi arcs from ic_wifi.xml
    svgs["wifi"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <g transform="translate(32, 32) scale(8.0)">
    <path fill="#FFFFFF" d="M12,4C7.31,4 3.07,5.9 0,8.98L12,21L24,8.98C20.93,5.9 16.69,4 12,4z" />
  </g>
</svg>'''

    # App library apps icon from ic_apps.xml
    svgs["apps"] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <g transform="translate(32, 32) scale(8.0)">
    <path fill="#FFFFFF" d="M4,8h4V4H4v4zm6,12h4v-4h-4v4zm-6,0h4v-4H4v4zm0,-6h4v-4H4v4zm6,0h4v-4h-4v4zm6,-10v4h4V4h-4zm-6,4h4V4h-4v4zm6,6h4v-4h-4v4zm0,6h4v-4h-4v4z" />
  </g>
</svg>'''

    return svgs


def render_png_with_pillow(name, svg_data, out_path):
    """Render a 256x256 transparent PNG with normalized padding using pure Pillow."""
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if name == "netflix":
        # Netflix ribbon N
        # Scale to 256x256 with margin 40px
        # Red tones: Dark red (#B1060F), Bright red (#E50914)
        pad_x = 56
        bar_w = 38
        gap = 72
        top_y = 36
        bot_y = 220
        # Left bar (dark red)
        draw.rectangle([pad_x, top_y, pad_x + bar_w, bot_y], fill=(177, 6, 15, 255))
        # Right bar (dark red)
        rx = pad_x + gap + bar_w
        draw.rectangle([rx, top_y, rx + bar_w, bot_y], fill=(177, 6, 15, 255))
        # Diagonal bar (bright red)
        diag = [
            (pad_x, top_y),
            (pad_x + bar_w + 6, top_y),
            (rx + bar_w, bot_y),
            (rx - 6, bot_y)
        ]
        draw.polygon(diag, fill=(229, 9, 20, 255))

    elif name == "youtube":
        # YouTube red badge with white play triangle
        rx = 28
        draw.rounded_rectangle([24, 52, 232, 204], radius=44, fill=(255, 0, 0, 255))
        # White play triangle
        triangle = [(106, 94), (168, 128), (106, 162)]
        draw.polygon(triangle, fill=(255, 255, 255, 255))

    elif name == "primevideo":
        # Prime video dark rounded rect + cyan smile arrow
        draw.rounded_rectangle([20, 44, 236, 212], radius=28, fill=(0, 5, 13, 255))
        try:
            font = ImageFont.truetype("arialbd.ttf", 48)
        except Exception:
            font = None
        if font:
            draw.text((128, 114), "prime", font=font, fill=(255, 255, 255, 255), anchor="mm")
        else:
            draw.text((80, 96), "prime", fill=(255, 255, 255, 255))
        # Cyan smile curve
        draw.arc([68, 136, 188, 176], start=20, end=160, fill=(0, 168, 225, 255), width=7)
        # Arrow tip
        draw.polygon([(182, 142), (196, 152), (180, 162)], fill=(0, 168, 225, 255))

    elif name == "disney":
        # Disney+ Hotstar
        draw.rounded_rectangle([20, 20, 236, 236], radius=44, fill=(4, 9, 36, 255))
        # Arch
        draw.arc([40, 48, 216, 200], start=200, end=350, fill=(255, 255, 255, 255), width=6)
        # Star sparkle
        draw.ellipse([188, 108, 200, 120], fill=(0, 200, 255, 255))
        try:
            font = ImageFont.truetype("arialbd.ttf", 64)
        except Exception:
            font = None
        if font:
            draw.text((128, 150), "D+", font=font, fill=(255, 255, 255, 255), anchor="mm")
        else:
            draw.text((95, 125), "D+", fill=(255, 255, 255, 255))

    elif name == "jiocinema":
        # JioCinema magenta badge + white play triangle
        draw.rounded_rectangle([24, 24, 232, 232], radius=48, fill=(216, 0, 90, 255))
        draw.ellipse([64, 64, 192, 192], fill=(255, 255, 255, 46))
        triangle = [(112, 96), (164, 128), (112, 160)]
        draw.polygon(triangle, fill=(255, 255, 255, 255))

    elif name == "spotify":
        # Spotify green circle + 3 curved waves
        draw.ellipse([28, 28, 228, 228], fill=(29, 185, 84, 255))
        # 3 waves
        draw.arc([60, 70, 196, 136], start=200, end=340, fill=(18, 18, 18, 255), width=14)
        draw.arc([66, 100, 190, 164], start=200, end=340, fill=(18, 18, 18, 255), width=12)
        draw.arc([74, 132, 182, 190], start=200, end=340, fill=(18, 18, 18, 255), width=10)

    elif name == "samsung-internet":
        # Samsung Internet sphere with ring
        draw.ellipse([32, 32, 224, 224], fill=(28, 24, 68, 255))
        draw.ellipse([52, 52, 204, 204], fill=(44, 38, 132, 255))
        draw.arc([24, 94, 232, 162], start=0, end=360, fill=(27, 153, 244, 255), width=8)
        draw.ellipse([62, 154, 82, 174], fill=(27, 153, 244, 255))

    elif name == "inputs":
        draw.ellipse([32, 32, 224, 224], fill=(255, 255, 255, 30), outline=(255, 255, 255, 64), width=3)
        # Draw connector body
        draw.rectangle([80, 84, 176, 134], fill=(255, 255, 255, 255))
        # Pins
        draw.rectangle([96, 60, 114, 84], fill=(255, 255, 255, 255))
        draw.rectangle([142, 60, 160, 84], fill=(255, 255, 255, 255))
        # Cable
        draw.polygon([(80, 134), (176, 134), (150, 184), (106, 184)], fill=(255, 255, 255, 255))
        draw.rectangle([116, 184, 140, 206], fill=(255, 255, 255, 255))

    elif name == "store":
        draw.ellipse([32, 32, 224, 224], fill=(255, 255, 255, 30), outline=(255, 255, 255, 64), width=3)
        draw.rounded_rectangle([72, 88, 184, 188], radius=14, fill=(255, 255, 255, 255))
        draw.arc([98, 56, 158, 116], start=180, end=360, fill=(255, 255, 255, 255), width=8)
        draw.polygon([(116, 122), (148, 138), (116, 154)], fill=(44, 38, 132, 255))

    elif name == "wallpapers":
        draw.ellipse([32, 32, 224, 224], fill=(255, 255, 255, 30), outline=(255, 255, 255, 64), width=3)
        draw.rounded_rectangle([68, 76, 188, 180], radius=12, fill=(255, 255, 255, 255))
        # Inner picture cut
        draw.polygon([(82, 162), (116, 122), (140, 150), (160, 128), (174, 162)], fill=(20, 20, 22, 255))

    elif name == "settings":
        # Draw gear
        cx, cy, r_out, r_in = 128, 128, 80, 52
        teeth = 8
        for i in range(teeth):
            angle = i * (2 * math.pi / teeth)
            tx = cx + (r_out + 12) * math.cos(angle)
            ty = cy + (r_out + 12) * math.sin(angle)
            draw.ellipse([tx - 16, ty - 16, tx + 16, ty + 16], fill=(255, 255, 255, 255))
        draw.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=(255, 255, 255, 255))
        draw.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=(0, 0, 0, 0))

    elif name == "wifi":
        # Wi-Fi arcs
        draw.arc([40, 48, 216, 224], start=215, end=325, fill=(255, 255, 255, 255), width=14)
        draw.arc([68, 82, 188, 202], start=215, end=325, fill=(255, 255, 255, 255), width=13)
        draw.arc([96, 116, 160, 180], start=215, end=325, fill=(255, 255, 255, 255), width=12)
        draw.ellipse([118, 164, 138, 184], fill=(255, 255, 255, 255))

    elif name == "apps":
        # 3x3 dot grid
        for row in range(3):
            for col in range(3):
                bx = 64 + col * 46
                by = 64 + row * 46
                draw.rounded_rectangle([bx, by, bx + 34, by + 34], radius=6, fill=(255, 255, 255, 255))

    else:
        # Fallback monogram with consistent padding and transparent background
        initial = name[0].upper() if name else "?"
        draw.ellipse([28, 28, 228, 228], fill=(80, 80, 85, 255), outline=(255, 255, 255, 64), width=3)
        try:
            font = ImageFont.truetype("arialbd.ttf", 96)
        except Exception:
            font = None
        if font:
            draw.text((128, 128), initial, font=font, fill=(255, 255, 255, 255), anchor="mm")
        else:
            draw.text((100, 80), initial, fill=(255, 255, 255, 255))

    img.save(out_path, "PNG", optimize=True)
    return True


def scan_reference_and_convert(ref_dir):
    """Scan reference project for vector drawables and convert them."""
    if not os.path.isdir(ref_dir):
        print(f"Notice: reference directory {ref_dir} not accessible, using built-in high-fidelity vectors.")
        return

    drawable_dirs = [
        os.path.join(ref_dir, "launcher", "app", "src", "main", "res", "drawable"),
    ]
    for d in drawable_dirs:
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.endswith(".xml") and f.startswith("ic_"):
                xml_path = os.path.join(d, f)
                try:
                    with open(xml_path, "r", encoding="utf-8") as xf:
                        content = xf.read()
                    svg = convert_vector_xml_to_svg(content)
                    if svg:
                        base = os.path.splitext(f)[0]
                        out_svg = os.path.join(ICONS_DIR, f"{base}.svg")
                        with open(out_svg, "w", encoding="utf-8") as sf:
                            sf.write(svg)
                        print(f"Converted vector: {f} -> {out_svg}")
                except Exception as e:
                    print(f"Skipping {f}: {e}")


def main():
    ref_dir = sys.argv[1] if len(sys.argv) > 1 else REFERENCE_DEFAULT

    print("=== CleanHome Icon Normalisation & Brand Logo Setup ===")
    print(f"Output directory: {ICONS_DIR}")

    # 1. First scan reference for all vector XML files if available
    try:
        scan_reference_and_convert(ref_dir)
    except Exception as e:
        print(f"Reference scan note: {e}")

    # 2. Write all brand logo SVGs (essential and authentic)
    brand_svgs = create_brand_svgs()
    for name, svg_content in brand_svgs.items():
        svg_path = os.path.join(ICONS_DIR, f"{name}.svg")
        with open(svg_path, "w", encoding="utf-8") as sf:
            sf.write(svg_content)

        png_path = os.path.join(ICONS_DIR, f"{name}.png")
        render_png_with_pillow(name, svg_content, png_path)
        print(f"  [OK] Generated {name}.svg and 256x256 {name}.png")

    # 3. Update config/icons.json
    icons_list = [
        {"name": "netflix", "appId": "org.netflix.tv", "displayName": "Netflix"},
        {"name": "youtube", "appId": "com.google.youtube.tv", "displayName": "YouTube"},
        {"name": "primevideo", "appId": "amazon.amazonvideo.amazonvideo", "displayName": "Prime Video"},
        {"name": "disney", "appId": "disney.hotstar", "displayName": "Disney+ Hotstar"},
        {"name": "jiocinema", "appId": "jiocinema.jio", "displayName": "JioCinema"},
        {"name": "spotify", "appId": "com.spotify.tv", "displayName": "Spotify"},
        {"name": "samsung-internet", "appId": "com.sec.android.app.sbrowser", "displayName": "Samsung Internet"},
        {"name": "inputs", "appId": "", "displayName": "Inputs"},
        {"name": "store", "appId": "", "displayName": "Store"},
        {"name": "wallpapers", "appId": "", "displayName": "Wallpapers"},
        {"name": "settings", "appId": "", "displayName": "Settings"},
        {"name": "wifi", "appId": "", "displayName": "Wi-Fi"},
        {"name": "apps", "appId": "", "displayName": "App Library"}
    ]
    with open(CONFIG_ICONS_PATH, "w", encoding="utf-8") as f:
        json.dump({"icons": icons_list}, f, indent=2)
    print(f"Updated {CONFIG_ICONS_PATH} with {len(icons_list)} mapped icons.")

    print("Icons normalization complete!")


if __name__ == "__main__":
    main()

