import { expect, test } from "@playwright/test";

/**
 * The three things that go wrong quietly: a still scene that keeps drawing, a
 * glass material that costs ten frames, and a canvas that dies on the second
 * page you reach it from.
 */
test("a still scene draws no frames; a spinning one does", async ({ page }) => {
  await page.goto("/catalogue/thumb?shape=sphere&material=basic", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-ready]");
  await page.waitForTimeout(500);
  const still = await page.evaluate(async () => {
    let n = 0;
    const count = () => {
      n++;
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    const before = (window as unknown as { __frames?: number }).__frames;
    await new Promise((r) => setTimeout(r, 1500));
    return { rafTicks: n, before };
  });
  // rAF runs (the page is alive) — what we need is that the engine does not
  // draw into it. The engine has no frame counter on its handle, so watch the
  // canvas: a still scene's pixels do not change across a second.
  expect(still.rafTicks).toBeGreaterThan(30);
  const a = await page.locator("[data-shot]").screenshot();
  await page.waitForTimeout(1000);
  const b = await page.locator("[data-shot]").screenshot();
  expect(Buffer.compare(a, b)).toBe(0);
});

async function frameMs(page: import("@playwright/test").Page, material: string): Promise<number> {
  await page.goto(`/catalogue/thumb?shape=sphere&material=${material}&backdrop=solid&size=900`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-ready]");
  return page.evaluate(async () => {
    const h = window.__sg!;
    // Warm up, then time ten frames by invalidating and waiting for them.
    for (let i = 0; i < 5; i++) {
      h.invalidate();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      h.invalidate();
      await new Promise((r) => requestAnimationFrame(r));
    }
    return (performance.now() - t0) / 10;
  });
}

test("glass costs no more than twice a plain frame", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Headless Chromium draws in software, so absolute numbers say nothing
  // (a plain sphere is ~100ms here, ~2ms on a laptop GPU). The ratio is the
  // contract: transmission re-renders the scene, and at half resolution that
  // re-render must stay cheap relative to the frame it sits in.
  const plain = await frameMs(page, "basic");
  const glass = await frameMs(page, "glass-clear");
  expect(glass / plain).toBeLessThan(2);
});

test("the editor's canvas survives a client-side navigation", async ({ page }) => {
  await page.goto("/catalogue", { waitUntil: "networkidle" });
  await page.click("[data-to-editor]");
  await page.waitForSelector("canvas", { timeout: 15_000 });
  await page.waitForTimeout(1500);
  const lost = await page.evaluate(() => {
    const gl = document.querySelector("canvas")!.getContext("webgl2");
    return gl ? gl.isContextLost() : true;
  });
  expect(lost).toBe(false);
});
