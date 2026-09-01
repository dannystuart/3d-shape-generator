import { PARAM_META } from "@/engine/spec";
import type { Spec } from "@/engine/spec";

/**
 * Which dials sit somewhere other than where the preset put them.
 *
 * Drives three things at once: the reset beside a slider, the dot on a folded
 * section, and whether the header shows its "Edited" chip at all. One answer, so
 * the three can never disagree with each other.
 */
export function editedKeys(
  params: Spec,
  baseline: Spec,
): (keyof Spec)[] {
  return (Object.keys(PARAM_META) as (keyof Spec)[]).filter((key) => params[key] !== baseline[key]);
}
