import { SLOT_KEYS, dialKey, effectIn } from "../effects/index";
import { environmentById } from "../environments";
import { materialById } from "../materials";
import { surfaceById } from "../surfaces";
import { shapeById } from "../shapes/catalogue";
import { DEFAULT_SPEC, PARAM_META } from "../spec";
import type { Spec } from "../spec";

const round = (value: number, places = 2) => {
  const factor = 10 ** places;
  return String(Math.round(value * factor) / factor);
};

/**
 * The seeded shapes cannot be rebuilt from their dial numbers — the outline
 * comes from this tool's own shuffled-permutation simplex noise. Spell the
 * recipe out and say plainly that only the character carries over.
 */
const SHAPE_RECIPES: Partial<Record<Spec["shape"], string>> = {
  "blob-spiky":
    "The outline is procedural: every vertex of an icosphere (radius 1, 40 subdivisions, seam vertices merged) is pushed along its normal by offset = simplex3(seed)(vertex × detail) × spikes × 0.45, where simplex3 is 3D simplex noise in −1..1 from a seed-shuffled permutation table. A different noise implementation places the spikes differently — match the character (density from detail, length from spikes), not the exact outline.",
  "blob-soft":
    "The outline is procedural: every vertex of an icosphere (radius 1, 28 subdivisions, seam vertices merged) is pushed along its normal by offset = simplex3(seed)(vertex × 1.2) × amount × 0.35, where simplex3 is 3D simplex noise in −1..1 from a seed-shuffled permutation table. A different noise implementation lands on a different pebble — match the character, not the exact outline.",
};

/**
 * A written description of exactly what is on screen, to hand to Claude,
 * Cursor or ChatGPT so the object can be rebuilt anywhere.
 *
 * Three rules make it useful rather than merely fluent. Everything that differs
 * from the defaults gets said, with its real number — an AI cannot infer
 * "roughness 0.05" from "shiny". Everything left at its default stays
 * unsaid, so the reader can tell what matters. The exceptions are the handful
 * you cannot rebuild anything without — shape, material, environment, camera —
 * which are stated whatever they are set to. And anything bespoke to this tool
 * — a screen effect's shader, a seeded blob's outline — is quoted as code or
 * called out as unreproducible, because no amount of prose lets another
 * renderer reinvent it: a look that leans on the effects is *made* by those
 * passes, and a reader who approximates them gets a different picture.
 */
export function toPrompt(spec: Spec): string {
  const d = DEFAULT_SPEC;
  const changed = (key: keyof Spec) => spec[key] !== d[key];
  const label = (key: keyof Spec) => PARAM_META[key].label.toLowerCase();
  const num = (key: keyof Spec) => `${label(key)} ${round(spec[key] as number)}`;
  const paragraphs: string[] = [];

  // --- shape -------------------------------------------------------------------
  const shape = spec.shape === "custom" ? null : shapeById(spec.shape);
  const shapeLines: string[] = [];
  if (!shape) {
    shapeLines.push("Render a 3D object made from your own SVG: the path is extruded into a solid.");
  } else if (shape.family === "flat") {
    shapeLines.push(`Render a 3D ${shape.name.toLowerCase()}: a flat ${shape.name.toLowerCase()} outline extruded into a solid.`);
  } else {
    shapeLines.push(`Render a 3D ${shape.name.toLowerCase()}.`);
  }
  if (!shape || shape.usesExtrude) {
    shapeLines.push(
      `Thickness ${round(spec.thickness)} of its width, edge rounding ${round(spec.rounding)} (0 is sharp, 1 is fully pillowed)${spec.twist ? `, twisted ${round(spec.twist, 0)}° end to end` : ""}.`,
    );
  }
  if (shape && shape.dials.length) {
    shapeLines.push(shape.dials.map((dial) => `${dial.label.toLowerCase()} ${round(spec[dial.key])}${dial.unit ?? ""}`).join(", ") + ".");
  }
  paragraphs.push(shapeLines.join(" ") + " It is centred and fits a unit sphere.");
  const recipe = SHAPE_RECIPES[spec.shape];
  if (recipe) paragraphs.push(recipe);

  // --- material ----------------------------------------------------------------
  const surface = spec.surface !== "none" ? surfaceById(spec.surface) : null;
  const material = spec.material === "custom" ? null : materialById(spec.material);
  const materialLines: string[] = [
    `${material ? `The material is ${material.name.toLowerCase()}` : "The material is custom"}: a physically based surface, colour ${spec.color}, roughness ${round(spec.roughness)}, metalness ${round(spec.metalness)}.`,
  ];
  if (surface) materialLines.push(`It wears a ${surface.name.toLowerCase()} surface — a tileable normal and roughness map — at ${round(spec.surfaceScale)} tiles across the shape, depth ${round(spec.surfaceDepth)}.`);
  const extras: string[] = [];
  if (spec.clearcoat > 0) extras.push(`${num("clearcoat")} with ${num("clearcoatRoughness")}`);
  if (spec.transmission > 0) extras.push(`${num("transmission")} (transmission), ${num("glassThickness")}, ${num("ior")}`);
  if (spec.glow > 0) extras.push(`${num("glow")} in ${spec.glowColor} (emissive)`);
  if (spec.iridescence > 0) extras.push(num("iridescence"));
  if (spec.sheen > 0) extras.push(`${num("sheen")} in ${spec.sheenColor} (sheen)`);
  if (spec.flat) extras.push("flat shading, so every face is a plane");
  if (extras.length) materialLines.push(`Also: ${extras.join("; ")}.`);
  paragraphs.push(materialLines.join(" "));

  // --- lighting ----------------------------------------------------------------
  const env = environmentById(spec.environment);
  const lightLines: string[] = [];
  if (env.kind === "hdr") {
    lightLines.push(`Lit by an HDRI environment, "${env.name}" (Poly Haven's ${env.source}), strength ${round(spec.envIntensity)}.`);
  } else {
    lightLines.push(`Lit by a generated gradient environment, "${env.name}": ${env.stops!.top} at the top, ${env.stops!.middle} at the horizon, ${env.stops!.bottom} below, strength ${round(spec.envIntensity)}.`);
  }
  if (changed("envBlur")) lightLines.push(`Reflections are blurred ${round(spec.envBlur)}.`);
  if (changed("envRotation")) lightLines.push(`The environment is turned ${round(spec.envRotation, 0)}°.`);
  lightLines.push(
    spec.lightMode === "directional"
      ? `The main light is one directional lamp, intensity ${round(spec.keyIntensity)}, colour ${spec.keyColor}, placed at pad position x ${round(spec.keyX)}, y ${round(spec.keyY)} (x sweeps left to right, y lifts it from the floor to overhead); the environment is dimmed to a quarter.`
      : `A directional key light at pad position x ${round(spec.keyX)}, y ${round(spec.keyY)}, intensity ${round(spec.keyIntensity)}, colour ${spec.keyColor}, adds the highlight and casts the shadow.`,
  );
  paragraphs.push(lightLines.join(" "));

  // --- adjustments -------------------------------------------------------------
  const adjust = (["exposure", "brightness", "contrast", "saturation", "hue", "temperature", "tint"] as const).filter(changed);
  if (adjust.length) paragraphs.push(`Colour grade the result: ${adjust.map((k) => `${label(k)} ${round(spec[k])}${PARAM_META[k].kind === "number" ? (PARAM_META[k].unit ?? "") : ""}`).join(", ")}.`);

  // --- effect ------------------------------------------------------------------
  // A look that leans on the effects is made by them — the gunmetal under a
  // blue-and-white threshold never reaches the screen. So each pass hands over
  // its actual fragment shader (quoted after the closing instruction, so the
  // prose stays readable) rather than asking the reader to reinvent it.
  const shaderBlocks: string[] = [];
  for (const slot of ["texture", "tone", "finish"] as const) {
    const effect = effectIn(spec, slot);
    if (effect.id === "none") continue;
    const keys = SLOT_KEYS[slot];
    const dials = effect.dials.map((dial) => `${dial.label.toLowerCase()} ${round(spec[dialKey(effect, dial)] as number)}${dial.unit ?? ""}`);
    const colours = effect.usesColors ? `, dark ${spec[keys.color1]}, light ${spec[keys.color2]}` : "";
    const when = slot === "texture" ? "Then" : slot === "finish" ? "Finally" : spec.effect === "none" ? "Then" : "After that";
    paragraphs.push(
      `${when} a full-screen ${effect.name.toLowerCase()} effect: ${dials.join(", ")}${colours}. It runs over the whole frame — the backdrop included — after the colour grade${slot === "tone" && spec.effect !== "none" ? " and after the texture effect" : ""}, and keeps the alpha channel. Its exact shader is quoted at the end; use it verbatim, because an approximation gives a different picture.`,
    );
    const uniforms = effect.dials.map((dial) => `u${dial.key.slice(-1)} = ${round(spec[dialKey(effect, dial)] as number)} (${dial.label.toLowerCase()})`);
    if (effect.usesColors) uniforms.push(`uColor1 = ${spec[keys.color1]}, uColor2 = ${spec[keys.color2]}`);
    shaderBlocks.push(
      `The ${effect.name.toLowerCase()} pass, exactly as this tool runs it — tDiffuse is the frame so far, uResolution the canvas size in CSS pixels, ${uniforms.join(", ")}:\n\n\`\`\`glsl${effect.fragment}\n\`\`\``,
    );
  }

  // --- backdrop ----------------------------------------------------------------
  const backdrop =
    spec.backdrop === "transparent"
      ? "The backdrop is transparent."
      : spec.backdrop === "solid"
        ? `The backdrop is a solid ${spec.backdropColor}.`
        : `The backdrop is a gradient from ${spec.backdropColor} to ${spec.backdropColor2} at ${round(spec.backdropAngle, 0)}°.`;
  const shadow = spec.floorShadow ? ` A soft contact shadow falls on an invisible floor just below the shape, strength ${round(spec.shadowOpacity)}, softness ${round(spec.shadowSoftness)}.` : " No floor shadow.";
  paragraphs.push(backdrop + shadow);

  // --- camera ------------------------------------------------------------------
  paragraphs.push(
    `Camera: a ${round(spec.fov, 0)}° lens, orbiting the origin at ${round(spec.azimuth, 0)}° around and ${round(spec.elevation, 0)}° up, zoom ${round(spec.zoom)}×${spec.autoSpin > 0 ? `, turning slowly at ${round(spec.autoSpin, 1)} rpm` : ""}.`,
  );

  paragraphs.push("Render it with Three.js: MeshPhysicalMaterial, an HDRI environment, and a post-processing composer for the colour grade and any screen pass.");
  return paragraphs.concat(shaderBlocks).join("\n\n");
}
