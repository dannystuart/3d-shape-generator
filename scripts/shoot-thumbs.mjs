// Shoots every thumbnail in the drawer from the engine itself, so a tile looks
// exactly like what it picks. Needs `pnpm dev` running.
//
//   pnpm shoot:thumbs                  everything (drawer tiles + look cards)
//   pnpm shoot:thumbs shapes           one kind
//   pnpm shoot:thumbs shapes torus     one tile
//   pnpm shoot:thumbs looks            just the showcase look cards
//   pnpm shoot:thumbs looks chrome-torus   one look
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "img", "thumbs");
const LOOKS_OUT = path.join(ROOT, "public", "img", "looks");
const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const SIZE = 160;
// The showcase gallery wants landscape cards, not the square drawer tiles.
const LOOK_W = 640;
const LOOK_H = 480;

// The catalogues are TypeScript; their ids are plain string literals, so a
// regex reads them without a toolchain.
const ids = async (...files) => (await Promise.all(files.map(async (f) => [...(await readFile(path.join(ROOT, "src/engine", f), "utf8")).matchAll(/\bid: "([^"]+)"/g)].map((m) => m[1])))).flat();
const CATALOGUE = {
  shapes: { ids: await ids("shapes/solids.ts", "shapes/flat.ts"), query: (id) => `shape=${id}&material=basic&environment=studio-soft` },
  // Glass needs something behind it to bend: the tile's own colour, so the seam is invisible.
  materials: { ids: await ids("materials.ts"), query: (id) => `shape=sphere&material=${id}&environment=studio-soft&backdrop=solid&bg=16181c` },
  environments: { ids: await ids("environments.ts"), query: (id) => `shape=sphere&material=chrome&environment=${id}` },
  effects: { ids: await ids("effects/index.ts"), query: (id) => `shape=star-5&material=plastic-blue&effect=${id}&environment=grad-candy&backdrop=solid` },
};

// The looks roster lives in TypeScript; its slugs are plain string literals.
const lookSlugs = [...(await readFile(path.join(ROOT, "src/engine/presets/looks.ts"), "utf8")).matchAll(/\bslug: "([^"]+)"/g)].map((m) => m[1]);

const [onlyKind, onlyId] = process.argv.slice(2);
const kinds = Object.keys(CATALOGUE).filter((k) => !onlyKind || k === onlyKind);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 2 });
let count = 0;
for (const kind of kinds) {
  const { ids: list, query } = CATALOGUE[kind];
  await mkdir(path.join(OUT, kind), { recursive: true });
  for (const id of list) {
    if (onlyId && id !== onlyId) continue;
    await page.goto(`${BASE}/catalogue/thumb?${query(id)}&size=320`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-ready]", { timeout: 20_000 });
    await page.waitForTimeout(150);
    const png = await page.locator("[data-shot]").screenshot({ omitBackground: true });
    const file = path.join(OUT, kind, `${id}.webp`);
    await sharp(png).resize(SIZE, SIZE).webp({ quality: 82 }).toFile(file);
    count++;
    process.stdout.write(`${kind}/${id}\n`);
  }
}

// The showcase look cards: landscape, on the same dark stage the host uses, so
// the gallery doesn't need twelve live canvases. Shot full-frame (the shape's
// own backdrop is left transparent, so the page's sg-ink shows edge to edge).
if (!onlyKind || onlyKind === "looks") {
  await mkdir(LOOKS_OUT, { recursive: true });
  for (const slug of lookSlugs) {
    if (onlyId && slug !== onlyId) continue;
    // A fresh page per look: these are heavy glass/HDRI renders, and a single
    // reused context runs out of WebGL after a dozen, so each gets its own. The
    // viewport is padded well past the shot box so the fixed dev-mode overlay
    // in the corner lands in the margin, outside the element screenshot.
    const shot = await browser.newPage({ viewport: { width: LOOK_W + 160, height: LOOK_H + 160 }, deviceScaleFactor: 2 });
    // domcontentloaded, not networkidle: the render loop can keep the network
    // busy and the [data-ready] wait already proves the environment has drawn.
    await shot.goto(`${BASE}/catalogue/thumb?look=${slug}&w=${LOOK_W}&h=${LOOK_H}`, { waitUntil: "domcontentloaded" });
    await shot.waitForSelector("[data-ready]", { timeout: 20_000 });
    await shot.waitForTimeout(150);
    // Shoot the shape box, not the page, so the dev-mode overlay stays out.
    const png = await shot.locator("[data-shot]").screenshot();
    await sharp(png).resize(LOOK_W, LOOK_H).webp({ quality: 82 }).toFile(path.join(LOOKS_OUT, `${slug}.webp`));
    await shot.close();
    count++;
    process.stdout.write(`looks/${slug}\n`);
  }
}

await browser.close();
process.stdout.write(`${count} thumbnails\n`);
