import { ENGINE_SOURCE, THREE_VERSION } from "../dist/engineSource";
import { environmentById } from "../environments";
import { DEFAULT_SPEC, type Spec } from "../spec";

export const SETTINGS_MARKER = "// ▼ Your shape. This is the part to edit.";
const DEFAULT_TOOL_URL = "https://vanta.supply/tools/3d-shape-generator";
const CDN = (v: string) => `https://cdn.jsdelivr.net/npm/three@${v}`;

export interface HtmlOptions {
  spec: Spec;
  id?: string;
  toolUrl?: string;
  /** Where /env/*.hdr live. */
  assetBase?: string;
  width?: number;
  height?: number;
}

/** Only what differs from the defaults, so the object reads as a description rather than a dump. */
export function changed(spec: Spec): Partial<Spec> {
  const out: Partial<Spec> = {};
  for (const k of Object.keys(DEFAULT_SPEC) as (keyof Spec)[]) if (spec[k] !== DEFAULT_SPEC[k]) (out as Record<string, unknown>)[k] = spec[k];
  return out;
}

/**
 * The block people copy out: a div, an import map that points `three` at a
 * pinned CDN build, the engine inlined, the settings, and one call. The engine
 * string is the same code the preview runs, so the copy cannot drift from it.
 */
export function toHtml({ spec, id = "shape", toolUrl = DEFAULT_TOOL_URL, assetBase = DEFAULT_TOOL_URL, width = 600, height = 600 }: HtmlOptions): string {
  const env = environmentById(spec.environment);
  const envNote =
    env.kind === "hdr"
      ? `// The "${env.name}" environment loads from ${assetBase}/env/${env.file}. Copy the file to your own site and change assetBase if you'd rather not depend on ours.`
      : `// The "${env.name}" environment is generated — no files to host.`;
  const settings = JSON.stringify(changed(spec), null, 2).replace(/\n/g, "\n    ");
  return `<!-- 3D shape from ${toolUrl} -->
<div id="${id}" style="width:${width}px;max-width:100%;aspect-ratio:${width}/${height}"></div>
<script type="importmap">
{ "imports": { "three": "${CDN(THREE_VERSION)}/build/three.module.js", "three/addons/": "${CDN(THREE_VERSION)}/examples/jsm/" } }
</script>
<script type="module">
${ENGINE_SOURCE}
    ${SETTINGS_MARKER}
    ${envNote}
    const spec = coerceSpec(${settings});
    mount(document.getElementById("${id}"), { spec, assetBase: "${assetBase}", interactive: true });
</script>`;
}
