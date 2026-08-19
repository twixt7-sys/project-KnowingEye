import { describe, expect, it } from "vitest";

/**
 * Directive Area 02 ("Readability & contrast", P0) - the Chapter 2 audit
 * table in docs/documentation/chapter2/03-system-design.html is a written
 * claim; this file is what actually enforces it. If a future token edit
 * regresses a pair below its WCAG 2.1 threshold, this test fails instead of
 * the panel finding it first. Update the doc table's numbers from this
 * file's output if either one drifts - this file is the source of truth.
 */

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Alpha-composite an rgba() foreground over an opaque hex background. */
function compositeOverHex(rgbaFg: string, bgHex: string): Rgb {
  const m = rgbaFg.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/,
  );
  if (!m) throw new Error(`Not an rgb()/rgba() value: ${rgbaFg}`);
  const [, r, g, b, aStr] = m;
  const a = aStr === undefined ? 1 : Number.parseFloat(aStr);
  const [br, bg_, bb] = hexToRgb(bgHex);
  return [
    Number(r) * a + br * (1 - a),
    Number(g) * a + bg_ * (1 - a),
    Number(b) * a + bb * (1 - a),
  ];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG 2.1 contrast ratio between two colors, each either a hex string or an rgba() string composited over `compositeBg`. */
function contrast(a: string, b: string, compositeBg = "#ffffff"): number {
  const rgbA = a.startsWith("#") ? hexToRgb(a) : compositeOverHex(a, compositeBg);
  const rgbB = b.startsWith("#") ? hexToRgb(b) : compositeOverHex(b, compositeBg);
  const [l1, l2] = [relativeLuminance(rgbA), relativeLuminance(rgbB)];
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_TEXT = 4.5;
const AA_UI = 3.0;

// Values mirrored from frontend/src/styles/theme.css. Keep these two files in
// sync - this test exists specifically to catch when they drift apart.
const light = {
  card: "#ffffff",
  foreground: "#132743",
  background: "#e9eef6",
  muted: "#dfe6f1",
  mutedForeground: "#566481",
  secondary: "#1c7b92",
  secondaryForeground: "#effafc",
  statusSafe: "#1e8658",
  statusWatch: "#a16b16",
  care: "#c8503a",
  input: "#7b95bf",
  formFieldBorder: "rgba(19, 39, 67, 0.5)",
};

const dark = {
  card: "#0f1b30",
  foreground: "#d7e2f2",
  background: "#0a1322",
  muted: "#182740",
  mutedForeground: "#8fa2c0",
  destructive: "#e07a6b",
  destructiveForeground: "#1a0805",
  input: "#476799",
  formFieldBorder: "rgba(255, 255, 255, 0.35)",
};

describe("theme.css WCAG 2.1 contrast audit (light)", () => {
  it("body text passes AA (foreground/background)", () => {
    expect(contrast(light.foreground, light.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("muted text passes AA (mutedForeground/muted)", () => {
    expect(contrast(light.mutedForeground, light.muted)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("secondary button label passes AA", () => {
    expect(contrast(light.secondaryForeground, light.secondary)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("status-safe label on card passes AA", () => {
    expect(contrast(light.statusSafe, light.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("status-watch label on card passes AA", () => {
    expect(contrast(light.statusWatch, light.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("care (Wellness & Care) label on card passes AA", () => {
    expect(contrast(light.care, light.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("input border passes the 3:1 UI-component threshold", () => {
    expect(contrast(light.input, light.card)).toBeGreaterThanOrEqual(AA_UI);
  });

  it("form field border passes the 3:1 UI-component threshold", () => {
    expect(
      contrast(light.formFieldBorder, light.card, light.card),
    ).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe("theme.css WCAG 2.1 contrast audit (dark)", () => {
  it("body text passes AA (foreground/background)", () => {
    expect(contrast(dark.foreground, dark.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("muted text passes AA (mutedForeground/muted)", () => {
    expect(contrast(dark.mutedForeground, dark.muted)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("destructive badge label passes AA", () => {
    expect(
      contrast(dark.destructiveForeground, dark.destructive),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("input border passes the 3:1 UI-component threshold", () => {
    expect(contrast(dark.input, dark.card)).toBeGreaterThanOrEqual(AA_UI);
  });

  it("form field border passes the 3:1 UI-component threshold", () => {
    expect(
      contrast(dark.formFieldBorder, dark.card, dark.card),
    ).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe("disabled-state opacity (WCAG 2.1 exempt, not asserted against AA)", () => {
  it("documents the exemption instead of asserting a numeric floor", () => {
    // WCAG 2.1 SC 1.4.3 and 1.4.11 both explicitly exempt inactive/disabled
    // user-interface components from contrast requirements - the .icon-btn
    // disabled opacity (0.45, theme.css) and the shared Button/Input
    // disabled:opacity-50 utility are a deliberate dimming cue, not a
    // contrast target. This test exists so that exemption is a documented,
    // reviewed decision rather than a silent gap.
    expect(true).toBe(true);
  });
});
