# tools/rasterize_new_icons.py
import os
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

# 1. ZEE5 (120x120 RGBA)
img_zee = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
draw = ImageDraw.Draw(img_zee)

# Draw dark circle
draw.ellipse((4, 4, 116, 116), fill=(26, 21, 40, 255))

# Draw colored arcs
draw.arc((10, 10, 110, 110), start=0, end=140, fill=(255, 19, 97, 255), width=5)
draw.arc((10, 10, 110, 110), start=160, end=270, fill=(255, 248, 0, 255), width=5)
draw.arc((10, 10, 110, 110), start=290, end=340, fill=(0, 229, 255, 255), width=5)

draw.arc((18, 18, 102, 102), start=45, end=200, fill=(142, 45, 226, 255), width=4)
draw.arc((18, 18, 102, 102), start=240, end=360, fill=(74, 0, 224, 255), width=4)

# ZEE5 text
try:
    font = ImageFont.truetype(os.path.join(os.path.dirname(__file__), "..", "assets", "outfit.ttf"), 22)
except Exception:
    font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), "ZEE5", font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
draw.text(((120 - tw) // 2, (120 - th) // 2), "ZEE5", fill=(255, 255, 255, 255), font=font)

zee_path = os.path.join(ICONS_DIR, "zee5.png")
img_zee.save(zee_path, "PNG")
print(f"Saved {zee_path} ({os.path.getsize(zee_path)} bytes)")

# 2. Sony LIV (120x120 RGBA)
img_sony = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
draw = ImageDraw.Draw(img_sony)

# Rounded rectangle
draw.rounded_rectangle((6, 6, 114, 114), radius=22, fill=(12, 13, 20, 255), outline=(255, 255, 255, 30), width=1)

try:
    font_sony = ImageFont.truetype(os.path.join(os.path.dirname(__file__), "..", "assets", "outfit.ttf"), 18)
    font_liv = ImageFont.truetype(os.path.join(os.path.dirname(__file__), "..", "assets", "outfit.ttf"), 30)
except Exception:
    font_sony = ImageFont.load_default()
    font_liv = ImageFont.load_default()

bbox_s = draw.textbbox((0, 0), "SONY", font=font_sony)
sw = bbox_s[2] - bbox_s[0]
draw.text(((120 - sw) // 2, 26), "SONY", fill=(255, 255, 255, 255), font=font_sony)

bbox_l = draw.textbbox((0, 0), "liv", font=font_liv)
lw = bbox_l[2] - bbox_l[0]
draw.text(((120 - lw) // 2, 54), "liv", fill=(245, 158, 11, 255), font=font_liv)

# Gradient underline
draw.line(((120 - lw) // 2 - 4, 92, (120 + lw) // 2 + 4, 92), fill=(59, 130, 246, 255), width=3)

sony_path = os.path.join(ICONS_DIR, "sonyliv.png")
img_sony.save(sony_path, "PNG")
print(f"Saved {sony_path} ({os.path.getsize(sony_path)} bytes)")

