"""Procedural abstract-reasoning figure generation for the guidance seed.

Draws classic non-verbal / abstract-reasoning items (rotation series, count
series, polygon-side progressions, size progressions, odd-one-out, and A:B::C:?
analogies) as PNG bytes with Pillow, so ``seed_guidance_abstract`` can attach a
real stem image to each question and give every multiple-choice option a real
image. Everything here is deterministic given the ``random.Random`` passed in,
so re-seeding reproduces the same forms.

Each generator returns an ``AbstractItem``:
    prompt          - the question text shown above the stem image
    stem_png        - PNG bytes for the question stem (the series + a "?" cell)
    option_pngs     - list[bytes], one PNG per choice (parallel to option letters)
    correct_index   - index into option_pngs of the correct choice
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass

from PIL import Image, ImageDraw

# Visual constants ----------------------------------------------------------
INK = (33, 37, 51)
ACCENT = (79, 70, 229)  # indigo, matches the SPA primary
MUTED = (148, 163, 184)
BG = (255, 255, 255)
CELL = 110          # px per figure cell
PAD = 14            # inner padding within a cell
STEM_GAP = 10       # gap between stem cells


@dataclass
class AbstractItem:
    prompt: str
    stem_png: bytes | None   # None => the question has no separate stem image
    option_pngs: list[bytes]
    correct_index: int


# Low-level drawing ---------------------------------------------------------

def _blank(size: int = CELL) -> Image.Image:
    return Image.new("RGB", (size, size), BG)


def _to_png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _regular_polygon(draw: ImageDraw.ImageDraw, cx, cy, r, n, *, rotation_deg=0.0,
                     fill=None, outline=INK, width=5) -> None:
    pts = []
    for i in range(n):
        a = math.radians(rotation_deg) + i * 2 * math.pi / n - math.pi / 2
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    draw.polygon(pts, fill=fill, outline=outline, width=width)


def _arrow_tile(rotation_deg: float, *, fill=ACCENT) -> Image.Image:
    """A bold arrow pointing up, rotated clockwise by ``rotation_deg``."""
    # Draw on a larger canvas then rotate + downsample for clean edges.
    scale = 3
    size = CELL * scale
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = size / 2
    w = size * 0.16      # shaft half-width
    head = size * 0.22   # arrowhead half-width
    top = size * 0.16
    mid = size * 0.46
    bot = size * 0.84
    # shaft
    d.rectangle([cx - w, mid, cx + w, bot], fill=fill)
    # head
    d.polygon([(cx - head, mid), (cx + head, mid), (cx, top)], fill=fill)
    img = img.rotate(-rotation_deg, resample=Image.BICUBIC, expand=False)
    out = Image.new("RGB", (size, size), BG)
    out.paste(img, (0, 0), img)
    return out.resize((CELL, CELL), Image.LANCZOS)


def _dots_tile(count: int, *, fill=ACCENT) -> Image.Image:
    """``count`` dots laid out on a tidy grid."""
    img = _blank()
    d = ImageDraw.Draw(img)
    per_row = 2 if count <= 4 else 3
    rows = math.ceil(count / per_row)
    r = 12
    gap_x = (CELL - 2 * PAD) / max(per_row, 1)
    gap_y = (CELL - 2 * PAD) / max(rows, 1)
    drawn = 0
    for row in range(rows):
        in_row = min(per_row, count - drawn)
        # centre the (possibly short) last row
        offset = (per_row - in_row) * gap_x / 2
        for col in range(in_row):
            cx = PAD + offset + gap_x * (col + 0.5)
            cy = PAD + gap_y * (row + 0.5)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
            drawn += 1
    return img


def _polygon_tile(sides: int, *, fill=None, outline=INK, rotation_deg=0.0) -> Image.Image:
    img = _blank()
    d = ImageDraw.Draw(img)
    _regular_polygon(d, CELL / 2, CELL / 2, CELL / 2 - PAD, sides,
                     rotation_deg=rotation_deg, fill=fill, outline=outline)
    return img


def _circle_tile(radius: int, *, fill=ACCENT) -> Image.Image:
    img = _blank()
    d = ImageDraw.Draw(img)
    cx = cy = CELL / 2
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=fill)
    return img


def _question_tile() -> Image.Image:
    """The '?' cell that closes a stem series, with a dashed border."""
    img = _blank()
    d = ImageDraw.Draw(img)
    step = 10
    for x in range(4, CELL - 4, step * 2):
        d.line([x, 4, x + step, 4], fill=MUTED, width=3)
        d.line([x, CELL - 5, x + step, CELL - 5], fill=MUTED, width=3)
    for y in range(4, CELL - 4, step * 2):
        d.line([4, y, 4, y + step], fill=MUTED, width=3)
        d.line([CELL - 5, y, CELL - 5, y + step], fill=MUTED, width=3)
    # Big centred question mark drawn with a scaled default font.
    try:
        from PIL import ImageFont
        font = ImageFont.load_default(size=64)
    except Exception:  # pragma: no cover - very old Pillow
        font = None
    text = "?"
    if font is not None:
        box = d.textbbox((0, 0), text, font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        d.text(((CELL - tw) / 2 - box[0], (CELL - th) / 2 - box[1]), text,
               fill=ACCENT, font=font)
    else:  # pragma: no cover
        d.text((CELL / 2 - 10, CELL / 2 - 20), text, fill=ACCENT)
    return img


def _compose_row(tiles: list[Image.Image]) -> Image.Image:
    """Lay tiles left-to-right, each in a bordered box, into one stem image."""
    n = len(tiles)
    width = n * CELL + (n + 1) * STEM_GAP
    height = CELL + 2 * STEM_GAP
    strip = Image.new("RGB", (width, height), (248, 249, 252))
    d = ImageDraw.Draw(strip)
    x = STEM_GAP
    for tile in tiles:
        strip.paste(tile, (x, STEM_GAP))
        d.rectangle([x, STEM_GAP, x + CELL - 1, STEM_GAP + CELL - 1],
                    outline=MUTED, width=2)
        x += CELL + STEM_GAP
    return strip


# Item generators -----------------------------------------------------------
# Each takes a random.Random and returns an AbstractItem. All build a 4-option
# set and shuffle the correct answer into a random slot.

def _finalise(prompt, stem_tiles, correct_tile, distractor_tiles, rng) -> AbstractItem:
    options = [correct_tile] + distractor_tiles
    # Attach an identity so we can find the correct one after shuffling.
    tagged = [(i == 0, t) for i, t in enumerate(options)]
    rng.shuffle(tagged)
    correct_index = next(i for i, (is_c, _) in enumerate(tagged) if is_c)
    return AbstractItem(
        prompt=prompt,
        stem_png=_to_png(_compose_row(stem_tiles)) if stem_tiles else None,
        option_pngs=[_to_png(t) for _, t in tagged],
        correct_index=correct_index,
    )


def rotation_series(rng) -> AbstractItem:
    step = rng.choice([45, 90])
    start = rng.choice([0, 45, 90, 180])
    frames = [start + step * i for i in range(3)]
    answer_angle = start + step * 3
    stem = [_arrow_tile(a) for a in frames] + [_question_tile()]
    correct = _arrow_tile(answer_angle % 360)
    wrong_angles = {answer_angle % 360}
    distractors = []
    candidates = [(answer_angle + d) % 360 for d in (90, 180, -45, 45, 135)]
    for a in candidates:
        if a not in wrong_angles and len(distractors) < 3:
            wrong_angles.add(a)
            distractors.append(_arrow_tile(a))
    return _finalise(
        "The arrow rotates by the same amount at each step. "
        "Which option completes the series?",
        stem, correct, distractors, rng,
    )


def count_series(rng) -> AbstractItem:
    start = rng.choice([1, 2])
    step = rng.choice([1, 2])
    frames = [start + step * i for i in range(3)]
    answer = start + step * 3
    stem = [_dots_tile(c) for c in frames] + [_question_tile()]
    correct = _dots_tile(answer)
    seen = {answer}
    distractors = []
    for cand in (answer + step, max(1, answer - step), answer + 2 * step):
        if cand not in seen:
            seen.add(cand)
            distractors.append(_dots_tile(cand))
    while len(distractors) < 3:
        cand = max(1, answer + len(distractors) + 3)
        if cand not in seen:
            seen.add(cand)
            distractors.append(_dots_tile(cand))
    return _finalise(
        "How many dots should appear in the next figure of the series?",
        stem, correct, distractors[:3], rng,
    )


def polygon_sides_series(rng) -> AbstractItem:
    start = rng.choice([3, 4])
    frames = [start + i for i in range(3)]
    answer = start + 3
    stem = [_polygon_tile(s, fill=ACCENT) for s in frames] + [_question_tile()]
    correct = _polygon_tile(answer, fill=ACCENT)
    seen = {answer}
    distractors = []
    for cand in (answer + 1, answer - 1, answer + 2):
        if cand >= 3 and cand not in seen:
            seen.add(cand)
            distractors.append(_polygon_tile(cand, fill=ACCENT))
    while len(distractors) < 3:
        cand = answer + len(distractors) + 2
        distractors.append(_polygon_tile(cand, fill=ACCENT))
    return _finalise(
        "Each figure gains one side. Which figure comes next?",
        stem, correct, distractors[:3], rng,
    )


def size_series(rng) -> AbstractItem:
    base = rng.choice([14, 16])
    grow = rng.choice([8, 10])
    frames = [base + grow * i for i in range(3)]
    answer = base + grow * 3
    stem = [_circle_tile(r) for r in frames] + [_question_tile()]
    correct = _circle_tile(min(answer, CELL // 2 - 4))
    seen = {answer}
    distractors = []
    for cand in (answer - grow, base, answer - 2 * grow):
        cand = max(6, min(cand, CELL // 2 - 4))
        if cand not in seen:
            seen.add(cand)
            distractors.append(_circle_tile(cand))
    while len(distractors) < 3:
        distractors.append(_circle_tile(max(6, base - 4 * len(distractors))))
    return _finalise(
        "The circle grows by the same amount each step. Which option comes next?",
        stem, correct, distractors[:3], rng,
    )


def odd_one_out(rng) -> AbstractItem:
    """Three tiles share a shape (rotated); the odd one is a different shape."""
    common_sides = rng.choice([3, 4, 5])
    odd_sides = rng.choice([s for s in (3, 4, 5, 6) if s != common_sides])
    rotations = rng.sample([0, 20, 40, 60, 80], 3)
    same = [_polygon_tile(common_sides, outline=INK, rotation_deg=r) for r in rotations]
    odd = _polygon_tile(odd_sides, outline=INK, rotation_deg=rng.choice([0, 30]))
    # No stem: the four options ARE the figure set to compare.
    return _finalise(
        "Three of the four figures share a property. "
        "Which figure does NOT belong with the others?",
        None, odd, same, rng,
    )


def analogy(rng) -> AbstractItem:
    """A:B :: C:? where the transform is outline -> filled."""
    a_sides = rng.choice([3, 4, 5, 6])
    c_sides = rng.choice([s for s in (3, 4, 5, 6) if s != a_sides])
    # A third, distinct side count for the "wrong shape, filled" distractor, so
    # no two options ever render identically (a filled c_sides+1 could otherwise
    # collide with the filled a_sides distractor when c_sides+1 == a_sides).
    other_sides = rng.choice([s for s in (3, 4, 5, 6, 7) if s not in (a_sides, c_sides)])
    a = _polygon_tile(a_sides, outline=INK)
    b = _polygon_tile(a_sides, fill=ACCENT)
    c = _polygon_tile(c_sides, outline=INK)
    stem = [a, b, c, _question_tile()]
    correct = _polygon_tile(c_sides, fill=ACCENT)          # filled version of C
    distractors = [
        _polygon_tile(a_sides, fill=ACCENT),               # filled A (wrong shape)
        _polygon_tile(c_sides, outline=INK),               # C unchanged (no fill)
        _polygon_tile(other_sides, fill=ACCENT),           # different wrong shape, filled
    ]
    return _finalise(
        "The first figure changes into the second in a certain way. "
        "Apply the same change to the third figure. What is the result?",
        stem, correct, distractors, rng,
    )


GENERATORS = [
    rotation_series,
    count_series,
    polygon_sides_series,
    size_series,
    analogy,
    odd_one_out,
]
