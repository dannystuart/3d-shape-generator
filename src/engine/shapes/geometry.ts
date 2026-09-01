import { BufferAttribute, BufferGeometry, Curve, Float32BufferAttribute, LatheGeometry, Matrix4, Vector2, Vector3 } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** Every shape ends up the same size in the same place, so the camera, the lights and the shadow never need per-shape tuning. */
export function normalise(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!;
  geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
  const s = 1 / Math.max(sphere.radius, 1e-6);
  geometry.scale(s, s, s);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  fitUv(geometry);
  return geometry;
}

/**
 * Brings a geometry's UVs to one tile per shape-width, whatever units it was
 * drawn in, and works out how many tiles each axis needs so the grain is the
 * same size both ways.
 *
 * An extruded shape is mapped in its own units (the face flat, the walls by
 * distance round the outline), so one factor scales both axes to the face.
 * Three's parametric shapes (sphere, torus, lathe, tube) run 0..1 each way
 * however long that way round is — a thin ring's tube is a tenth the length
 * of its rim, and a texture would be stretched ten to one. So the world
 * length of each axis is measured off the triangles and the tile repeated to
 * match; `uvRepeat` is what the renderer multiplies the surface scale by.
 */
function fitUv(geometry: BufferGeometry): void {
  const uv = geometry.getAttribute("uv") as BufferAttribute | undefined;
  if (!uv) return;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  // The tile is sized to the shape's face, not to the longest run of UV: an
  // extruded shape's walls are mapped by distance round the outline, which
  // is several times the width and must not make the face's grain coarser.
  const span = (geometry.userData.uvSpan as number | undefined) ?? Math.max(maxU - minU, maxV - minV);
  if (span > 0 && !(minU >= -0.01 && maxU <= 1.01 && minV >= -0.01 && maxV <= 1.01)) {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - minU) / span, (uv.getY(i) - minV) / span);
    uv.needsUpdate = true;
    geometry.userData.uvRepeat = [1, 1];
    return;
  }
  geometry.userData.uvRepeat = uvRepeat(geometry);
}

/**
 * Tiles per axis for a geometry whose UVs run 0..1 each way. The world length
 * of a full run of u and of v is measured off the triangles (weighted by area,
 * so a cap's fan of slivers does not outvote the side). The shorter run gets
 * a tile about a shape-width across (a normalised shape is two units wide,
 * and an extruded face gets one tile across its width), and the longer run
 * gets as many of that tile as fit. Whole numbers both ways, so the tile
 * meets itself where an axis wraps round.
 */
function uvRepeat(geometry: BufferGeometry): [number, number] {
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  const at = (t: number) => (index ? index.getX(t) : t);
  const P = [new Vector3(), new Vector3(), new Vector3()], U = [new Vector2(), new Vector2(), new Vector2()];
  const e1 = new Vector3(), e2 = new Vector3(), du = new Vector3(), dv = new Vector3();
  const alongU: [number, number][] = [], alongV: [number, number][] = [];
  for (let t = 0; t < count; t += 3) {
    for (let k = 0; k < 3; k++) {
      P[k].fromBufferAttribute(pos, at(t + k));
      U[k].set(uv.getX(at(t + k)), uv.getY(at(t + k)));
    }
    // World movement per unit of u and of v, solved from the triangle's two edges.
    const a1 = U[1].x - U[0].x, b1 = U[1].y - U[0].y, a2 = U[2].x - U[0].x, b2 = U[2].y - U[0].y;
    const det = a1 * b2 - b1 * a2;
    if (Math.abs(det) < 1e-12) continue;
    e1.subVectors(P[1], P[0]);
    e2.subVectors(P[2], P[0]);
    const area = e1.clone().cross(e2).length();
    if (area < 1e-12) continue;
    du.copy(e1).multiplyScalar(b2 / det).addScaledVector(e2, -b1 / det);
    dv.copy(e2).multiplyScalar(a1 / det).addScaledVector(e1, -a2 / det);
    alongU.push([du.length(), area]);
    alongV.push([dv.length(), area]);
  }
  const median = (arr: [number, number][]) => {
    if (!arr.length) return 2;
    const s = [...arr].sort((x, y) => x[0] - y[0]);
    const half = s.reduce((sum, [, w]) => sum + w, 0) / 2;
    let acc = 0;
    for (const [v, w] of s) {
      acc += w;
      if (acc >= half) return v;
    }
    return s[s.length - 1][0];
  };
  const lenU = median(alongU), lenV = median(alongV);
  const short = Math.min(lenU, lenV), long = Math.max(lenU, lenV);
  const tilesShort = Math.max(1, Math.round(short / 2));
  const tile = short / tilesShort;
  const tilesLong = Math.max(1, Math.round(long / tile));
  return lenU <= lenV ? [tilesShort, tilesLong] : [tilesLong, tilesShort];
}

/** Rotates each vertex about z by an angle proportional to its z, over the geometry's z extent. `degrees` is the total end-to-end twist. */
export function twist(geometry: BufferGeometry, degrees: number): BufferGeometry {
  if (degrees === 0) return geometry;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const span = Math.max(max.z - min.z, 1e-6);
  const pos = geometry.getAttribute("position") as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = (v.z - min.z) / span - 0.5;
    const a = (k * degrees * Math.PI) / 180;
    const c = Math.cos(a),
      s = Math.sin(a);
    pos.setXY(i, v.x * c - v.y * s, v.x * s + v.y * c);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Pushes every vertex along its normal by `amount * noise(p * frequency)`. Works on a merged (indexed) geometry so the surface stays watertight. */
export function displace(
  geometry: BufferGeometry,
  noise: (x: number, y: number, z: number) => number,
  frequency: number,
  amount: number,
): BufferGeometry {
  // The UV seam splits the sphere's vertices in two down one meridian. Those
  // twins never merge, so they are pushed and lit separately and a hairline
  // crack opens between them. Nothing here is textured, so the UVs can go.
  geometry.deleteAttribute("uv");
  const merged = mergeVertices(geometry);
  merged.computeVertexNormals();
  const pos = merged.getAttribute("position") as BufferAttribute;
  const nor = merged.getAttribute("normal") as BufferAttribute;
  const p = new Vector3(),
    n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const d = noise(p.x * frequency, p.y * frequency, p.z * frequency) * amount;
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
  }
  pos.needsUpdate = true;
  merged.computeVertexNormals();
  // UVs back, wrapped round the blob from its centre, so a surface texture has
  // somewhere to sit. The one seam this leaves is in the texture, not the mesh.
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    uv[i * 2] = 0.5 + Math.atan2(p.z, p.x) / (Math.PI * 2);
    uv[i * 2 + 1] = 0.5 + Math.asin(Math.max(-1, Math.min(1, p.y))) / Math.PI;
  }
  merged.setAttribute("uv", new BufferAttribute(uv, 2));
  return merged;
}

export function circleProfile(radius: number, sides: number): Vector2[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    return new Vector2(Math.cos(a) * radius, Math.sin(a) * radius);
  });
}

/** A rounded polygon cross-section: `sides` corners, `corner` 0..1 of rounding. sides=4, corner=0 is a square tube; sides=64 is a circle. */
export function polygonProfile(radius: number, sides: number, corner: number, pointsPerSide = 6): Vector2[] {
  const out: Vector2[] = [];
  const r = radius;
  // How far back from each corner the straight edge stops. Capped at half an
  // edge so two roundings never cross.
  const edgeLen = 2 * r * Math.sin(Math.PI / sides);
  const rc = Math.min(Math.min(corner, 1) * r * Math.tan(Math.PI / sides), edgeLen / 2);
  const vertex = (i: number) => {
    const a = (i / sides) * Math.PI * 2;
    return new Vector2(Math.cos(a) * r, Math.sin(a) * r);
  };
  for (let i = 0; i < sides; i++) {
    const c0 = vertex(i), c1 = vertex(i + 1), c2 = vertex(i + 2);
    const edge = c1.clone().sub(c0).normalize();
    const next = c2.clone().sub(c1).normalize();
    const start = c0.clone().addScaledVector(edge, rc);
    const end = c1.clone().addScaledVector(edge, -rc);
    out.push(start);
    if (rc <= 0) continue;
    out.push(end);
    // Round the corner at c1 with a quadratic bezier from `end` through c1 to the start of the next edge.
    const nextStart = c1.clone().addScaledVector(next, rc);
    for (let k = 1; k < pointsPerSide; k++) {
      const t = k / pointsPerSide;
      const p = end
        .clone()
        .multiplyScalar((1 - t) * (1 - t))
        .add(c1.clone().multiplyScalar(2 * (1 - t) * t))
        .add(nextStart.clone().multiplyScalar(t * t));
      out.push(p);
    }
  }
  return out;
}

/**
 * Sweeps a 2D profile along a curve. Circular profiles make ordinary tubes; a
 * square or triangle profile with `twistTurns` makes the twisted torus. The
 * frames come from the curve's own Frenet frames, so a closed path closes.
 */
export function sweep(path: Curve<Vector3>, profile: Vector2[], segments: number, twistTurns: number, closed = true): BufferGeometry {
  const frames = path.computeFrenetFrames(segments, closed);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const P = new Vector3(), N = new Vector3(), B = new Vector3(), v = new Vector3(), nrm = new Vector3();
  const m = profile.length;
  const round = arcLengths([...profile, profile[0]]);
  const place = (i: number, j: number, t: number, c: number, s: number) => {
    const q = profile[j % m];
    const x = q.x * c - q.y * s, y = q.x * s + q.y * c;
    v.copy(P).addScaledVector(N, x).addScaledVector(B, y);
    positions.push(v.x, v.y, v.z);
    nrm.set(0, 0, 0).addScaledVector(N, x).addScaledVector(B, y).normalize();
    normals.push(nrm.x, nrm.y, nrm.z);
    // Texture runs by distance round the profile, not by point count: a rounded corner packs its points close.
    uvs.push(t, round[j]);
  };
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    path.getPointAt(closed ? t % 1 : t, P);
    // computeFrenetFrames returns segments+1 frames; for a closed curve the last equals the first.
    const f = Math.min(i, frames.normals.length - 1);
    N.copy(frames.normals[f]);
    B.copy(frames.binormals[f]);
    const spin = t * twistTurns * Math.PI * 2;
    const c = Math.cos(spin), s = Math.sin(spin);
    for (let j = 0; j < m; j++) place(i, j, t, c, s);
    // Close the profile ring with a duplicate of the first point for clean UVs.
    place(i, m, t, c, s);
  }
  const ring = m + 1;
  // Which way round the faces go depends on the profile's direction and the
  // curve's, so check the first quad against its own analytic normal and wind
  // every face to match — the surface always ends up facing out.
  const p0 = new Vector3().fromArray(positions, 0), p1 = new Vector3().fromArray(positions, ring * 3), p2 = new Vector3().fromArray(positions, 3);
  const n0 = new Vector3().fromArray(normals, 0);
  const outward = p1.sub(p0).cross(p2.sub(p0)).dot(n0) >= 0;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < m; j++) {
      const a = i * ring + j, b = a + ring, c = a + 1, d = b + 1;
      if (outward) indices.push(a, b, c, c, b, d);
      else indices.push(a, c, b, c, d, b);
    }
  }
  if (!closed) {
    // Cap both ends with a fan from the ring's centre, facing along the tangent.
    for (const end of [0, segments]) {
      const T = frames.tangents[Math.min(end, frames.tangents.length - 1)].clone().multiplyScalar(end === 0 ? -1 : 1);
      path.getPointAt(end / segments, P);
      const centre = positions.length / 3;
      positions.push(P.x, P.y, P.z);
      normals.push(T.x, T.y, T.z);
      uvs.push(end / segments, 0.5);
      // Same trick as the tube: wind the fan so its faces point along T.
      const q0 = new Vector3().fromArray(positions, end * ring * 3), q1 = new Vector3().fromArray(positions, (end * ring + 1) * 3);
      const forward = q0.clone().sub(P).cross(q1.sub(P)).dot(T) >= 0;
      for (let j = 0; j < m; j++) {
        const a = end * ring + j, b = end * ring + j + 1;
        if (forward) indices.push(centre, a, b);
        else indices.push(centre, b, a);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  // Polygon profiles want hard edges along their corners; recomputing from faces gives that.
  if (m <= 8) g.computeVertexNormals();
  return g;
}

/** Each point's distance along a polyline as a fraction of the whole, 0 at the first point and 1 at the last. */
function arcLengths(points: Vector2[]): number[] {
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = at[at.length - 1] || 1;
  return at.map((d) => d / total);
}

/**
 * A LatheGeometry whose texture runs by distance along the profile. Three's
 * spaces it by point count, and a profile with rounded corners has most of its
 * points in the corners, so a texture on it would bunch there and stretch
 * across the straights.
 */
export function lathe(points: Vector2[], segments: number): BufferGeometry {
  const g = new LatheGeometry(points, segments);
  const uv = g.getAttribute("uv");
  const along = arcLengths(points);
  // Vertices come profile point by profile point within each spoke.
  for (let i = 0; i < uv.count; i++) uv.setY(i, along[i % points.length]);
  uv.needsUpdate = true;
  return g;
}

export const IDENTITY = new Matrix4();
