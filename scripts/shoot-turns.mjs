// Shoots a short turntable clip of every showcase look, from the engine
// itself, so the gallery's hover preview shows exactly what the tool opens on.
// Needs `pnpm dev` running (or SHOOT_URL pointing at one).
//
//   pnpm shoot:turns                    every look
//   pnpm shoot:turns chrome-torus       one look
//
// Each clip is one full 360° of camera azimuth over 4 seconds, so it loops
// seamlessly. Frames are driven through window.__sg.setSpec on the same
// /catalogue/thumb page the stills come from; the poster stays the .webp shot
// by shoot-thumbs, so a card and its clip open on the same face.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "img", "looks");
const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const W = 640;
const H = 480;
const FRAMES = 96;
const FPS = 24;

const lookSlugs = [...(await readFile(path.join(ROOT, "src/engine/presets/looks.ts"), "utf8")).matchAll(/\bslug: "([^"]+)"/g)].map((m) => m[1]);
const [onlySlug] = process.argv.slice(2);

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
let count = 0;
for (const slug of lookSlugs) {
  if (onlySlug && slug !== onlySlug) continue;
  // A fresh page per look, same as the stills: heavy glass/HDRI renders run a
  // reused context out of WebGL. The viewport padding keeps the dev overlay out.
  const page = await browser.newPage({ viewport: { width: W + 160, height: H + 160 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/catalogue/thumb?look=${slug}&w=${W}&h=${H}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ready]", { timeout: 20_000 });
  await page.waitForTimeout(150);
  const shot = page.locator("[data-shot]");
  const frames = await mkdtemp(path.join(tmpdir(), `sg-turn-${slug}-`));
  for (let k = 0; k < FRAMES; k++) {
    // Step the azimuth and let two rAFs pass so the frame on screen is the one
    // just asked for, the same handshake [data-ready] uses.
    await page.evaluate(
      (step) =>
        new Promise((done) => {
          const spec = window.__sgSpec;
          window.__sg.setSpec({ ...spec, azimuth: spec.azimuth + step });
          requestAnimationFrame(() => requestAnimationFrame(done));
        }),
      (k * 360) / FRAMES,
    );
    await shot.screenshot({ path: path.join(frames, `${String(k).padStart(3, "0")}.png`) });
  }
  execFileSync("ffmpeg", [
    "-y", "-framerate", String(FPS), "-i", path.join(frames, "%03d.png"),
    "-vf", `scale=${W}:${H}`,
    "-c:v", "libx264", "-crf", "23", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
    path.join(OUT, `${slug}.mp4`),
  ], { stdio: ["ignore", "ignore", "ignore"] });
  await rm(frames, { recursive: true, force: true });
  await page.close();
  count++;
  process.stdout.write(`turns/${slug}\n`);
}
await browser.close();
process.stdout.write(`${count} turn clips\n`);
