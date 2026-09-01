// Downloads the eight Poly Haven HDRIs the engine lights with, at 1K, into
// public/env/. They are CC0; docs/CREDITS.md gives the credit anyway.
// Skips files that already exist, so it is safe to run any time.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "env");
mkdirSync(outDir, { recursive: true });

// Read the manifest from the engine source without a TS toolchain: the entries
// are plain literals, so a regex is enough.
const { readFileSync } = await import("node:fs");
const src = readFileSync(join(root, "src/engine/environments.ts"), "utf8");
const entries = [...src.matchAll(/kind: "hdr", file: "([^"]+)", source: "([^"]+)"/g)].map((m) => ({ file: m[1], source: m[2] }));
if (entries.length === 0) throw new Error("No hdr entries found in environments.ts");

for (const { file, source } of entries) {
  const dest = join(outDir, file);
  if (existsSync(dest)) {
    console.log(`skip  ${file} (exists)`);
    continue;
  }
  const info = await fetch(`https://api.polyhaven.com/info/${source}`);
  if (!info.ok) throw new Error(`Poly Haven has no asset "${source}" (${info.status}) — swap it in environments.ts`);
  const url = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${source}_1k.hdr`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`saved ${file} ← ${source} (${(buf.length / 1024).toFixed(0)} KB)`);
}
