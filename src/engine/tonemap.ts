/**
 * The backdrop goes through the same tone curve as the shape, so a picked
 * colour would come out slightly different. The engine uses Three's Neutral
 * tone mapping (the Khronos PBR Neutral curve — made for product shots, so it
 * leaves most colours alone and only compresses the brightest ones). This
 * file has the curve in JS and finds the linear colour that maps *onto* the
 * picked one, so the backdrop is exact.
 */

const START = 0.8 - 0.04;
const DESATURATION = 0.15;

/** Three's NeutralToneMapping at exposure 1, on linear RGB. */
export function neutralForward(input: number[]): number[] {
  let c = [...input];
  const x = Math.min(c[0], c[1], c[2]);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v - offset);
  const peak = Math.max(c[0], c[1], c[2]);
  if (peak < START) return c;
  const d = 1 - START;
  const newPeak = 1 - (d * d) / (peak + d - START);
  c = c.map((v) => (v * newPeak) / peak);
  const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
  return c.map((v) => v + (newPeak - v) * g);
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, "0")).join("");

/**
 * The linear colour to paint the backdrop with so the picked hex comes out
 * after tone mapping and the sRGB transform. Both halves of the curve invert
 * exactly: the compression from its peak, the black offset from its minimum.
 * White is pulled a hair under 1 because the curve only reaches 1 at infinity.
 */
export function backdropLinear(hex: string): number[] {
  const t = [1, 3, 5].map((i) => Math.min(srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255), 0.999));
  let c = [...t];
  const peakOut = Math.max(...t);
  if (peakOut >= START) {
    const d = 1 - START;
    const peak = (d * d) / (1 - peakOut) - d + START;
    const newPeak = peakOut;
    const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
    c = t.map((v) => ((v - newPeak * g) / (1 - g)) * (peak / newPeak));
  }
  const min = Math.min(...c);
  const x = min >= 0.04 ? 0.08 : Math.sqrt(Math.max(min, 0) / 6.25);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v + offset);
  if (c.every((v) => v >= 0)) return c;
  // Out of gamut: the curve cannot reach this colour. Settle for the nearest
  // it can — a short hill-climb from the target itself, which is already close.
  const error = (v: number[]) => neutralForward(v).reduce((sum, o, k) => sum + (o - t[k]) ** 2, 0);
  let best = [...t], bestErr = error(best);
  let step = 0.2;
  while (step > 1e-4) {
    let improved = false;
    for (let k = 0; k < 3; k++)
      for (const dir of [1, -1]) {
        const trial = [...best];
        trial[k] = Math.max(trial[k] + dir * step, 0);
        const e = error(trial);
        if (e < bestErr) {
          best = trial;
          bestErr = e;
          improved = true;
        }
      }
    if (!improved) step /= 2;
  }
  return best;
}

export const GRADIENT_SIZE = 256;

/**
 * A two-colour gradient at an angle (0° = second colour at the top, like CSS),
 * as half-float linear RGBA pixels the renderer can hand to Three. The colours
 * are blended in display space — what a CSS gradient between the same two hex
 * values looks like — and each blended step gets its own pre-image, so the
 * whole ramp comes out exact after tone mapping.
 */
export function gradientBackdrop(from: string, to: string, angleDeg: number, size = GRADIENT_SIZE): { data: Uint16Array; width: number; height: number } {
  const a = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16) / 255);
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16) / 255);
  const ramp: number[][] = [];
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    ramp.push(backdropLinear(toHex(a.map((v, k) => v + (b[k] - v) * t))));
  }
  // Rows run bottom to top, as WebGL reads them; 0° puts the second colour at the top.
  const angle = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(angle), dy = Math.cos(angle);
  const data = new Uint16Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Position along the gradient axis, 0..1, measured from the canvas centre.
      const px = x / (size - 1) - 0.5, py = y / (size - 1) - 0.5;
      const t = Math.min(1, Math.max(0, 0.5 + (px * dx + py * dy) / (Math.abs(dx) + Math.abs(dy))));
      const c = ramp[Math.round(t * (size - 1))];
      const o = (y * size + x) * 4;
      data[o] = toHalf(c[0]);
      data[o + 1] = toHalf(c[1]);
      data[o + 2] = toHalf(c[2]);
      data[o + 3] = toHalf(1);
    }
  }
  return { data, width: size, height: size };
}

/** IEEE half-float bits of a non-negative number; enough for colour values. */
function toHalf(v: number): number {
  const f = Math.min(Math.max(v, 0), 65504);
  if (f === 0) return 0;
  const e = Math.floor(Math.log2(f));
  if (e < -14) return Math.round(f / Math.pow(2, -24));
  const m = f / Math.pow(2, e) - 1;
  return ((e + 15) << 10) | Math.round(m * 1024);
}
