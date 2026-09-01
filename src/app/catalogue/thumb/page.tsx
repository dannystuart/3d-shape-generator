"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShapePreview } from "@/components/ShapePreview";
import { effectById, effectDialDefaults } from "@/engine/effects/index";
import { materialPatch } from "@/engine/materials";
import { lookSpec } from "@/engine/presets/looks";
import type { Handle } from "@/engine/renderer";
import { shapeById, shapeDialDefaults } from "@/engine/shapes/catalogue";
import { DEFAULT_SPEC, coerceSpec } from "@/engine/spec";
import type { Spec } from "@/engine/spec";

/**
 * One shape in a square, from the query string. This is the thumbnail
 * generator and the visual-test subject: `?shape=torus&material=chrome`,
 * `?spec=<base64 json>` for anything at all, or `?look=<slug>` for a curated
 * look. Still, shadowless and transparent unless told otherwise, so a tile
 * reads as the thing and not the room.
 */
function specFromQuery(q: URLSearchParams): Spec {
  // Zoomed in so the shape fills the tile; the editor gives it more room.
  const framing = { autoSpin: 0, floorShadow: false, backdrop: "transparent" as const, zoom: 1.3 };
  let spec: Spec = { ...DEFAULT_SPEC, ...framing };
  // A curated look, resolved through the engine and held still. It keeps its
  // own backdrop — glass needs something behind it to bend — so the card reads
  // as the look really is; every look currently sits on the same dark solid.
  const look = q.get("look");
  if (look) return { ...lookSpec(look), autoSpin: 0, floorShadow: false, zoom: 1.3 };
  const packed = q.get("spec");
  if (packed) {
    try {
      spec = coerceSpec(JSON.parse(atob(packed)));
    } catch {
      /* fall through to the plain params */
    }
  }
  const shape = q.get("shape");
  if (shape) spec = { ...spec, shape, ...shapeDialDefaults(shapeById(shape)) };
  const material = q.get("material");
  if (material) spec = { ...spec, material, ...materialPatch(material) };
  const environment = q.get("environment");
  if (environment) spec = { ...spec, environment };
  const effect = q.get("effect");
  if (effect) {
    const e = effectById(effect);
    const key = e.slot === "tone" ? "tone" : e.slot === "finish" ? "finish" : "effect";
    spec = { ...spec, [key]: e.id, ...effectDialDefaults(e) };
  }
  const backdrop = q.get("backdrop");
  if (backdrop === "solid" || backdrop === "gradient" || backdrop === "transparent") spec = { ...spec, backdrop };
  const bg = q.get("bg");
  if (bg && /^[0-9a-f]{6}$/i.test(bg)) spec = { ...spec, backdropColor: `#${bg}` };
  if (q.get("shadow") === "1") spec = { ...spec, floorShadow: true };
  return coerceSpec(spec);
}

declare global {
  interface Window {
    __sg?: Handle;
    /** The resolved spec, for shoot scripts that re-pose the shape per frame. */
    __sgSpec?: Spec;
  }
}

function Thumb() {
  const query = useSearchParams();
  const spec = useMemo(() => specFromQuery(query), [query]);
  const size = Number(query.get("size")) || 320;
  // A landscape shot box for the showcase look cards; square by default.
  const w = Number(query.get("w")) || size;
  const h = Number(query.get("h")) || size;
  const [ready, setReady] = useState(false);
  const onReady = useCallback((handle: Handle) => {
    window.__sg = handle;
    window.__sgSpec = spec;
    // Ready means the environment has arrived and one frame has been drawn with it.
    handle.onEnvironment(() => requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))));
  }, [spec]);
  return (
    <main className="grid min-h-screen place-items-center bg-sg-ink">
      <div data-shot data-ready={ready ? "" : undefined} style={{ width: w, height: h }}>
        <ShapePreview spec={spec} interactive={false} onReady={onReady} style={{ width: "100%", height: "100%" }} />
      </div>
    </main>
  );
}

export default function ThumbPage() {
  return (
    <Suspense fallback={null}>
      <Thumb />
    </Suspense>
  );
}
