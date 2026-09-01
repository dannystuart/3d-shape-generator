import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, coerceSpec } from "../spec";
import { GRADE_FRAGMENT } from "./grade";
import { EFFECTS, FINISHES, TEXTURES, TONES, effectById, effectDialDefaults, effectIn, effectUniforms } from "./index";

describe("effects", () => {
  it("lists none plus eleven, each with up to three dials and a fragment shader", () => {
    expect(EFFECTS.map((e) => e.id)).toEqual(["none", "pixelate", "dither", "halftone", "ascii", "outline", "blur", "chromatic", "chromablur", "duotone", "posterize", "threshold"]);
    for (const e of EFFECTS) {
      expect(e.dials.length).toBeLessThanOrEqual(3);
      if (e.id !== "none") expect(e.fragment).toContain("gl_FragColor");
    }
  });
  it("splits into texture, colour and finish slots, with a none in each", () => {
    expect(TEXTURES.map((e) => e.id)).toEqual(["none", "pixelate", "dither", "halftone", "ascii", "outline"]);
    expect(TONES.map((e) => e.id)).toEqual(["none", "duotone", "posterize", "threshold"]);
    expect(FINISHES.map((e) => e.id)).toEqual(["none", "blur", "chromatic", "chromablur"]);
    // Colour effects have at most two dials, because the slot has two.
    for (const e of TONES) expect(e.dials.length).toBeLessThanOrEqual(2);
  });

  it("keys a colour effect's dials and defaults to the colour slot", () => {
    const duotone = effectById("duotone");
    // Duotone starts on its seed pair rather than ink and cream.
    expect(effectDialDefaults(duotone)).toEqual({ toneA: 0.5, toneB: 0, toneColor1: "#2432d6", toneColor2: "#f2f5ff" });
    expect(effectIn({ ...DEFAULT_SPEC, effect: "pixelate", tone: "duotone" }, "tone").id).toBe("duotone");
    // A colour id in the texture slot is not a texture; the slot reads as empty.
    expect(effectIn({ ...DEFAULT_SPEC, effect: "duotone" }, "texture").id).toBe("none");
    // The finish slot the same way round.
    expect(effectIn({ ...DEFAULT_SPEC, finish: "chromatic" }, "finish").id).toBe("chromatic");
    expect(effectIn({ ...DEFAULT_SPEC, effect: "pixelate" }, "finish").id).toBe("none");
    expect(effectDialDefaults(effectById("blur"))).toEqual({ finishA: 24, finishB: 0, finishC: 0 });
  });

  it("moves a design saved when blur lived in the texture slot across to the finish slot", () => {
    const old = coerceSpec({ effect: "blur", effectA: 40, effectB: 2, effectC: 0.5 });
    expect(old.effect).toBe("none");
    expect(old.finish).toBe("blur");
    expect(old.finishA).toBe(40);
    expect(old.finishB).toBe(2);
    expect(old.finishC).toBe(0.5);
  });

  it("moves a design saved before the colour slot across to it", () => {
    const old = coerceSpec({ effect: "posterize", effectA: 6, effectB: 1.5, effectColor1: "#ff0000" });
    expect(old.effect).toBe("none");
    expect(old.tone).toBe("posterize");
    expect(old.toneA).toBe(6);
    expect(old.toneB).toBe(1.5);
    expect(old.toneColor1).toBe("#ff0000");
    expect(old.effectA).toBe(DEFAULT_SPEC.effectA);
  });

  it("every shader declares the uniforms the dials feed", () => {
    for (const e of EFFECTS) {
      if (e.id === "none") continue;
      for (const name of ["uA", "uB", "uC", "uColor1", "uColor2", "uResolution", "tDiffuse"]) expect(e.fragment, `${e.id} ${name}`).toContain(name);
    }
  });
  it("maps spec dials onto uniform values, with alpha preserved in every shader", () => {
    const u = effectUniforms({ ...DEFAULT_SPEC, effect: "dither", effectA: 0.25 });
    expect(u.uA).toBeCloseTo(0.25);
    for (const e of EFFECTS) if (e.id !== "none") expect(e.fragment).toContain("texel.a");
  });
  it("grade shader exposes the seven adjustments", () => {
    for (const n of ["uExposure", "uBrightness", "uContrast", "uSaturation", "uHue", "uTemperature", "uTint"]) expect(GRADE_FRAGMENT).toContain(n);
  });
  it("finds an effect by id and falls back to none", () => {
    expect(effectById("halftone").dials[0].label).toBe("Dot size");
    expect(effectById("nope").id).toBe("none");
  });
});
