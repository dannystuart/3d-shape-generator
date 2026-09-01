import { describe, expect, it } from "vitest";
import { seededRandom } from "../shapes/noise";
import { DEFAULT_SPEC, PARAM_META, inRange } from "../spec";
import type { Spec } from "../spec";
import { surprise } from "./surprise";

describe("surprise", () => {
  it("always changes the shape or the material, and never leaves a dial out of range", () => {
    const rng = seededRandom(7);
    let current = DEFAULT_SPEC;
    for (let i = 0; i < 50; i++) {
      const next = surprise(rng, current);
      expect(next.shape !== current.shape || next.material !== current.material).toBe(true);
      for (const key of Object.keys(PARAM_META) as (keyof Spec)[]) expect(inRange(key, next[key]), key).toBe(true);
      current = next;
    }
  });
  it("keeps the backdrop, the camera and the adjustments as they were", () => {
    const current = { ...DEFAULT_SPEC, backdropColor: "#123456", fov: 50, exposure: 0.4 };
    const next = surprise(seededRandom(3), current);
    expect(next.backdropColor).toBe("#123456");
    expect(next.fov).toBe(50);
    expect(next.exposure).toBe(0.4);
  });
});
