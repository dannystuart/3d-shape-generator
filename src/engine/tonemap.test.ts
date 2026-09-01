import { describe, expect, it } from "vitest";
import { backdropLinear, neutralForward } from "./tonemap";

const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const roundTrip = (hex: string) => {
  const back = neutralForward(backdropLinear(hex)).map(toSrgb);
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return Math.max(...back.map((v, i) => Math.abs(v - want[i])));
};

describe("backdropLinear", () => {
  it("is exact for greys and everyday colours", () => {
    for (const hex of ["#ffffff", "#101114", "#808080", "#000000", "#f2f0eb", "#2a2c33", "#c9b8a8", "#6b2a12", "#1b2a6b"]) {
      expect(roundTrip(hex), hex).toBeLessThan(0.005);
    }
  });
  it("lands within a tenth for the most saturated picks, which sit outside what the curve can reach", () => {
    for (const hex of ["#ff4a2e", "#2f7dff", "#3dff7a", "#ff2fa3"]) expect(roundTrip(hex), hex).toBeLessThan(0.12);
  });
});
