import { describe, expect, it } from "vitest";
import { extrudePath, shapesFromPath } from "./extrude";

const SQUARE = "M0 0H100V100H0Z";
const RING = "M50 0A50 50 0 1 0 50 100A50 50 0 1 0 50 0ZM50 25A25 25 0 1 1 50 75A25 25 0 1 1 50 25Z";

describe("shapesFromPath", () => {
  it("turns path data into shapes, with holes as holes", () => {
    expect(shapesFromPath(SQUARE)).toHaveLength(1);
    const ring = shapesFromPath(RING);
    expect(ring).toHaveLength(1);
    expect(ring[0].holes).toHaveLength(1);
  });
  it("throws on path data with nothing fillable", () => {
    expect(() => shapesFromPath("M0 0L10 10")).toThrow(/nothing to fill/i);
  });
});

describe("extrudePath", () => {
  it("builds a normalised, bevelled solid", () => {
    const g = extrudePath(SQUARE, { thickness: 0.3, rounding: 0.5, twist: 0 });
    g.computeBoundingSphere();
    expect(g.boundingSphere!.radius).toBeCloseTo(1, 4);
    expect(g.getAttribute("position").count).toBeGreaterThan(100);
  });
  it("is sharp-edged at rounding 0 and still a solid", () => {
    const g = extrudePath(SQUARE, { thickness: 0.3, rounding: 0, twist: 0 });
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });
});
