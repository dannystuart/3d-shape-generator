"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FINISHES, TEXTURES, TONES, dialKey, effectIn } from "@/engine/effects/index";
import { ENVIRONMENTS } from "@/engine/environments";
import { MATERIALS, materialPatch } from "@/engine/materials";
import { SHAPES, shapeById } from "@/engine/shapes/catalogue";
import { PARAM_META, SECTIONS } from "@/engine/spec";
import { SURFACES } from "@/engine/surfaces";
import type { Section, Spec } from "@/engine/spec";
import { BackdropPicker } from "./BackdropPicker";
import { Control } from "./Control";
import { EffectPicker } from "./EffectPicker";
import { EnvironmentPicker } from "./EnvironmentPicker";
import { LightPad } from "./LightPad";
import { MaterialPicker } from "./MaterialPicker";
import { Pill } from "./Pill";
import { ShapePicker } from "./ShapePicker";
import { Chips } from "./Tiles";
import { editedKeys } from "./edited";

export interface SectionsProps {
  spec: Spec;
  baseline: Spec;
  onChange: (patch: Partial<Spec>) => void;
  /** Picking a shape or an effect also resets its dials; the Editor owns that rule. */
  onPickShape: (id: string) => void;
  onPickEffect: (id: string) => void;
  onPickTone: (id: string) => void;
  onPickFinish: (id: string) => void;
  onUpload: (pathData: string, name: string) => void;
  onToast: (message: string) => void;
  /** What is typed in the search box. Empty means the folds behave normally. */
  query?: string;
  /** Environments that fell back and effects that would not compile, this session. */
  failedEnvironments?: Set<string>;
  failedEffects?: Set<string>;
  /** Phones see the whole panel, greyed and inert. */
  disabled?: boolean;
}

const ALL_KEYS = Object.keys(PARAM_META) as (keyof Spec)[];
const MATERIAL_TABS = [
  { value: "library", label: "Library" },
  { value: "settings", label: "Settings" },
];

export function Sections({ spec, baseline, onChange, onPickShape, onPickEffect, onPickTone, onPickFinish, onUpload, onToast, query = "", failedEnvironments, failedEffects, disabled }: SectionsProps) {
  // One fold open at a time: the panel is long, and two open sections push
  // everything else off screen. The page opens on the shapes.
  const [open, setOpen] = useState<Section | null>("shape");
  const [materialTab, setMaterialTab] = useState("library");

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    return new Set(ALL_KEYS.filter((key) => PARAM_META[key].label.toLowerCase().includes(needle)));
  }, [needle]);
  const edited = useMemo(() => new Set(editedKeys(spec, baseline)), [spec, baseline]);

  // A search covers the pictures too: "heart" should find the heart, not
  // report that no dial is called heart.
  const pickerHits = useMemo((): Partial<Record<Section, number>> => {
    if (!needle) return {};
    const hit = (name: string, keywords: string[] = []) => name.toLowerCase().includes(needle) || keywords.some((k) => k.includes(needle));
    return {
      shape: SHAPES.filter((x) => hit(x.name, x.keywords)).length,
      material: MATERIALS.filter((x) => hit(x.name)).length,
      lighting: ENVIRONMENTS.filter((x) => hit(x.name)).length,
      effect: [...TEXTURES, ...TONES, ...FINISHES].filter((x) => hit(x.name)).length,
    };
  }, [needle]);
  const anyPickerHit = Object.values(pickerHits).some((n) => n > 0);

  const shape = shapeById(spec.shape);
  const texture = effectIn(spec, "texture");
  const tone = effectIn(spec, "tone");
  const finish = effectIn(spec, "finish");

  /** Whether a control belongs on screen right now — the section-specific rules live here. */
  const shows = (key: keyof Spec): boolean => {
    if (matches && !matches.has(key)) return false;
    const meta = PARAM_META[key];
    if (meta.kind === "picker" || meta.kind === "pad" || meta.kind === "hidden") return false;
    switch (key) {
      case "thickness":
      case "rounding":
      case "twist":
        return shape.usesExtrude;
      case "shapeA":
      case "shapeB":
      case "shapeC":
        return shape.dials.some((d) => d.key === key);
      case "effectA":
      case "effectB":
      case "effectC":
        return texture.dials.some((d) => dialKey(texture, d) === key);
      case "effectColor1":
      case "effectColor2":
        return texture.id !== "none" && texture.usesColors;
      case "toneA":
      case "toneB":
        return tone.dials.some((d) => dialKey(tone, d) === key);
      case "finishA":
      case "finishB":
      case "finishC":
        return finish.dials.some((d) => dialKey(finish, d) === key);
      case "toneColor1":
      case "toneColor2":
        return tone.id !== "none" && tone.usesColors;
      case "backdropColor":
        return spec.backdrop !== "transparent";
      case "backdropColor2":
      case "backdropAngle":
        return spec.backdrop === "gradient";
      case "shadowOpacity":
      case "shadowSoftness":
        return spec.floorShadow;
      case "surfaceScale":
      case "surfaceDepth":
        return spec.surface !== "none";
      // Dials that only qualify another dial are hidden while that one is off:
      // coat roughness on a material with no coat changes nothing at all.
      case "clearcoatRoughness":
        return spec.clearcoat > 0;
      case "glassThickness":
      case "ior":
        return spec.transmission > 0;
      case "glowColor":
        return spec.glow > 0;
      case "sheenColor":
        return spec.sheen > 0;
      default:
        return true;
    }
  };

  const keysIn = (section: Section) => ALL_KEYS.filter((key) => PARAM_META[key].section === section && shows(key));
  const controls = (keys: (keyof Spec)[]) => keys.map((key) => <Control key={key} name={key} spec={spec} baseline={baseline} onChange={onChange} disabled={disabled} />);

  if (matches && matches.size === 0 && !anyPickerHit) {
    return <p className="px-4 py-6 text-[12px] text-sg-faint">No controls match “{query.trim()}”.</p>;
  }

  /** The picker and any special furniture that sits above a section's controls. Only when not searching. */
  const furniture = (section: Section): ReactNode => {
    if (matches) {
      // Searching: just the pictures that match, without the chips and pads around them.
      if (!pickerHits[section]) return null;
      switch (section) {
        case "shape":
          return <ShapePicker value={spec.shape} svg={spec.svg} query={query} onPick={onPickShape} onUpload={onUpload} onError={onToast} disabled={disabled} />;
        case "material":
          return <MaterialPicker value={spec.material} query={query} onPick={(id) => onChange({ material: id, ...materialPatch(id) })} disabled={disabled} />;
        case "lighting":
          return <EnvironmentPicker value={spec.environment} query={query} onPick={(id) => onChange({ environment: id })} failed={failedEnvironments} disabled={disabled} />;
        case "effect":
          return (
            <>
              <EffectPicker value={spec.effect} query={query} onPick={onPickEffect} failed={failedEffects} disabled={disabled} />
              <EffectPicker value={spec.tone} slot="tone" query={query} onPick={onPickTone} failed={failedEffects} disabled={disabled} />
              <EffectPicker value={spec.finish} slot="finish" query={query} onPick={onPickFinish} failed={failedEffects} disabled={disabled} />
            </>
          );
        default:
          return null;
      }
    }
    switch (section) {
      case "shape":
        return (
          <>
            <ShapePicker value={spec.shape} svg={spec.svg} onPick={onPickShape} onUpload={onUpload} onError={onToast} disabled={disabled} />
            {shape.note ? <p className="px-3.5 pt-2 text-[10.5px] text-sg-faint">{shape.note}</p> : null}
          </>
        );
      case "material":
        return (
          <div className="px-3.5 pb-2">
            <Pill label="Material view" options={MATERIAL_TABS} value={materialTab} onChange={setMaterialTab} disabled={disabled} />
          </div>
        );
      case "lighting":
        return (
          <>
            <EnvironmentPicker value={spec.environment} onPick={(id) => onChange({ environment: id })} failed={failedEnvironments} disabled={disabled} />
            <div className="px-3.5 pt-3">
              <LightPad x={spec.keyX} y={spec.keyY} onChange={onChange} disabled={disabled} />
            </div>
          </>
        );
      case "backdrop":
        return <BackdropPicker spec={spec} onPick={onChange} disabled={disabled} />;
      case "effect":
        // Two slots, each its own picker with its own dials under it, so a
        // dial sits beside the picture it belongs to. Texture first, because
        // that is the order they run in.
        return (
          <>
            <SlotTitle>Texture</SlotTitle>
            <EffectPicker value={spec.effect} onPick={onPickEffect} failed={failedEffects} disabled={disabled} />
            {controls(keysIn("effect").filter((k) => k.startsWith("effect")))}
            <SlotTitle>Colour</SlotTitle>
            <EffectPicker value={spec.tone} slot="tone" onPick={onPickTone} failed={failedEffects} disabled={disabled} />
            {controls(keysIn("effect").filter((k) => k.startsWith("tone")))}
            <SlotTitle>Finish</SlotTitle>
            <EffectPicker value={spec.finish} slot="finish" onPick={onPickFinish} failed={failedEffects} disabled={disabled} />
            {controls(keysIn("effect").filter((k) => k.startsWith("finish")))}
            <p className="px-3.5 pt-1 text-[10.5px] leading-snug text-sg-faint">One of each, in order: the texture restructures, the colour remaps, the finish softens over the top.</p>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-2">
      {SECTIONS.map((section) => {
        const keys = keysIn(section.id);
        const hasFurniture = matches ? Boolean(pickerHits[section.id]) : ["shape", "material", "lighting", "effect", "backdrop"].includes(section.id);
        if (keys.length === 0 && !hasFurniture) return null;
        // A search shows what it found. Hiding a match behind a fold would make
        // the box a way of learning that something exists and nothing more.
        const isOpen = Boolean(matches) || open === section.id;
        const dirty = keys.some((key) => edited.has(key));
        const toggle = () => setOpen(open === section.id ? null : section.id);
        // Library shows the swatches in place of the dials; Settings shows the dials.
        const body =
          section.id === "effect" && !matches ? null : section.id === "material" && !matches && materialTab === "library" ? (
            <MaterialPicker value={spec.material} onPick={(id) => onChange({ material: id, ...materialPatch(id) })} disabled={disabled} />
          ) : section.id === "material" && !matches ? (
            // Settings: the surface (bumps and grooves) first, as a row of names, then the dials.
            <>
              <p className="px-3.5 pb-1.5 pt-1 text-[10.5px] leading-none text-sg-muted">Surface</p>
              <Chips chips={SURFACES.map((s) => ({ value: s.id, label: s.name }))} value={spec.surface} onChange={(id) => onChange({ surface: id })} />
              {controls(keys)}
            </>
          ) : (
            controls(keys)
          );

        return (
          <section key={section.id} className="border-b border-sg-line/70 last:border-b-0">
            <h3>
              <button type="button" onClick={toggle} aria-expanded={isOpen} className="flex min-h-11 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60">
                <span className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-sg-muted">
                  {section.title}
                  {dirty ? <span data-edited aria-label="edited" className="h-1 w-1 rounded-full bg-sg-text/70" /> : null}
                </span>
                <span aria-hidden className={`font-sg-mono text-[11px] text-sg-faint transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
            </h3>
            {isOpen ? (
              <div className="space-y-1 pb-2.5">
                {furniture(section.id)}
                {body}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** The name over one of the two effect slots. */
function SlotTitle({ children }: { children: ReactNode }) {
  return <p className="px-3.5 pb-1.5 pt-2 text-[10.5px] leading-none text-sg-muted">{children}</p>;
}
