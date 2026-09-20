"""
Assemble the Blender leaf renders into the sprite sheet the site ships.

Run after `blender -b -P tools/render_leaves.py`:
    python tools/build_leaf_sheet.py

Reads the render directory recorded in public/images/.leafrender, downsamples
each frame to SHEET_TILE, and writes public/images/leaves.webp as a grid of
FRAMES columns by one row per variant.

Downsampling from a larger render rather than rendering at the final size gives
cleaner antialiasing on the leaf edge, which matters because the sprite is
composited over a photograph.

Requires Pillow in the system Python. Blender's bundled Python does not ship
it, which is why this is a separate step.
"""

import os
import sys

from PIL import Image

FRAMES = 28
ROWS = 3
SHEET_TILE = 72

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT, "public", "images")
MARKER = os.path.join(OUT_DIR, ".leafrender")


def main():
    if not os.path.exists(MARKER):
        sys.exit("No .leafrender marker. Run the Blender render step first.")

    with open(MARKER) as fh:
        render_dir = fh.read().strip()
    if not os.path.isdir(render_dir):
        sys.exit(f"Render directory is gone: {render_dir}")

    sheet = Image.new("RGBA", (FRAMES * SHEET_TILE, ROWS * SHEET_TILE), (0, 0, 0, 0))

    missing = []
    empty = []
    for row in range(ROWS):
        for col in range(FRAMES):
            path = os.path.join(render_dir, f"{row}_{col:02d}.png")
            if not os.path.exists(path):
                missing.append(os.path.basename(path))
                continue
            frame = Image.open(path).convert("RGBA")
            if frame.getchannel("A").getextrema()[1] == 0:
                empty.append(os.path.basename(path))
            sheet.paste(
                frame.resize((SHEET_TILE, SHEET_TILE), Image.LANCZOS),
                (col * SHEET_TILE, row * SHEET_TILE),
            )

    if missing:
        sys.exit(f"{len(missing)} frames missing, first: {missing[0]}")
    if empty:
        print(f"WARNING: {len(empty)} fully transparent frames, first: {empty[0]}")

    out = os.path.join(OUT_DIR, "leaves.webp")
    sheet.save(out, "WEBP", quality=90, method=6)

    os.remove(MARKER)
    print(f"wrote {out}")
    print(f"  grid   {FRAMES} x {ROWS} at {SHEET_TILE}px -> {sheet.size[0]}x{sheet.size[1]}")
    print(f"  size   {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    main()
