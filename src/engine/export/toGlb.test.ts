import { Mesh, MeshPhysicalMaterial, SphereGeometry } from "three";
import { describe, expect, it } from "vitest";
import { toGlb } from "./toGlb";

describe("toGlb", () => {
  it("writes a binary glTF with the magic bytes up front", async () => {
    const mesh = new Mesh(new SphereGeometry(1, 16, 12), new MeshPhysicalMaterial({ color: "#ff4a2e", metalness: 1, roughness: 0.2 }));
    const out = await toGlb(mesh);
    expect(out).toBeInstanceOf(ArrayBuffer);
    expect(new DataView(out).getUint32(0, true)).toBe(0x46546c67);
    expect(out.byteLength).toBeGreaterThan(1000);
  });
});
