"use client";

import { dialKey, effectIn } from "@/engine/effects/index";
import { shapeById, shapeDials } from "@/engine/shapes/catalogue";
import { PARAM_META } from "@/engine/spec";
import type { Spec } from "@/engine/spec";
import { ColourControl } from "./ColourControl";
import { Pill } from "./Pill";
import { Slider } from "./Slider";

export interface ControlProps {
  name: keyof Spec;
  spec: Spec;
  onChange: (patch: Partial<Spec>) => void;
  /** Reset target for a double-click — the preset's value, not the global default. */
  baseline: Spec;
  /** Phones get the panel to look at, not to use. */
  disabled?: boolean;
}

const ON_OFF = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
];

/** The catalogue entry behind a per-shape or per-effect dial, if the current shape or effect has one. */
function dialFor(name: keyof Spec, spec: Spec) {
  if (name.startsWith("shape")) return shapeDials(shapeById(spec.shape)).find((d) => d.key === name) ?? null;
  const effect = effectIn(spec, name.startsWith("tone") ? "tone" : name.startsWith("finish") ? "finish" : "texture");
  return effect.dials.find((d) => dialKey(effect, d) === name) ?? null;
}

/**
 * One parameter, drawn as whatever its metadata says it is.
 *
 * The editor generates itself from PARAM_META, so a parameter added to the
 * engine arrives here with a control already attached and the two cannot fall
 * out of step. Pickers, the light pad and hidden data are drawn by their
 * sections, not here.
 */
export function Control({ name, spec, onChange, baseline, disabled }: ControlProps) {
  const meta = PARAM_META[name];
  const id = `sg-${name}`;

  const body = (() => {
    if (meta.kind === "number") {
      return (
        <Slider
          id={id}
          label={meta.label}
          value={spec[name] as number}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          unit={meta.unit}
          centred={meta.centred}
          baseline={baseline[name] as number}
          disabled={disabled}
          onChange={(value) => onChange({ [name]: value })}
        />
      );
    }

    if (meta.kind === "dial") {
      const dial = dialFor(name, spec);
      if (!dial) return null;
      return (
        <Slider
          id={id}
          label={dial.label}
          value={spec[name] as number}
          min={dial.min}
          max={dial.max}
          step={dial.step}
          unit={dial.unit}
          baseline={dial.default}
          disabled={disabled}
          onChange={(value) => onChange({ [name]: value })}
        />
      );
    }

    if (meta.kind === "boolean") {
      return (
        <div className="flex min-h-[30px] items-center justify-between gap-3">
          <span className="text-[12.5px] leading-none text-sg-text">{meta.label}</span>
          <div className="w-[96px] shrink-0">
            <Pill label={meta.label} options={ON_OFF} value={(spec[name] as boolean) ? "on" : "off"} disabled={disabled} onChange={(next) => onChange({ [name]: next === "on" })} />
          </div>
        </div>
      );
    }

    if (meta.kind === "enum") {
      return (
        <div className="space-y-1.5">
          <span className="block text-[12.5px] leading-none text-sg-text">{meta.label}</span>
          <Pill label={meta.label} options={meta.options} value={spec[name] as string} disabled={disabled} onChange={(next) => onChange({ [name]: next })} />
        </div>
      );
    }

    if (meta.kind === "color") {
      return <ColourControl id={id} label={meta.label} value={spec[name] as string} baseline={baseline[name] as string} disabled={disabled} onChange={(value) => onChange({ [name]: value })} />;
    }

    return null;
  })();

  if (!body) return null;
  const hint = "hint" in meta ? meta.hint : undefined;
  return (
    <div className="px-3.5 py-1.5">
      {body}
      {hint ? <p className="mt-1.5 px-0.5 text-[10.5px] leading-snug text-sg-faint">{hint}</p> : null}
    </div>
  );
}
