import { expect, test } from "@playwright/test";

/**
 * Contact sheets as committed baselines: every shape in the plain material,
 * every material on a sphere, every environment on chrome, every effect on
 * one scene. The unit tests confirm the numbers; only a picture catches "a
 * geometry change quietly ruined the torus".
 */
for (const kind of ["shapes", "materials", "environments", "effects"]) {
  test(`every ${kind[0]}${kind.slice(1)} still looks like itself`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/catalogue/sheet?kind=${kind}`, { waitUntil: "networkidle" });
    // One engine photographs every entry in turn; the sheet says when it is done.
    await page.waitForSelector("[data-ready]", { timeout: 120_000 });
    await expect(page.locator("[data-sheet]")).toHaveScreenshot(`sheet-${kind}.png`, { maxDiffPixelRatio: 0.01 });
  });
}

test("the editor on a desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await expect(page).toHaveScreenshot("editor-desktop.png", { maxDiffPixelRatio: 0.01 });
});

test("the editor on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await expect(page).toHaveScreenshot("editor-phone.png", { maxDiffPixelRatio: 0.01 });
});
