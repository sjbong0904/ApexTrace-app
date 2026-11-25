"""
Build downscaled copies of the large images in public/images into public/images/preview/.

The app shows most of these images far smaller than their source size (a 4096² map in a
440px panel, a 1700px weapon render in a 48px card). Decoding the full file on every tab
switch costs ~100ms per map and makes the page repaint in several pieces.
The app loads the preview first (see previewImageUrl in src/utils/imageSource.ts) and only
loads the full map when the user zooms in or goes fullscreen.

Run after scripts/fetch-local-images.mjs (needs Pillow):
    python scripts/make-image-previews.py          # only missing / outdated previews
    python scripts/make-image-previews.py --force  # rebuild all
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'images'
OUT = ROOT / 'preview'

# Match map backgrounds: square 4096² sources. 1024 covers the 440px panel at 2x DPI.
MAP_FILES = {
    'worlds_edge_s30.png', 'worlds_edge_s29.png', 'olympus.png', 'storm_point.png',
    'kings_canyon.png', 'broken_moon.png', 'e_district.png',
}
MAP_SIZE = 1024
# Weapon renders and other large art: the biggest on-screen use is ~300px wide.
OTHER_MAX = 640


def target_size(name: str, size: tuple[int, int]) -> tuple[int, int] | None:
    limit = MAP_SIZE if name in MAP_FILES else OTHER_MAX
    w, h = size
    longest = max(w, h)
    if longest <= limit:
        return None
    ratio = limit / longest
    return max(1, round(w * ratio)), max(1, round(h * ratio))


def main() -> None:
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    made = skipped = 0
    for src in sorted(ROOT.glob('*.png')):
        name = src.name
        # Thumbnails are already sized for their cards; silhouettes are masks, small already.
        if name.startswith('thumbnail-') or name.endswith('_silhouette.png'):
            continue
        dest = OUT / name
        if not force and dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            continue
        with Image.open(src) as im:
            size = target_size(name, im.size)
            if size is None:
                continue
            im.load()
            small = im.resize(size, Image.LANCZOS)
            small.save(dest, optimize=True)
        made += 1
        print(f'{name}: {src.stat().st_size // 1024}KB -> {dest.stat().st_size // 1024}KB {size[0]}x{size[1]}')
    print(f'previews written {made}, up to date {skipped}')


if __name__ == '__main__':
    main()
