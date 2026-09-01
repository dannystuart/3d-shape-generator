"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShapePreview } from "@/components/ShapePreview";
import { EFFECTS, effectDialDefaults } from "@/engine/effects/index";
import { ENVIRONMENTS } from "@/engine/environments";
import { MATERIALS, materialPatch } from "@/engine/materials";
import type { Handle } from "@/engine/renderer";
import { SHAPES, shapeDialDefaults } from "@/engine/shapes/catalogue";
import { DEFAULT_SPEC } from "@/engine/spec";
import type { Spec } from "@/engine/spec";

/**
 * Every entry of one kind in a grid — the visual-regression subject.
 * `?kind=shapes|materials|environments|effects`.
 *
 * One engine photographs each entry in turn rather than one engine per tile:
 * a browser allows only a dozen or so WebGL contexts, and a grid of sixty
 * would lose most of them.
 */
function entries(kind: string): { id: string; spec: Spec }[] {
  const base: Spec = { ...DEFAULT_SPEC, autoSpin: 0, floorShadow: false, backdrop: "transparent", zoom: 1.3 };
  switch (kind) {
    case "materials":
      // Glass needs something behind it to bend: the tile's own colour.
      return MATERIALS.map((m) => ({ id: m.id, spec: { ...base, material: m.id, ...materialPatch(m.id), backdrop: "solid", backdropColor: "#0f1013" } }));
    case "environments":
      return ENVIRONMENTS.map((e) => ({ id: e.id, spec: { ...base, material: "chrome", ...materialPatch("chrome"), environment: e.id } }));
    case "effects":
      return EFFECTS.map((e) => ({ id: e.id, spec: { ...base, shape: "star-5", material: "plastic-blue", ...materialPatch("plastic-blue"), environment: "grad-candy", backdrop: "solid", [e.slot === "tone" ? "tone" : e.slot === "finish" ? "finish" : "effect"]: e.id, ...effectDialDefaults(e) } }));
    default:
      return SHAPES.map((s) => ({ id: s.id, spec: { ...base, shape: s.id, ...shapeDialDefaults(s) } }));
  }
}

const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function Sheet() {
  const kind = useSearchParams().get("kind") ?? "shapes";
  const list = useMemo(() => entries(kind), [kind]);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const handleRef = useRef<Handle | null>(null);
  const envArrived = useRef<(() => void) | null>(null);

  const onReady = useCallback((h: Handle) => {
    handleRef.current = h;
    h.onEnvironment(() => envArrived.current?.());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Wait for the engine to mount.
      while (!handleRef.current && !cancelled) await frames();
      const h = handleRef.current!;
      let env = "";
      for (const e of list) {
        if (cancelled) return;
        const waitEnv = e.spec.environment !== env ? new Promise<void>((r) => (envArrived.current = r)) : Promise.resolve();
        h.setSpec(e.spec);
        await waitEnv;
        env = e.spec.environment;
        await frames();
        const { blob } = await h.snapshot({ scale: 1 });
        const url = URL.createObjectURL(blob);
        setShots((s) => ({ ...s, [e.id]: url }));
      }
      setDone(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [list]);

  return (
    <main className="min-h-screen bg-sg-ink p-4">
      <div className="fixed left-[-9999px] top-0 h-[200px] w-[200px]" aria-hidden>
        <ShapePreview spec={list[0].spec} interactive={false} onReady={onReady} style={{ width: "100%", height: "100%" }} />
      </div>
      <div data-sheet data-ready={done ? "" : undefined} className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, 200px)" }}>
        {list.map((e) => (
          <div key={e.id} className="relative h-[200px] w-[200px] overflow-hidden rounded-lg bg-sg-panel">
            {/* eslint-disable-next-line @next/next/no-img-element -- a snapshot from the engine, not a file */}
            {shots[e.id] ? <img src={shots[e.id]} alt={e.id} className="block h-full w-full" /> : null}
            <span className="absolute bottom-1 left-2 text-[10px] text-sg-faint">{e.id}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function SheetPage() {
  return (
    <Suspense fallback={null}>
      <Sheet />
    </Suspense>
  );
}
