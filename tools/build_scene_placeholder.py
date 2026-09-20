"""
Generate the inline placeholder for the backdrop photograph.

Run after changing the backdrop:
    python tools/build_scene_placeholder.py path/to/new-backdrop.png

Writes src/styles/scene-placeholder.css, which defines `--scene-placeholder`
as a data URI holding a 32x18 blurred JPEG of the photo, about 430 bytes. The
scene component uses it as the background behind the real photograph, so the
first paint already looks like the scene that is loading instead of flashing
something else.

It has to be a stylesheet rather than a style attribute on the element: the
Content Security Policy hashes stylesheets but cannot hash style attributes,
so an inline one is blocked and the placeholder never paints.
"""

import base64
import io
import os
import sys

from PIL import Image, ImageFilter

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJECT, "src", "styles", "scene-placeholder.css")
DEFAULT_SOURCE = os.path.expanduser("~/Downloads/Portfolio BG.png")

# Small enough to stay tiny, large enough to keep the shape of the scene.
SIZE = (32, 18)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not os.path.exists(source):
        sys.exit(f"Source image not found: {source}")

    tiny = (
        Image.open(source)
        .convert("RGB")
        .resize(SIZE, Image.LANCZOS)
        # Blur before encoding: it removes the detail the encoder would
        # otherwise spend bytes on, and the result is blurred in CSS anyway.
        .filter(ImageFilter.GaussianBlur(0.6))
    )

    buf = io.BytesIO()
    tiny.save(buf, "JPEG", quality=55, optimize=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    with open(OUT, "w", newline="\n", encoding="utf-8") as fh:
        fh.write(
            "/*\n"
            " * Inline placeholder for the backdrop photograph. Generated; do not edit.\n"
            " *\n"
            f" * A {SIZE[0]}x{SIZE[1]} blurred JPEG of the real photo, so the first paint already\n"
            " * looks like the scene that is loading.\n"
            " *\n"
            " * It lives in a stylesheet rather than a style attribute on the element\n"
            " * because the Content Security Policy hashes stylesheets but cannot hash\n"
            " * style attributes, so an inline one is blocked and the placeholder never\n"
            " * paints. Regenerate with tools/build_scene_placeholder.py.\n"
            " */\n"
            ":root {\n"
            f'  --scene-placeholder: url("{uri}");\n'
            "}\n"
        )

    print(f"wrote {OUT}")
    print(f"  source {source}")
    print(f"  data URI {len(uri)} chars ({len(buf.getvalue())} bytes of JPEG)")


if __name__ == "__main__":
    main()
