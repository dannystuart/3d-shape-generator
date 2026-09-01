import { BoxGeometry, CatmullRomCurve3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { circleProfile, normalise, sweep, twist } from "./geometry";

describe("normalise", () => {
  it("centres the geometry and fits it in a unit bounding sphere", () => {
    const g = normalise(new BoxGeometry(4, 1, 1).translate(10, 0, 0));
    g.computeBoundingSphere();
    expect(g.boundingSphere!.center.length()).toBeLessThan(1e-6);
    expect(g.boundingSphere!.radius).toBeCloseTo(1, 5);
  });
});

describe("twist", () => {
  it("leaves the middle alone and rotates the ends opposite ways", () => {
    const g = twist(new BoxGeometry(1, 1, 2, 1, 1, 8), 90);
    const pos = g.getAttribute("position");
    let top: Vector3 | null = null,
      bottom: Vector3 | null = null;
    for (let i = 0; i < pos.count; i++) {
      const v = new Vector3().fromBufferAttribute(pos, i);
      if (Math.abs(v.z - 1) < 1e-6 && !top) top = v;
      if (Math.abs(v.z + 1) < 1e-6 && !bottom) bottom = v;
    }
    expect(top && bottom).toBeTruthy();
    const a = Math.atan2(top!.y, top!.x),
      b = Math.atan2(bottom!.y, bottom!.x);
    expect(Math.abs(a - b) % (Math.PI * 2)).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe("sweep", () => {
  it("builds a closed tube with the expected vertex count", () => {
    const path = new CatmullRomCurve3(
      [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(-1, 0, 0), new Vector3(0, -1, 0)],
      true,
    );
    const g = sweep(path, circleProfile(0.2, 8), 32, 0);
    expect(g.getAttribute("position").count).toBe(33 * 9);
    expect(g.index!.count).toBe(32 * 8 * 6);
    expect(g.getAttribute("normal")).toBeDefined();
  });
});
