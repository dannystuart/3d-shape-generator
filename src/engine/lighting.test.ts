import { describe, expect, it } from "vitest";
import { cameraPosition, keyLightPosition } from "./lighting";

describe("keyLightPosition", () => {
  it("puts the dot at the centre of the pad straight in front, above", () => {
    const p = keyLightPosition(0, 0, 6);
    expect(p.z).toBeGreaterThan(0);
    expect(Math.abs(p.x)).toBeLessThan(1e-6);
    expect(p.length()).toBeCloseTo(6, 5);
  });
  it("moves right when x goes right and up when y goes up", () => {
    expect(keyLightPosition(1, 0, 6).x).toBeGreaterThan(0);
    expect(keyLightPosition(0, 1, 6).y).toBeGreaterThan(keyLightPosition(0, 0, 6).y);
  });
});

describe("cameraPosition", () => {
  it("orbits at a distance that keeps a unit sphere in frame at any lens", () => {
    for (const fov of [10, 35, 90]) {
      const p = cameraPosition(30, 15, fov, 1);
      const halfAngle = (fov * Math.PI) / 360;
      expect(p.length() * Math.sin(halfAngle)).toBeGreaterThan(1.2);
    }
  });
});
