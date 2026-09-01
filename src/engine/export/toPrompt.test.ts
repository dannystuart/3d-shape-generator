import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "../spec";
import { toPrompt } from "./toPrompt";

describe("toPrompt", () => {
  it("names the shape, the material and the lighting with real numbers", () => {
    const p = toPrompt({ ...DEFAULT_SPEC, shape: "torus", material: "chrome", metalness: 1, roughness: 0.05, environment: "sunset" });
    expect(p).toMatch(/torus/i);
    expect(p).toMatch(/chrome/i);
    expect(p).toMatch(/roughness 0\.05/);
    expect(p).toMatch(/sunset/i);
  });
  it("says nothing about an effect when there is none, and everything when there is one", () => {
    expect(toPrompt(DEFAULT_SPEC)).not.toMatch(/effect/i);
    expect(toPrompt({ ...DEFAULT_SPEC, effect: "halftone", effectA: 12 })).toMatch(/halftone.*12/i);
  });
  it("quotes an active effect's real shader, with its dials mapped to the uniforms", () => {
    const p = toPrompt({ ...DEFAULT_SPEC, tone: "threshold", toneA: 0.29, toneColor1: "#2432d6", toneColor2: "#f2f5ff" });
    expect(p).toContain("```glsl");
    expect(p).toContain("gl_FragColor");
    expect(p).toContain("smoothstep(uA - soft, uA + soft");
    expect(p).toMatch(/uA = 0\.29 \(cut-off\)/);
    expect(p).toMatch(/uColor1 = #2432d6, uColor2 = #f2f5ff/);
    expect(p).toMatch(/backdrop included/);
    expect(toPrompt(DEFAULT_SPEC)).not.toContain("```glsl");
  });
  it("spells out a seeded blob's displacement recipe and its limits", () => {
    const p = toPrompt({ ...DEFAULT_SPEC, shape: "blob-spiky" });
    expect(p).toMatch(/simplex3\(seed\)/);
    expect(p).toMatch(/not the exact outline/);
    expect(toPrompt(DEFAULT_SPEC)).not.toMatch(/simplex/);
  });
  it("describes an uploaded shape without dumping the path", () => {
    const p = toPrompt({ ...DEFAULT_SPEC, shape: "custom", svg: "M0 0H100V100H0Z" });
    expect(p).toMatch(/your own SVG/i);
    expect(p).not.toContain("M0 0H100");
  });
  it("leaves untouched dials unsaid", () => {
    expect(toPrompt(DEFAULT_SPEC)).not.toMatch(/iridescence|velvet|coat/i);
    expect(toPrompt({ ...DEFAULT_SPEC, sheen: 0.8 })).toMatch(/velvet 0\.8/i);
  });
});
