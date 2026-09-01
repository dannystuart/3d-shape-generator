import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ENGINE_HASH, ENGINE_INPUTS, ENGINE_SOURCE, THREE_VERSION } from "./engineSource";

const ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * The committed bundle is what the app inlines into the block people copy, so
 * `pnpm build` needs no pre-step — and this is the only thing standing between
 * a stale bundle and shipping somebody else broken code.
 */
describe("the embeddable engine", () => {
  it("still matches the sources it was built from", () => {
    const hash = createHash("sha256");
    for (const input of ENGINE_INPUTS) {
      hash.update(input);
      hash.update(readFileSync(path.join(ROOT, input)));
    }
    expect(`sha256:${hash.digest("hex")}`, "the engine has changed since the bundle was built — run `pnpm build:engine`").toBe(ENGINE_HASH);
  });

  it("is small enough to paste into somebody else's page", () => {
    // Measured 22 Aug 2026 at the first build: 48.2KB minified, 17.5KB gzipped,
    // with Three itself left to the CDN. The catalogue of shapes is most of it
    // — the flat outlines are traced as a couple of hundred points each — and
    // that is what makes a pasted block self-contained. A ratchet with the
    // measured numbers beside it, so drift shows up in the diff.
    // 23 Aug 2026: 58.9KB minified after the surfaces (leather, scales,
    // concrete...) — drawn in code so a pasted block still needs no files.
    // Later that day: 64.4KB after the ice sheet, a dozen more swatches and
    // the exact gradient backdrop.
    const raw = Buffer.byteLength(ENGINE_SOURCE, "utf8");
    const compressed = gzipSync(ENGINE_SOURCE).length;
    expect(raw, `${(raw / 1024).toFixed(1)}KB minified, was 64.4`).toBeLessThan(70 * 1024);
    expect(compressed, `${(compressed / 1024).toFixed(1)}KB gzipped, was 17.5`).toBeLessThan(24 * 1024);
  });

  it("imports three and nothing else, and carries no export of its own", () => {
    const imports = ENGINE_SOURCE.match(/from\s*"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((m) => /"three(\/addons\/[^"]+)?"/.test(m))).toBe(true);
    expect(ENGINE_SOURCE).not.toContain("require(");
    expect(ENGINE_SOURCE).not.toContain("react");
    expect(ENGINE_SOURCE).not.toMatch(/(^|[;\n}])\s*export\s*(\{|const|let|var|function|class|default)/);
    // The two names the snippet calls, pinned after minification.
    expect(ENGINE_SOURCE).toMatch(/\bmount=/);
    expect(ENGINE_SOURCE).toMatch(/\bcoerceSpec=/);
  });

  it("pins the Three version the app installed", () => {
    // Find three's package.json by resolving its entry and walking up to the
    // nearest one named "three". The mirrored copy on the host site has no
    // node_modules of its own (it leans on the host's hoisted three), and
    // three's `exports` hides ./package.json so it can't be required directly.
    const require = createRequire(import.meta.url);
    let version: string | undefined;
    for (let dir = path.dirname(require.resolve("three")); dir !== path.dirname(dir); dir = path.dirname(dir)) {
      const candidate = path.join(dir, "package.json");
      if (!existsSync(candidate)) continue;
      const pkg = JSON.parse(readFileSync(candidate, "utf8"));
      if (pkg.name === "three") {
        version = pkg.version;
        break;
      }
    }
    expect(THREE_VERSION).toBe(version);
  });
});
