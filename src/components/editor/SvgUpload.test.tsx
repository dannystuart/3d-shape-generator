import { describe, expect, it } from "vitest";
import { pathDataFromSvg } from "@/engine/shapes/svgFile";

describe("pathDataFromSvg", () => {
  it("turns every filled element into path data, one subpath each", () => {
    const d = pathDataFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10"/><rect x="20" y="0" width="10" height="10"/></svg>');
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).toMatch(/Z/);
  });
  it("rejects a file with nothing to fill", () => {
    expect(() => pathDataFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="10" y2="10"/></svg>')).toThrow(/nothing to fill/i);
  });
  it("bakes a transform into the points", () => {
    const d = pathDataFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(100 0)"><rect x="0" y="0" width="10" height="10"/></g></svg>');
    expect(d).toMatch(/M1[0-9]{2}/);
  });
});
