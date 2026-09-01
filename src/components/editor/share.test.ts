import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "@/engine/spec";
import { fromShareHash, toShareHash, toShareUrl } from "./share";

describe("share links", () => {
  it("carries only what differs from the defaults, and gets it back", () => {
    const spec = { ...DEFAULT_SPEC, shape: "heart", color: "#ff0000", roughness: 0.1 };
    const hash = toShareHash(spec);
    expect(hash).toMatch(/^#s=/);
    expect(fromShareHash(hash)).toEqual(spec);
  });
  it("is a bare URL for an untouched design", () => {
    expect(toShareHash(DEFAULT_SPEC)).toBe("");
    expect(toShareUrl(DEFAULT_SPEC, "https://x.test/tool#s=old")).toBe("https://x.test/tool");
  });
  it("shrugs at nonsense", () => {
    expect(fromShareHash("#s=!!!")).toBeNull();
    expect(fromShareHash("#s=bm90anNvbg")).toBeNull();
    expect(fromShareHash("")).toBeNull();
  });
});
