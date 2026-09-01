import { describe, expect, it } from "vitest";
import { ENVIRONMENTS, environmentById, gradientPixels } from "./environments";

describe("environments", () => {
  it("has 8 real and 10 generated, unique ids, and the default exists", () => {
    expect(ENVIRONMENTS.filter((e) => e.kind === "hdr")).toHaveLength(8);
    expect(ENVIRONMENTS.filter((e) => e.kind === "gradient")).toHaveLength(10);
    expect(new Set(ENVIRONMENTS.map((e) => e.id)).size).toBe(18);
    expect(environmentById("studio-soft").kind).toBe("hdr");
    expect(environmentById("nope").id).toBe(ENVIRONMENTS[0].id);
  });
  it("paints a gradient equirect with the top colour at the top", () => {
    const env = ENVIRONMENTS.find((e) => e.kind === "gradient")!;
    const { data, width, height } = gradientPixels(env, 64, 32);
    expect(data.length).toBe(64 * 32 * 4);
    const top = [data[0], data[1], data[2]],
      bottom = [data[(height - 1) * width * 4], data[(height - 1) * width * 4 + 1], data[(height - 1) * width * 4 + 2]];
    expect(top).not.toEqual(bottom);
  });
});
