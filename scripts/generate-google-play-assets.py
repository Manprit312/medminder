#!/usr/bin/env python3
"""Generate Google Play listing PNGs from repo branding + resources/icon.png."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC_ICON = ROOT / "resources" / "icon.png"
OUT_DIR = ROOT / "store-assets"


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def lerp_rgb(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))  # type: ignore[return-value]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[Path] = []
    if sys.platform == "darwin":
        sup = Path("/System/Library/Fonts/Supplemental")
        if bold:
            candidates.extend([sup / "Arial Bold.ttf", sup / "Arial.ttf"])
        else:
            candidates.extend([sup / "Arial.ttf", sup / "Arial Bold.ttf"])
    candidates.append(Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    candidates.append(Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    for p in candidates:
        if p.is_file():
            try:
                return ImageFont.truetype(str(p), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def crop_square(im: Image.Image) -> Image.Image:
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def main() -> None:
    if not SRC_ICON.is_file():
        print(f"Missing source icon: {SRC_ICON}", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    src = Image.open(SRC_ICON).convert("RGBA")
    square = crop_square(src)

    # --- 512 x 512 Play icon ---
    icon_512 = square.resize((512, 512), Image.Resampling.LANCZOS)
    icon_path = OUT_DIR / "google-play-icon-512.png"
    icon_512.save(icon_path, "PNG", optimize=True)
    print(f"Wrote {icon_path} ({icon_512.size})")

    # --- Feature graphic 1024 x 500 ---
    W, H = 1024, 500
    primary = hex_rgb("#5f6956")
    dark = hex_rgb("#2d3328")
    cream = hex_rgb("#f2f2e6")
    accent = hex_rgb("#ff6b35")

    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        t = y / max(H - 1, 1)
        r, g, b = lerp_rgb(primary, dark, t)
        for x in range(W):
            px[x, y] = (r, g, b)

    draw = ImageDraw.Draw(bg)
    thumb = square.resize((300, 300), Image.Resampling.LANCZOS)
    ix = 72
    iy = (H - 300) // 2
    if thumb.mode == "RGBA":
        bg.paste(thumb, (ix, iy), thumb)
    else:
        bg.paste(thumb, (ix, iy))

    font_title = load_font(56, bold=True)
    font_sub = load_font(26, bold=False)
    font_hint = load_font(20, bold=False)

    tx = ix + 300 + 48
    title = "MedMinder"
    sub = "Medicine reminders & dose tracking"
    hint = "Today • Family • Caring"

    # Accent rule under title
    title_bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = title_bbox[2] - title_bbox[0]
    th = title_bbox[3] - title_bbox[1]
    ty_block = (H - (th + 14 + 30 + 22)) // 2
    draw.text((tx, ty_block), title, fill=(255, 255, 255), font=font_title)
    draw.rectangle((tx, ty_block + th + 10, tx + min(tw, 420), ty_block + th + 14), fill=accent)

    draw.text((tx, ty_block + th + 28), sub, fill=cream, font=font_sub)
    draw.text((tx, ty_block + th + 28 + 34), hint, fill=lerp_rgb(cream, dark, 0.35), font=font_hint)

    feat_path = OUT_DIR / "google-play-feature-graphic-1024x500.png"
    bg.save(feat_path, "PNG", optimize=True)
    print(f"Wrote {feat_path} ({bg.size})")


if __name__ == "__main__":
    main()
