import { Vector3 } from "three";

/** Pad x,y (-1..1) → a point on a hemisphere in front of and around the shape. x sweeps left-right, y lifts the light from the floor to overhead. */
export function keyLightPosition(x: number, y: number, distance: number): Vector3 {
  const azimuth = x * Math.PI * 0.75; // ±135°, so the light can go behind the shape for rim lighting
  const elevation = (0.15 + (y + 1) * 0.5 * 0.8) * (Math.PI / 2); // 13° to 85°
  return new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(distance);
}

/**
 * How much room a unit sphere gets at zoom 1: it fills about 55% of the short
 * side, which leaves a shape somewhere to sit rather than pressing it against
 * the edges. Thumbnails zoom in to fill their tile.
 */
export const FRAME = 1.8;

/** Framing that holds a unit sphere with a margin at any lens, then zoom moves in or out. */
export function cameraPosition(azimuthDeg: number, elevationDeg: number, fov: number, zoom: number): Vector3 {
  const halfAngle = (fov * Math.PI) / 360;
  const distance = FRAME / Math.sin(halfAngle) / zoom;
  const a = (azimuthDeg * Math.PI) / 180, e = (elevationDeg * Math.PI) / 180;
  return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(distance);
}

/** The inverse of cameraPosition, for reading the angles back after a drag. */
export function cameraAngles(position: Vector3, fov: number): { azimuth: number; elevation: number; zoom: number } {
  const distance = position.length();
  const halfAngle = (fov * Math.PI) / 360;
  const zoom = FRAME / Math.sin(halfAngle) / Math.max(distance, 1e-6);
  const elevation = (Math.asin(position.y / Math.max(distance, 1e-6)) * 180) / Math.PI;
  const azimuth = (Math.atan2(position.x, position.z) * 180) / Math.PI;
  return { azimuth, elevation, zoom };
}
