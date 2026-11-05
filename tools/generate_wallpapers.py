import os
import math
import hashlib
from PIL import Image, ImageFilter

WALLPAPERS = [
    {
        "name": "gradient1",
        "title": "Sunset Glow",
        # Coral, rose pink, magenta, deep violet
        "stops": [
            (0.0, (235, 77, 75)),
            (0.4, (165, 42, 100)),
            (0.7, (88, 24, 88)),
            (1.0, (26, 11, 46))
        ],
        "center": (0.3, 0.4)
    },
    {
        "name": "gradient2",
        "title": "Emerald Aurora",
        # Electric mint, emerald green, dark forest, obsidian teal
        "stops": [
            (0.0, (46, 213, 115)),
            (0.35, (16, 120, 90)),
            (0.7, (8, 60, 52)),
            (1.0, (6, 26, 28))
        ],
        "center": (0.7, 0.3)
    },
    {
        "name": "gradient3",
        "title": "Deep Indigo",
        # Electric royal violet, indigo, dark sapphire, midnight
        "stops": [
            (0.0, (112, 111, 211)),
            (0.4, (58, 45, 140)),
            (0.75, (25, 20, 78)),
            (1.0, (12, 10, 36))
        ],
        "center": (0.5, 0.5)
    },
    {
        "name": "nightsky",
        "title": "Night Sky",
        # Very dark obsidian, midnight navy, faint nebula purple, deep black
        "stops": [
            (0.0, (44, 44, 84)),
            (0.35, (28, 28, 56)),
            (0.7, (15, 15, 32)),
            (1.0, (8, 8, 16))
        ],
        "center": (0.2, 0.2)
    },
    {
        "name": "ocean",
        "title": "Ocean Breeze",
        # Vibrant cyan, aquamarine, tropical azure, deep abyss blue
        "stops": [
            (0.0, (0, 210, 211)),
            (0.35, (10, 120, 175)),
            (0.7, (6, 62, 105)),
            (1.0, (4, 25, 52))
        ],
        "center": (0.8, 0.6)
    },
    {
        "name": "sunset",
        "title": "Dusk Horizon",
        # Golden amber, flame orange, crimson red, dark plum
        "stops": [
            (0.0, (255, 177, 66)),
            (0.35, (238, 90, 36)),
            (0.7, (150, 25, 45)),
            (1.0, (40, 10, 25))
        ],
        "center": (0.5, 0.8)
    }
]

def render_gradient_lowres(w, h, stops, center):
    cx = center[0] * w
    cy = center[1] * h
    max_dist = math.hypot(max(cx, w - cx), max(cy, h - cy))

    img = Image.new('RGB', (w, h))
    pixels = img.load()

    for y in range(h):
        for x in range(w):
            dist = math.hypot(x - cx, y - cy) / max_dist
            if dist > 1.0:
                dist = 1.0
            
            # Interpolate stops
            for i in range(len(stops) - 1):
                p0, c0 = stops[i]
                p1, c1 = stops[i + 1]
                if p0 <= dist <= p1:
                    t = (dist - p0) / (p1 - p0)
                    r = int(c0[0] + t * (c1[0] - c0[0]))
                    g = int(c0[1] + t * (c1[1] - c0[1]))
                    b = int(c0[2] + t * (c1[2] - c0[2]))
                    pixels[x, y] = (r, g, b)
                    break
    return img

def generate_all():
    out_dir = 'assets/wallpapers'
    os.makedirs(out_dir, exist_ok=True)
    
    hashes = {}

    for wp in WALLPAPERS:
        name = wp["name"]
        print(f"Generating wallpaper '{name}' ({wp['title']})...")
        
        # Render at 480x270 for smooth interpolation, then scale to 1920x1080 with BICUBIC
        base_lowres = render_gradient_lowres(480, 270, wp["stops"], wp["center"])
        img = base_lowres.resize((1920, 1080), Image.Resampling.BICUBIC)
        
        base_path = os.path.join(out_dir, f"{name}.jpg")
        img.save(base_path, "JPEG", quality=92, optimize=True)

        # 2. Blur 1920x1080 (Gaussian blur radius 36)
        blur_img = img.filter(ImageFilter.GaussianBlur(radius=36))
        blur_path = os.path.join(out_dir, f"{name}_blur.jpg")
        blur_img.save(blur_path, "JPEG", quality=90, optimize=True)

        # 3. Thumbnail 320x180
        thumb_img = img.resize((320, 180), Image.Resampling.LANCZOS)
        thumb_path = os.path.join(out_dir, f"{name}_thumb.jpg")
        thumb_img.save(thumb_path, "JPEG", quality=85, optimize=True)

        with open(base_path, 'rb') as fp:
            h = hashlib.sha256(fp.read()).hexdigest()
        hashes[name] = h

    print("\n--- HASH UNIQUENESS REPORT ---")
    seen = {}
    duplicates = 0
    for name, h in hashes.items():
        if h in seen:
            print(f"[FAIL] DUPLICATE: {name} matches {seen[h]}!")
            duplicates += 1
        else:
            seen[h] = name
            print(f"[OK] {name:15s} SHA256: {h[:20]}... UNIQUE")

    if duplicates == 0:
        print("\nAll 6 wallpapers are 100% unique files with zero duplicate hashes.")

if __name__ == '__main__':
    generate_all()
