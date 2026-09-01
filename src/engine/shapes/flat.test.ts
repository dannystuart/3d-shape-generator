import { describe, expect, it } from "vitest";
import { extrudePath } from "./extrude";
import { FLAT_SHAPES, dynamicPath } from "./flat";

describe("the flat shapes", () => {
  it("has at least 28 presets with unique ids", () => {
    expect(FLAT_SHAPES.length).toBeGreaterThanOrEqual(28);
    expect(new Set(FLAT_SHAPES.map((s) => s.id)).size).toBe(FLAT_SHAPES.length);
  });
  it.each(FLAT_SHAPES.map((s) => [s.id, s] as const))("builds %s", (_id, shape) => {
    const g = extrudePath(shape.path, { thickness: 0.3, rounding: 0.5, twist: 0 });
    expect(g.getAttribute("position").count).toBeGreaterThan(50);
  });
  it("dynamic shape runs from circle to rounded square to hexagon", () => {
    for (const sides of [3, 4, 6, 64])
      for (const corner of [0, 0.5, 1]) {
        expect(() => extrudePath(dynamicPath(sides, corner), { thickness: 0.3, rounding: 0.3, twist: 0 })).not.toThrow();
      }
  });
});
