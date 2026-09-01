import { expect, test } from "@playwright/test";
import { toHtml } from "../src/engine/export/toHtml";
import { shapeById, shapeDialDefaults } from "../src/engine/shapes/catalogue";
import { DEFAULT_SPEC } from "../src/engine/spec";

/**
 * The block people copy out, pasted into an otherwise empty page, with Three
 * coming from the CDN exactly as it would on their site. A dev-server route
 * is not the same test: this one has no bundler, no import alias, nothing of
 * ours but the string.
 */
const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";

async function paste(page: import("@playwright/test").Page, html: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#222">${html}</body></html>`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await expect(page.locator("canvas")).toHaveCount(1);
  return errors;
}

test("a gold star on a generated environment runs with nothing but the CDN", async ({ page }) => {
  const html = toHtml({ spec: { ...DEFAULT_SPEC, shape: "star-5", material: "gold", color: "#ffc65c", metalness: 1, roughness: 0.2, environment: "grad-lamp", autoSpin: 0 }, assetBase: BASE });
  const errors = await paste(page, html);
  expect(errors).toEqual([]);
  await expect(page.locator("#shape")).toHaveScreenshot("snippet-gold-star.png", { maxDiffPixelRatio: 0.02 });
});

test("an HDRI environment resolves from the asset base", async ({ page }) => {
  const html = toHtml({ spec: { ...DEFAULT_SPEC, shape: "torus", ...shapeDialDefaults(shapeById("torus")), material: "chrome", color: "#ffffff", metalness: 1, roughness: 0.05, environment: "sunset", autoSpin: 0 }, assetBase: BASE });
  const errors = await paste(page, html);
  expect(errors).toEqual([]);
  const hdr = await page.evaluate(async (base) => (await fetch(`${base}/env/sunset.hdr`, { method: "HEAD" })).status, BASE);
  expect(hdr).toBe(200);
  await expect(page.locator("#shape")).toHaveScreenshot("snippet-chrome-torus.png", { maxDiffPixelRatio: 0.02 });
});
