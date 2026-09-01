"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DragEvent } from "react";
import { ShapePreview } from "@/components/ShapePreview";
import { NO_FINISH, NO_TONE, effectById, effectDialDefaults } from "@/engine/effects/index";
import { surprise } from "@/engine/presets/surprise";
import type { CameraState, Handle } from "@/engine/renderer";
import { shapeById, shapeDialDefaults } from "@/engine/shapes/catalogue";
import { DEFAULT_SPEC, coerceSpec } from "@/engine/spec";
import type { Spec } from "@/engine/spec";
import { Drawer } from "./Drawer";
import { DrawerHeader } from "./DrawerHeader";
import { ExportMenu } from "./ExportMenu";
import { Sections } from "./Sections";
import { readSvgFile } from "./SvgUpload";
import { Toast } from "./Toast";
import { editedKeys } from "./edited";
import { fromShareHash } from "./share";

const SPEC_KEY = "sg.spec";
const DRAWER_KEY = "sg.drawer";

// On a phone the drawer lies over the scene rather than beside it, and starts shut.
const PHONE_QUERY = "(max-width: 1023px)";
const subscribePhone = (notify: () => void) => {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const phoneNow = () => window.matchMedia(PHONE_QUERY).matches;
const phoneOnServer = () => false;

/**
 * Whether the drawer is open: remembered in localStorage under sg.drawer, so
 * somebody who folded it away to look at their shape finds it where they left
 * it. A phone starts shut, where the panel would cover the scene.
 */
let chosen: boolean | null = null;
const drawerListeners = new Set<() => void>();
const subscribeDrawer = (notify: () => void) => {
  drawerListeners.add(notify);
  return () => {
    drawerListeners.delete(notify);
  };
};
const drawerNow = () => {
  if (chosen === null) {
    const saved = window.localStorage.getItem(DRAWER_KEY);
    if (saved !== null) chosen = saved === "open";
  }
  return chosen ?? !window.matchMedia(PHONE_QUERY).matches;
};
const drawerOnServer = () => true;
const setDrawer = (open: boolean) => {
  chosen = open;
  try {
    window.localStorage.setItem(DRAWER_KEY, open ? "open" : "shut");
  } catch {
    /* private mode */
  }
  drawerListeners.forEach((notify) => notify());
};

/** Camera angles are not edits: dragging the shape around is looking, not changing. */
const CAMERA_KEYS = new Set<keyof Spec>(["azimuth", "elevation", "zoom"]);

/**
 * Share hash → initialSpec → localStorage → default. A shared link wins over
 * everything: a link is a request. And an initialSpec is a link too — the host
 * turns `?look=` into one, so arriving on a look is the same intent as opening a
 * share link, and it beats what this browser happens to remember.
 */
function loadSpec(initialSpec?: Spec): Spec {
  const shared = fromShareHash(window.location.hash);
  if (shared) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return shared;
  }
  if (initialSpec) return initialSpec;
  try {
    const raw = window.localStorage.getItem(SPEC_KEY);
    return raw ? coerceSpec(JSON.parse(raw)) : DEFAULT_SPEC;
  } catch {
    return DEFAULT_SPEC;
  }
}

export function Editor({ initialSpec, assetBase = "" }: { initialSpec?: Spec; assetBase?: string } = {}) {
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);
  // The spec as it stood after the last preset pick; the reset targets and the Edited chip read against it.
  const [baseline, setBaseline] = useState<Spec>(DEFAULT_SPEC);
  // Refs shadowing the two states, so change() can read them without living in
  // a stale closure. Written wherever the states are written, and re-synced
  // after every render for the paths that set state directly.
  const specRef = useRef<Spec>(DEFAULT_SPEC);
  const baselineRef = useRef<Spec>(DEFAULT_SPEC);
  useLayoutEffect(() => {
    specRef.current = spec;
    baselineRef.current = baseline;
  });
  const [query, setQuery] = useState("");
  const [bare, setBare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [handle, setHandle] = useState<Handle | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const [hint, setHint] = useState(true);
  const [failedEnvironments, setFailedEnvironments] = useState<Set<string>>(() => new Set());
  const [failedEffects, setFailedEffects] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);

  const isPhone = useSyncExternalStore(subscribePhone, phoneNow, phoneOnServer);
  const open = useSyncExternalStore(subscribeDrawer, drawerNow, drawerOnServer);

  // The saved spec is read once the page is on the client, so the server and
  // the first client render agree. A layout effect, so the engine has the
  // saved shape before its first frame — nobody sees the default sphere blink
  // past on the way to their own design.
  //
  // "Once" has to survive StrictMode, which runs this effect twice in
  // development: loadSpec consumes the share hash and clears it from the
  // address bar, so a second call would find no hash, fall back to the
  // initial spec and stomp the shared design. The ref keeps the first read
  // through the double-invoke; a different look still remounts (key=…) with a
  // fresh ref.
  const opening = useRef<Spec | null>(null);
  useLayoutEffect(() => {
    const saved = (opening.current ??= loadSpec(initialSpec));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable here; a lazy initialiser would disagree with the server render.
    setSpec(saved);
    setBaseline(saved);
    // Read once at mount; the host remounts (key=…) to open on a different look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- persistence -----------------------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: Spec) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(SPEC_KEY, JSON.stringify(next));
      } catch {
        /* private mode or full */
      }
    }, 300);
  }, []);

  // --- undo --------------------------------------------------------------------
  // Every change drops the spec it replaced onto a stack, so undo steps back
  // one move at a time. A slider drag is a stream of changes to the same dial;
  // only its first change is kept, so undo lifts the whole drag at once.
  const history = useRef<{ spec: Spec; baseline: Spec }[]>([]);
  const lastRecord = useRef<{ keys: string; at: number }>({ keys: "", at: 0 });
  const [historySize, setHistorySize] = useState(0);
  const record = useCallback((current: Spec, base: Spec, patch: Partial<Spec>) => {
    const keys = Object.keys(patch).sort().join(",");
    const now = Date.now();
    const drag = keys === lastRecord.current.keys && now - lastRecord.current.at < 1500;
    lastRecord.current = { keys, at: now };
    if (drag) return;
    history.current.push({ spec: current, baseline: base });
    if (history.current.length > 100) history.current.shift();
    setHistorySize(history.current.length);
  }, []);

  const change = useCallback(
    (patch: Partial<Spec>) => {
      const current = specRef.current;
      record(current, baselineRef.current, patch);
      const next = { ...current, ...patch };
      specRef.current = next;
      persist(next);
      setSpec(next);
    },
    [persist, record],
  );

  /** A preset pick moves the dials and moves the baseline with them, so nothing reads as edited. */
  const adopt = useCallback(
    (patch: Partial<Spec>) => {
      const current = specRef.current;
      record(current, baselineRef.current, patch);
      const next = { ...current, ...patch };
      specRef.current = next;
      baselineRef.current = next;
      persist(next);
      setSpec(next);
      setBaseline(next);
    },
    [persist, record],
  );

  const pickShape = useCallback((id: string) => adopt({ shape: id, ...shapeDialDefaults(shapeById(id)) }), [adopt]);
  const pickEffect = useCallback(
    (id: string) => {
      const effect = effectById(id);
      adopt({ effect: effect.id, ...effectDialDefaults(effect) });
    },
    [adopt],
  );
  const pickTone = useCallback(
    (id: string) => {
      const effect = id === "none" ? NO_TONE : effectById(id);
      adopt({ tone: effect.id, ...effectDialDefaults(effect) });
    },
    [adopt],
  );
  const pickFinish = useCallback(
    (id: string) => {
      const effect = id === "none" ? NO_FINISH : effectById(id);
      adopt({ finish: effect.id, ...effectDialDefaults(effect) });
    },
    [adopt],
  );
  const pickMaterial = useCallback((patch: Partial<Spec>) => adopt(patch), [adopt]);
  const upload = useCallback((pathData: string) => adopt({ shape: "custom", svg: pathData }), [adopt]);
  const rollSurprise = useCallback(() => adopt(surprise(Math.random, spec)), [spec, adopt]);
  /** Back to the preset: every dial where the last pick left it. */
  const undoEdits = useCallback(() => change(baseline), [change, baseline]);
  /** Back to the start: the shape, material, room, backdrop and view the page opens with. */
  const resetAll = useCallback(() => adopt(DEFAULT_SPEC), [adopt]);
  const undoLast = useCallback(() => {
    const last = history.current.pop();
    if (!last) return;
    setHistorySize(history.current.length);
    lastRecord.current = { keys: "", at: 0 };
    specRef.current = last.spec;
    baselineRef.current = last.baseline;
    setSpec(last.spec);
    setBaseline(last.baseline);
    persist(last.spec);
  }, [persist]);

  const edited = useMemo(() => editedKeys(spec, baseline).some((k) => !CAMERA_KEYS.has(k)), [spec, baseline]);
  const changed = useMemo(() => editedKeys(spec, DEFAULT_SPEC).some((k) => !CAMERA_KEYS.has(k)), [spec]);

  // --- the engine ------------------------------------------------------------
  const onReady = useCallback((h: Handle) => {
    setHandle(h);
    h.onCamera((c: CameraState) => {
      setHint(false);
      setSpec((current) => {
        const next = { ...current, ...c };
        persist(next);
        return next;
      });
      setBaseline((b) => ({ ...b, ...c }));
    });
    h.onEnvironment((id, ok) => {
      if (ok) return;
      setFailedEnvironments((s) => new Set(s).add(id));
      setToast("Couldn't load that environment — using Mono instead");
    });
    h.onEffectFailed((id) => {
      setFailedEffects((s) => new Set(s).add(id));
      setSpec((current) => ({ ...current, ...(current.tone === id ? { tone: "none" as const } : current.finish === id ? { finish: "none" as const } : { effect: "none" as const }) }));
      setToast("That effect isn't supported on this device");
    });
  }, [persist]);
  const onError = useCallback(() => setNoWebgl(true), []);
  const onSpecError = useCallback((error: Error) => setToast(`Couldn't draw that. ${error.message}`), []);

  // A material swatch pick comes through Sections' onChange carrying `material`; it is a preset, so it resets the baseline.
  const onSectionChange = useCallback(
    (patch: Partial<Spec>) => {
      if ("material" in patch && patch.material !== "custom") pickMaterial(patch);
      else change({ ...patch, ...("material" in patch ? {} : isMaterialDial(patch) ? { material: "custom" } : {}) });
    },
    [change, pickMaterial],
  );

  // --- drag an SVG onto the scene ----------------------------------------------
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readSvgFile(file, upload, setToast);
  };

  // --- clearing the screen -------------------------------------------------
  // H takes everything but the shape away, for a screenshot or for showing
  // somebody. Any key at all brings it back, so nobody can get stuck behind it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (bare) {
        setBare(false);
        return;
      }
      if (event.key === "h" || event.key === "H") setBare(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bare]);

  // The speed to come back to when auto-spin is switched on again.
  const lastSpin = useRef(DEFAULT_SPEC.autoSpin);
  useEffect(() => {
    if (spec.autoSpin > 0) lastSpin.current = spec.autoSpin;
  }, [spec.autoSpin]);

  // The backdrop to come back to when it is switched on again — solid or
  // gradient, whichever it last was, with its colours still on the dials.
  const lastBackdrop = useRef<Spec["backdrop"]>(DEFAULT_SPEC.backdrop);
  useEffect(() => {
    if (spec.backdrop !== "transparent") lastBackdrop.current = spec.backdrop;
  }, [spec.backdrop]);

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-sg-ink">
      <div
        className={`relative min-w-0 flex-1 ${spec.backdrop === "transparent" ? "sg-checker" : ""}`}
        onPointerDown={() => {
          if (bare) setBare(false);
          // On a phone the drawer lies over the scene; a tap on what is left of the scene is a tap to get it back.
          if (isPhone && open) setDrawer(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {noWebgl ? (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-[13px] leading-relaxed text-sg-muted">
            This needs a browser with 3D support. Try Chrome, Safari or Firefox on a desktop.
          </div>
        ) : (
          <ShapePreview spec={spec} assetBase={assetBase} onReady={onReady} onError={onError} onSpecError={onSpecError} style={{ position: "absolute", inset: 0 }} />
        )}

        {dragging ? <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-white/40" aria-hidden /> : null}

        <p
          className="pointer-events-none absolute left-5 top-5 text-[11px] uppercase tracking-[0.16em] text-sg-faint transition-opacity duration-500"
          style={{ opacity: hint && !bare && !noWebgl ? 1 : 0 }}
          aria-hidden
        >
          {isPhone ? "Drag to orbit · pinch to zoom" : "Drag to orbit · scroll to zoom · H hides the tools"}
        </p>

        <Toast message={toast} onDone={() => setToast(null)} />

        <div className="pointer-events-none absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 transition-opacity duration-200 motion-reduce:transition-none" style={{ opacity: bare ? 0 : 1 }}>
          <div className={bare ? "pointer-events-none" : "pointer-events-auto"}>
            <ExportMenu spec={spec} handle={handle} />
          </div>
          <div className={`flex flex-wrap justify-end gap-1.5 ${bare ? "pointer-events-none" : "pointer-events-auto"}`}>
            <button type="button" className="sg-chip sg-chip--scene" data-on={spec.autoSpin > 0 ? "" : undefined} aria-pressed={spec.autoSpin > 0} onClick={() => change({ autoSpin: spec.autoSpin > 0 ? 0 : lastSpin.current })}>
              Auto-spin
            </button>
            <button type="button" className="sg-chip sg-chip--scene" data-on={spec.floorShadow ? "" : undefined} aria-pressed={spec.floorShadow} onClick={() => change({ floorShadow: !spec.floorShadow })}>
              Shadow
            </button>
            <button
              type="button"
              className="sg-chip sg-chip--scene"
              data-on={spec.backdrop !== "transparent" ? "" : undefined}
              aria-pressed={spec.backdrop !== "transparent"}
              onClick={() => change({ backdrop: spec.backdrop === "transparent" ? lastBackdrop.current : "transparent" })}
            >
              Backdrop
            </button>
            <button type="button" className="sg-chip sg-chip--scene" onClick={() => change({ azimuth: DEFAULT_SPEC.azimuth, elevation: DEFAULT_SPEC.elevation, zoom: DEFAULT_SPEC.zoom })}>
              Reset view
            </button>
          </div>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setDrawer} hidden={bare} overlay={isPhone}>
        <DrawerHeader edited={edited} changed={changed} canUndo={historySize > 0} onUndo={undoLast} onUndoEdits={undoEdits} onReset={resetAll} onSurprise={rollSurprise} onClose={() => setDrawer(false)} query={query} onQuery={setQuery} />

        <div className="sg-scroll sg-scroll-fade relative z-[1] min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-28 pt-3">
          <Sections
            spec={spec}
            baseline={baseline}
            onChange={onSectionChange}
            onPickShape={pickShape}
            onPickEffect={pickEffect}
            onPickTone={pickTone}
            onPickFinish={pickFinish}
            onUpload={upload}
            onToast={setToast}
            query={query}
            failedEnvironments={failedEnvironments}
            failedEffects={failedEffects}
          />
        </div>
      </Drawer>
    </div>
  );
}

const MATERIAL_DIALS = new Set<keyof Spec>(["color", "roughness", "metalness", "clearcoat", "clearcoatRoughness", "transmission", "glassThickness", "ior", "glowColor", "glow", "iridescence", "sheen", "sheenColor", "flat", "surface", "surfaceScale", "surfaceDepth"]);

/** Moving a material dial by hand means the swatch no longer describes it. */
function isMaterialDial(patch: Partial<Spec>): boolean {
  return Object.keys(patch).some((k) => MATERIAL_DIALS.has(k as keyof Spec));
}
