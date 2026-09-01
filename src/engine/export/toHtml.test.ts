import { describe, expect, it } from "vitest";
import { THREE_VERSION } from "../dist/engineSource";
import { DEFAULT_SPEC } from "../spec";
import { SETTINGS_MARKER, changed, toHtml } from "./toHtml";

describe("toHtml", () => {
  it("pins three to the version the engine was built against, for both the core and the addons", () => {
    const html = toHtml({ spec: DEFAULT_SPEC });
    expect(html).toContain(`three@${THREE_VERSION}/build/three.module.js`);
    expect(html).toContain(`"three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"`);
    expect(html).toContain('<script type="importmap">');
  });
  it("marks where the settings are and carries only what changed", () => {
    const html = toHtml({ spec: DEFAULT_SPEC });
    expect(html).toContain(SETTINGS_MARKER);
    expect(html).toContain("coerceSpec({})");
    expect(changed({ ...DEFAULT_SPEC, roughness: 0.1 })).toEqual({ roughness: 0.1 });
  });
  it("includes an uploaded shape verbatim", () => {
    const html = toHtml({ spec: { ...DEFAULT_SPEC, shape: "custom", svg: "M0 0H100V100H0Z" } });
    expect(html).toContain('"svg": "M0 0H100V100H0Z"');
  });
  it("tells people where the HDRI comes from, and when there is nothing to host", () => {
    expect(toHtml({ spec: DEFAULT_SPEC, assetBase: "https://example.com" })).toContain("https://example.com/env/studio-soft.hdr");
    expect(toHtml({ spec: { ...DEFAULT_SPEC, environment: "grad-mono" } })).toContain("no files to host");
  });
  it("is the block it was last time, apart from the engine itself", () => {
    // The engine string changes with every engine edit and is covered by its
    // own hash test; the block around it is the contract people paste.
    const html = toHtml({ spec: { ...DEFAULT_SPEC, shape: "star-5", material: "gold", metalness: 1, roughness: 0.2, color: "#ffc65c" } });
    const engineStart = html.indexOf('<script type="module">') + '<script type="module">\n'.length;
    const engineEnd = html.indexOf(SETTINGS_MARKER);
    expect(html.slice(0, engineStart) + "…engine…\n    " + html.slice(engineEnd)).toMatchSnapshot();
  });
});
