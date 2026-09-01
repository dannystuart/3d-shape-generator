import { expect, test } from "@playwright/test";

test("the engine draws a lit shape", async ({ page }) => {
  await page.goto("/catalogue/thumb?shape=torus&material=chrome&environment=studio-soft", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-ready]", { timeout: 15_000 });
  await page.waitForTimeout(300);
  // Count lit pixels in a screenshot: the canvas has no preserveDrawingBuffer,
  // so a readPixels after the frame would be blank — and the middle of a
  // torus is its hole, so one pixel proves nothing.
  const png = await page.locator("[data-shot]").screenshot();
  const { PNG } = await import("pngjs");
  const img = PNG.sync.read(png);
  let lit = 0;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 120) lit++;
  // A chrome ring reflecting a studio covers a good part of the square.
  expect(lit / (img.width * img.height)).toBeGreaterThan(0.08);
});

for (const effect of ["pixelate", "dither", "halftone", "ascii", "duotone", "posterize", "threshold", "outline", "blur", "chromatic", "chromablur"]) {
  test(`effect ${effect} compiles and draws`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`/catalogue/thumb?shape=star-5&material=plastic-blue&effect=${effect}&backdrop=solid`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-ready]", { timeout: 15_000 });
    await page.waitForTimeout(300);
    expect(errors.filter((e) => /shader|GLSL|compile/i.test(e))).toEqual([]);
    await expect(page.locator("[data-shot]")).toHaveScreenshot(`effect-${effect}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
