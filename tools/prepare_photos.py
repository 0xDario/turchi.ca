#!/usr/bin/env python3
"""Prepare photos for the turchi.ca photography gallery.

Workflow:
    1. Export photos as JPEGs into photos/_inbox/
       - Canon R7: export JPEGs from Lightroom/DPP (any size; the script resizes)
       - iPhone: AirDrop or export as JPEG ("Most Compatible") from Photos
       - Pentax K1000: any scanned JPEG
    2. Run:
           python3 tools/prepare_photos.py
       Film scans carry no camera EXIF, so tag those runs:
           python3 tools/prepare_photos.py --camera "Pentax K1000"
       Optionally title the photos in this batch:
           python3 tools/prepare_photos.py --title "Kensington Market"
    3. Review the result (open photography.html locally), then commit and push:
           git add photos && git commit -m "Add photos" && git push

What it does:
    - Resizes to 2048px (gallery) and 800px (thumbnail) on the long edge
    - Strips ALL metadata from the published files — GPS location never
      leaves your machine
    - Records camera / lens / exposure settings in photos/manifest.json,
      which the gallery page reads
    - Moves processed originals to photos/_inbox/processed/ (gitignored)

Requires: Pillow  (pip install Pillow)
Optional: pillow-heif to read iPhone .HEIC files directly (pip install pillow-heif)
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:
    HEIC_SUPPORTED = False

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "photos" / "_inbox"
PROCESSED = INBOX / "processed"
LARGE_DIR = ROOT / "photos" / "large"
THUMB_DIR = ROOT / "photos" / "thumbs"
MANIFEST = ROOT / "photos" / "manifest.json"

LARGE_EDGE = 2048
THUMB_EDGE = 800
LARGE_QUALITY = 85
THUMB_QUALITY = 80

# EXIF tag ids
TAG_MODEL = 0x0110
IFD_EXIF = 0x8769
TAG_EXPOSURE_TIME = 0x829A
TAG_F_NUMBER = 0x829D
TAG_ISO = 0x8827
TAG_DATETIME_ORIGINAL = 0x9003
TAG_FOCAL_LENGTH = 0x920A
TAG_LENS_MODEL = 0xA434


def camera_key(model):
    m = (model or "").lower()
    if "r7" in m:
        return "r7"
    if "iphone" in m:
        return "iphone"
    if "pentax" in m or "k1000" in m:
        return "k1000"
    return "other"


def fmt_shutter(value):
    try:
        seconds = float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if seconds <= 0:
        return None
    if seconds < 1:
        return f"1/{round(1 / seconds)}s"
    return f"{seconds:g}s"


def fmt_aperture(value):
    try:
        return f"f/{float(value):g}"
    except (TypeError, ValueError):
        return None


def fmt_focal(value):
    try:
        return f"{float(value):g}mm"
    except (TypeError, ValueError):
        return None


def fmt_iso(value):
    if isinstance(value, (tuple, list)) and value:
        value = value[0]
    try:
        return f"ISO {int(value)}"
    except (TypeError, ValueError):
        return None


def extract_metadata(image, path):
    exif = image.getexif()
    ifd = exif.get_ifd(IFD_EXIF)

    date = None
    raw_date = ifd.get(TAG_DATETIME_ORIGINAL)
    if raw_date:
        try:
            date = datetime.strptime(str(raw_date), "%Y:%m:%d %H:%M:%S").date()
        except ValueError:
            pass
    if date is None:
        date = datetime.fromtimestamp(path.stat().st_mtime).date()

    lens = ifd.get(TAG_LENS_MODEL)
    return {
        "model": str(exif.get(TAG_MODEL)).strip() if exif.get(TAG_MODEL) else None,
        "lens": str(lens).strip() if lens else None,
        "aperture": fmt_aperture(ifd.get(TAG_F_NUMBER)),
        "shutter": fmt_shutter(ifd.get(TAG_EXPOSURE_TIME)),
        "iso": fmt_iso(ifd.get(TAG_ISO)),
        "focalLength": fmt_focal(ifd.get(TAG_FOCAL_LENGTH)),
        "date": date,
    }


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "photo"


def unique_name(date, stem, taken):
    base = f"{date.strftime('%Y%m%d')}-{slugify(stem)}"
    name = f"{base}.jpg"
    counter = 2
    while name in taken or (LARGE_DIR / name).exists():
        name = f"{base}-{counter}.jpg"
        counter += 1
    taken.add(name)
    return name


def save_resized(image, edge, dest, quality):
    copy = image.copy()
    copy.thumbnail((edge, edge), Image.LANCZOS)
    # Saving without an exif argument strips all metadata from the output
    copy.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    return copy.size


def load_manifest():
    if MANIFEST.exists():
        with open(MANIFEST) as f:
            return json.load(f)
    return {"photos": []}


def main():
    parser = argparse.ArgumentParser(description="Prepare photos for the gallery")
    parser.add_argument("--camera", help='Override camera name, e.g. --camera "Pentax K1000" for film scans')
    parser.add_argument("--title", help="Title applied to every photo in this batch")
    args = parser.parse_args()

    for directory in (INBOX, PROCESSED, LARGE_DIR, THUMB_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    extensions = {".jpg", ".jpeg", ".png"}
    if HEIC_SUPPORTED:
        extensions |= {".heic", ".heif"}

    candidates = sorted(
        p for p in INBOX.iterdir()
        if p.is_file() and p.suffix.lower() in extensions
    )

    skipped_heic = [p.name for p in INBOX.iterdir()
                    if p.is_file() and p.suffix.lower() in {".heic", ".heif"} and not HEIC_SUPPORTED]
    if skipped_heic:
        print(f"Skipping {len(skipped_heic)} HEIC file(s) — install pillow-heif or export as JPEG:")
        for name in skipped_heic:
            print(f"  - {name}")

    if not candidates:
        print(f"No photos found in {INBOX.relative_to(ROOT)}/ — drop JPEG exports there first.")
        return

    manifest = load_manifest()
    taken = {entry["id"] for entry in manifest["photos"]}
    added = []

    for path in candidates:
        with Image.open(path) as opened:
            meta = extract_metadata(opened, path)
            image = ImageOps.exif_transpose(opened)
            if image.mode != "RGB":
                image = image.convert("RGB")

            camera = args.camera or meta["model"]
            key = camera_key(camera)
            if key == "other" and not args.camera:
                print(f'  note: {path.name} has no recognized camera EXIF — '
                      f'use --camera "Pentax K1000" if this is a film scan')

            name = unique_name(meta["date"], path.stem, taken)
            width, height = save_resized(image, LARGE_EDGE, LARGE_DIR / name, LARGE_QUALITY)
            save_resized(image, THUMB_EDGE, THUMB_DIR / name, THUMB_QUALITY)

        entry = {
            "id": name,
            "src": f"photos/large/{name}",
            "thumb": f"photos/thumbs/{name}",
            "width": width,
            "height": height,
            "camera": camera,
            "cameraKey": key,
            "date": meta["date"].isoformat(),
        }
        if args.title:
            entry["title"] = args.title
        for field in ("lens", "focalLength", "aperture", "shutter", "iso"):
            if meta[field]:
                entry[field] = meta[field]

        manifest["photos"].append(entry)
        added.append(entry)
        path.rename(PROCESSED / path.name)

        details = " · ".join(filter(None, [
            camera, entry.get("focalLength"), entry.get("aperture"),
            entry.get("shutter"), entry.get("iso"),
        ]))
        print(f"  + {name}  ({width}x{height})  {details}")

    manifest["photos"].sort(key=lambda p: (p["date"], p["id"]), reverse=True)
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"\nAdded {len(added)} photo(s). Manifest now lists {len(manifest['photos'])}.")
    print("Next: review locally, then  git add photos && git commit -m \"Add photos\" && git push")


if __name__ == "__main__":
    main()
