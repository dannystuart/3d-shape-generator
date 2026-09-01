import { describe, expect, it } from "vitest";
import { SOLID_SHAPES } from "./solids";

describe("the solid shapes", () => {
  it("has at least 20 presets with unique ids and up to three named dials each", () => {
    expect(SOLID_SHAPES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SOLID_SHAPES.map((s) => s.id)).size).toBe(SOLID_SHAPES.length);
    for (const s of SOLID_SHAPES) expect(s.dials.length).toBeLessThanOrEqual(3);
  });
  it.each(SOLID_SHAPES.map((s) => [s.id, s] as const))("builds %s at its defaults and at both ends of every dial", (_id, shape) => {
    const defaults = shape.dials.map((d) => d.default);
    for (const values of [defaults, shape.dials.map((d) => d.min), shape.dials.map((d) => d.max)]) {
      const g = shape.build(values[0] ?? 0.5, values[1] ?? 0.5, values[2] ?? 0.5);
      // 24 is an octahedron: eight faces, the smallest honest solid.
      expect(g.getAttribute("position").count, `${shape.id} ${values}`).toBeGreaterThanOrEqual(24);
      g.computeBoundingSphere();
      expect(g.boundingSphere!.radius).toBeCloseTo(1, 3);
      g.dispose();
    }
  });
});
