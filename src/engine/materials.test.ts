import { MeshPhysicalMaterial } from "three";
import { describe, expect, it } from "vitest";
import { MATERIALS, applyMaterial, materialPatch } from "./materials";
import { DEFAULT_SPEC, inRange } from "./spec";

describe("materials", () => {
  it("has at least 40 presets in six categories with unique ids", () => {
    expect(MATERIALS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(MATERIALS.map((m) => m.id)).size).toBe(MATERIALS.length);
    expect(new Set(MATERIALS.map((m) => m.category))).toEqual(new Set(["solid", "metal", "glass", "neon", "special", "texture"]));
  });
  it("keeps every preset inside the dial ranges", () => {
    for (const m of MATERIALS)
      for (const [k, v] of Object.entries(materialPatch(m.id))) expect(inRange(k as never, v as never), `${m.id}.${k}`).toBe(true);
  });
  it("writes the spec onto a physical material", () => {
    const mat = new MeshPhysicalMaterial();
    applyMaterial(mat, { ...DEFAULT_SPEC, ...materialPatch("chrome") });
    expect(mat.metalness).toBe(1);
    expect(mat.roughness).toBeLessThan(0.2);
    applyMaterial(mat, { ...DEFAULT_SPEC, ...materialPatch("glass-clear") });
    expect(mat.transmission).toBe(1);
  });
});
