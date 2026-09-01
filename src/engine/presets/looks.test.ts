import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coerceSpec, DEFAULT_SPEC, inRange, PARAM_META } from "../spec";
import type { Spec } from "../spec";
import { LOOKS, lookBySlug, lookSpec } from "./looks";

const ROOT = path.resolve(__dirname, "..", "..", "..");

describe("looks", () => {
  it("ships at least twelve looks with unique slugs and one-liners", () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(12);
    const slugs = LOOKS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const look of LOOKS) {
      expect(look.slug).toMatch(/^[a-z0-9-]+$/);
      expect(look.name.length).toBeGreaterThan(0);
      expect(look.oneLiner.length).toBeGreaterThan(0);
    }
  });
  it("every look resolves to a valid, in-range spec", () => {
    for (const look of LOOKS) {
      const spec = lookSpec(look.slug);
      expect(spec).toEqual(coerceSpec(spec));
      for (const key of Object.keys(PARAM_META) as (keyof Spec)[]) {
        expect(inRange(key, spec[key]), `${look.slug}.${key}`).toBe(true);
      }
    }
  });
  it("unknown slugs fall back to the default spec", () => {
    expect(lookSpec("no-such-look")).toEqual(DEFAULT_SPEC);
    expect(lookBySlug("no-such-look")).toBeUndefined();
  });
  it("looks cover the blob and chrome families", () => {
    // The showcase's SEO sections depend on at least one of each existing.
    expect(LOOKS.some((l) => l.family === "blob")).toBe(true);
    expect(LOOKS.some((l) => l.family === "chrome")).toBe(true);
  });

  it("every look has a shot thumbnail", () => {
    const dir = path.join(ROOT, "public/img/looks");
    // The host mirrors this file but not this directory — its look cards ship
    // under a different public root and the sync's drift test guards them
    // there. Only assert where the master's own thumbnails live.
    if (!existsSync(dir)) return;
    for (const look of LOOKS) expect(existsSync(path.join(dir, `${look.slug}.webp`)), look.slug).toBe(true);
  });
});
