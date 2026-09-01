import { ShapeUtils } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { MAX_PATH_POINTS } from "./extrude";

/**
 * An uploaded SVG file → one path-data string the engine can extrude.
 *
 * SVGLoader reads every filled element — paths, rects, circles, polygons — and
 * bakes their transforms in. Each outline and hole is written back out as a
 * straight-line subpath, so the result is plain `M … L … Z` data with nothing
 * left to interpret. Strokes are ignored: there is no area in a line.
 */
export function pathDataFromSvg(text: string): string {
  const { paths } = new SVGLoader().parse(text);
  const parts: string[] = [];
  let points = 0;
  for (const path of paths) {
    const style = (path.userData?.style ?? {}) as { fill?: string };
    if (style.fill === "none") continue;
    // createShapes, not path.toShapes(): its winding argument is required on
    // the three the host pins (0.184). See extrude.ts for the whole story.
    for (const shape of SVGLoader.createShapes(path)) {
      const rings = [shape.getPoints(12), ...shape.holes.map((h) => h.getPoints(12))];
      for (const ring of rings) {
        if (ring.length < 3 || Math.abs(ShapeUtils.area(ring)) < 1e-6) continue;
        points += ring.length;
        parts.push("M" + ring.map((p) => `${round(p.x)} ${round(p.y)}`).join("L") + "Z");
      }
    }
  }
  if (parts.length === 0) throw new Error("Nothing to fill: the file has no filled shapes. Outline any strokes first.");
  if (points > MAX_PATH_POINTS) throw new Error(`Too detailed: ${points} points, the limit is ${MAX_PATH_POINTS}. Simplify the paths first.`);
  return parts.join("");
}

const round = (n: number) => Math.round(n * 100) / 100;
