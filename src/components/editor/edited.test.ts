import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "@/engine/spec";
import { editedKeys } from "./edited";

describe("spotting an edit", () => {
  it("finds nothing on an untouched preset", () => {
    expect(editedKeys(DEFAULT_SPEC, DEFAULT_SPEC)).toEqual([]);
  });

  it("names the dials that moved", () => {
    const moved = { ...DEFAULT_SPEC, roughness: 0.9, flat: true };
    expect(editedKeys(moved, DEFAULT_SPEC).sort()).toEqual(["flat", "roughness"]);
  });
});
