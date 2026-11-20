"""
Shrink wedding photos for the website.

Usage (from the repo folder):
    python tools/optimize_photos.py

What it does:
- Reads every .jpg/.jpeg/.png/.heic-converted .jpg in assets/photos/originals/
- Fixes phone rotation, resizes so the long side is at most 1600 px,
  strips location data, and saves a compressed JPEG into assets/photos/
  with the same name (lower-case, .jpg).
- Originals stay untouched in assets/photos/originals/ (not uploaded to GitHub).

Needs Pillow:  pip install pillow
"""
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "photos", "originals")
DST = os.path.join(ROOT, "assets", "photos")
MAX_SIDE = 1600
QUALITY = 78


def main():
    if not os.path.isdir(SRC):
        os.makedirs(SRC)
        print(f"Created {SRC}. Put your original photos there and run this again.")
        return
    done = 0
    for name in sorted(os.listdir(SRC)):
        base, ext = os.path.splitext(name)
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        with Image.open(os.path.join(SRC, name)) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            out = os.path.join(DST, base.lower() + ".jpg")
            im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        print(f"{name} -> assets/photos/{os.path.basename(out)} ({os.path.getsize(out) // 1024} KB)")
        done += 1
    if not done:
        print("No photos found in assets/photos/originals/.")
        sys.exit(1)


if __name__ == "__main__":
    main()
