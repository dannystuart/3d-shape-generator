import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, PARAM_META, SECTIONS, coerceSpec, inRange } from "./spec";
import type { Spec } from "./spec";

describe("the spec", () => {
  it("has metadata for every key and a key for every metadata entry", () => {
    const specKeys = Object.keys(DEFAULT_SPEC).sort();
    const metaKeys = Object.keys(PARAM_META).sort();
    expect(metaKeys).toEqual(specKeys);
  });

  it("starts with every number inside its own range", () => {
    for (const key of Object.keys(PARAM_META) as (keyof Spec)[]) {
      expect(inRange(key, DEFAULT_SPEC[key]), key).toBe(true);
    }
  });

  it("puts every key in a section the panel draws", () => {
    const ids = new Set(SECTIONS.map((s) => s.id));
    for (const meta of Object.values(PARAM_META)) expect(ids.has(meta.section)).toBe(true);
  });

  it("opens on a plain white shape with nothing on it", () => {
    expect(DEFAULT_SPEC.effect).toBe("none");
    expect(DEFAULT_SPEC.material).toBe("basic");
    expect(DEFAULT_SPEC.transmission).toBe(0);
    expect(DEFAULT_SPEC.metalness).toBe(0);
  });

  it("coerces junk back to defaults without losing good values", () => {
    const out = coerceSpec({ roughness: 0.2, fov: 900, shape: "torus", nonsense: 1 });
    expect(out.roughness).toBe(0.2);
    expect(out.fov).toBe(DEFAULT_SPEC.fov);
    expect(out.shape).toBe("torus");
  });
});
