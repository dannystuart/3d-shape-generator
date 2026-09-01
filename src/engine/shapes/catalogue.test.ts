import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "../spec";
import { SHAPES, buildShape, shapeById, shapeDials } from "./catalogue";

describe("the shape catalogue", () => {
  it("lists flat and solid shapes under one id space", () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
    expect(SHAPES.some((s) => s.family === "flat")).toBe(true);
    expect(SHAPES.some((s) => s.family === "solid")).toBe(true);
  });
  it("builds the default spec's shape", () => {
    const g = buildShape(DEFAULT_SPEC);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });
  it("builds a custom upload from the svg field", () => {
    const g = buildShape({ ...DEFAULT_SPEC, shape: "custom", svg: "M0 0H100V100H0Z" });
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });
  it("falls back to the sphere for an unknown id rather than throwing", () => {
    expect(() => buildShape({ ...DEFAULT_SPEC, shape: "nope" })).not.toThrow();
    expect(shapeById("nope").id).toBe("sphere");
  });
  it("clamps dial values into the shape's own ranges, so a stray spec still draws", () => {
    const g = buildShape({ ...DEFAULT_SPEC, shape: "torus", shapeA: 0.5, shapeB: 0.5, shapeC: 0.5 });
    expect(g.getAttribute("position").count).toBeGreaterThan(1000);
  });
  it("names the dials a shape uses and nothing more", () => {
    expect(shapeDials(shapeById("sphere"))).toHaveLength(0);
    expect(shapeDials(shapeById("torus")).map((d) => d.key)).toEqual(["shapeA", "shapeB", "shapeC"]);
    expect(shapeDials(shapeById("star-5")).map((d) => d.key)).toEqual([]);
  });
});
