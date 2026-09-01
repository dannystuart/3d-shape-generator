import { BufferGeometry, ExtrudeGeometry, Shape, ShapePath, Vector2, Vector3 } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { normalise, twist as twistGeometry } from "./geometry";

export interface ExtrudeDials {
  thickness: number;
  rounding: number;
  twist: number;
}

/** The most points an upload may carry before it is refused. A logo is hundreds; a traced photograph is hundreds of thousands. */
export const MAX_PATH_POINTS = 20_000;

/**
 * Path data → filled shapes with holes. SVGLoader does the parsing (arcs,
 * curves, relative commands, the lot) and `createShapes` sorts outer rings
 * from holes by winding and containment. (Its own solver, rather than
 * `ShapePath.toShapes`, whose winding argument became optional only in a three
 * newer than the host site pins.)
 */
export function shapesFromPath(d: string): Shape[] {
  const path = parseWithLoader(d);
  const shapes = SVGLoader.createShapes(path);
  const filled = shapes.filter((s) => s.curves.length >= 2 && s.getPoints(4).length >= 3);
  if (filled.length === 0) throw new Error("Nothing to fill: the path has no closed area.");
  const points = filled.reduce(
    (n, s) => n + s.getPoints(8).length + s.holes.reduce((h, hole) => h + hole.getPoints(8).length, 0),
    0,
  );
  if (points > MAX_PATH_POINTS) throw new Error(`Too detailed: ${points} points, the limit is ${MAX_PATH_POINTS}.`);
  return filled;
}

// SVGLoader has no public "parse one `d`";
// wrapping the data in a one-path document is the stable route.
function parseWithLoader(d: string): ShapePath {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d.replace(/"/g, "'")}"/></svg>`;
  const data = new SVGLoader().parse(svg);
  if (data.paths.length === 0) throw new Error("Nothing to fill: the path could not be read.");
  return data.paths[0];
}

/** Bounding box of a shape set, in path units, for sizing the bevel against the shape rather than against the file. */
function extent(shapes: Shape[]): number {
  const min = new Vector2(Infinity, Infinity),
    max = new Vector2(-Infinity, -Infinity);
  for (const s of shapes)
    for (const p of s.getPoints(4)) {
      min.min(p);
      max.max(p);
    }
  return Math.max(max.x - min.x, max.y - min.y, 1e-6);
}

/**
 * The flat-shape family's one builder. Thickness and rounding are fractions of
 * the shape's width, so a 24px icon and a 2000px logo get the same treatment.
 * Rounding 0 is a sharp extrusion; 1 rounds the edge by half the thickness,
 * which is as far as a bevel can go before it eats the shape.
 */
export function extrudePath(d: string, dials: ExtrudeDials): BufferGeometry {
  const shapes = shapesFromPath(d);
  const size = extent(shapes);
  const depth = size * Math.max(dials.thickness, 0.02);
  const bevel = dials.rounding * depth * 0.5;
  const bevelSegments = bevel > 0 ? Math.max(4, Math.round(6 + dials.rounding * 10)) : 0;
  const geometry = new ExtrudeGeometry(shapes, {
    depth,
    curveSegments: 24,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.98,
    bevelOffset: 0,
    bevelSegments,
    UVGenerator: surfaceUvGenerator(1 + bevelSegments * 2),
  });
  // What normalise() should size one tile against: the face, so the walls' long run round the outline does not coarsen the grain.
  geometry.userData.uvSpan = size;
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI);
  twistGeometry(geometry, dials.twist);
  // ExtrudeGeometry shades every bevel strip flat, which reads as a staircase,
  // and a twist recomputes normals flat again — so this runs last. Blend
  // normals across anything gentler than 40°: the bevel is one smooth roll and
  // a genuinely sharp corner (rounding 0) stays sharp.
  const smoothed = toCreasedNormals(geometry, (40 * Math.PI) / 180);
  smoothed.userData = geometry.userData;
  geometry.dispose();
  // SVG y runs down. A half-turn about x puts it the right way up without
  // mirroring (a mirror scale would turn every face inside out), and with the
  // depth centred first, the turn keeps it centred.
  return normalise(smoothed);
}

/**
 * Texture coordinates a surface can sit on.
 *
 * ExtrudeGeometry's own generator reads the side walls' UVs off their x and
 * y, which smears a texture into streaks along the depth. This one is handed
 * every wall quad as it is built — for each outline point, the quads from the
 * bottom cap up to the top — so it can run one axis along the outline the
 * walls actually sit on (the rounded one, pushed out by the bevel, not the
 * shape's) and the other down the profile, bevel curve and all, in the same
 * units as the caps' flat (x, y) map. The grain is then one size everywhere:
 * the front, the edge, the roll between them, and right round a gear's teeth.
 */
function surfaceUvGenerator(layers: number): NonNullable<ConstructorParameters<typeof ExtrudeGeometry>[1]>["UVGenerator"] {
  const A = new Vector3(), B = new Vector3(), D = new Vector3();
  const at = (vertices: number[], i: number, out: Vector3) => out.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
  // Running distance along each layer of the wall, and where on the bottom
  // layer the last quad ended: the next quad starts there, unless a new
  // outline (a hole, or the next shape) has begun, which shows as a jump.
  let along: number[] = [];
  const last = new Vector3(NaN, NaN, NaN);
  let down = 0;
  let quad = 0;
  return {
    generateTopUV(_geometry, vertices, a, b, c) {
      return [new Vector2(vertices[a * 3], vertices[a * 3 + 1]), new Vector2(vertices[b * 3], vertices[b * 3 + 1]), new Vector2(vertices[c * 3], vertices[c * 3 + 1])];
    },
    generateSideWallUV(_geometry, vertices, a, b, _c, d) {
      at(vertices, a, A);
      at(vertices, b, B);
      at(vertices, d, D);
      // The quads for one outline point come bottom to top, `layers` of them.
      const layer = quad % layers;
      quad += 1;
      if (layer === 0) {
        down = 0;
        if (last.distanceToSquared(A) > 1e-12) along = [];
        last.copy(B);
      }
      const u0 = along[layer] ?? 0;
      // The outline is walked backwards, so the distance runs negative; the texture wraps, and it is re-based later anyway.
      const u1 = u0 - A.distanceTo(B);
      along[layer] = u1;
      const v0 = down;
      down += A.distanceTo(D);
      return [new Vector2(u0, v0), new Vector2(u1, v0), new Vector2(u1, down), new Vector2(u0, down)];
    },
  };
}
