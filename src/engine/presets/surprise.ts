import { NO_TONE, TEXTURES, TONES, effectDialDefaults } from "../effects/index";
import { ENVIRONMENTS } from "../environments";
import { MATERIALS, materialPatch } from "../materials";
import { SHAPES, shapeDialDefaults } from "../shapes/catalogue";
import type { Spec } from "../spec";

/**
 * A new shape, material and room, and now and then an effect.
 *
 * The carousel's lesson: never roll the dials. A random roughness or a random
 * twist is a random mess; a random *combination of presets* is a picture
 * somebody made on purpose. Backdrop, camera and the colour grade are left
 * alone — they are the visitor's framing, not the subject.
 */
export function surprise(rng: () => number, current: Spec): Spec {
  const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length) % list.length];
  let shape = pick(SHAPES), material = pick(MATERIALS);
  // Never the same pair twice in a row — a surprise that changes nothing is a broken button.
  for (let guard = 0; guard < 20 && shape.id === current.shape && material.id === current.material; guard++) {
    shape = pick(SHAPES);
    material = pick(MATERIALS);
  }
  const environment = pick(ENVIRONMENTS);
  const effect = rng() < 0.3 ? pick(TEXTURES.filter((e) => e.id !== "none")) : TEXTURES[0];
  const tone = rng() < 0.2 ? pick(TONES.filter((e) => e.id !== "none")) : NO_TONE;
  return {
    ...current,
    shape: shape.id,
    ...shapeDialDefaults(shape),
    material: material.id,
    ...materialPatch(material.id),
    environment: environment.id,
    effect: effect.id,
    ...effectDialDefaults(effect),
    tone: tone.id,
    ...effectDialDefaults(tone),
  };
}
