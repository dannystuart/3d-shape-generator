import type { Mesh } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

/**
 * The mesh with its PBR material as a binary glTF, for Blender, Spline,
 * Figma and the rest. Lighting, the backdrop and the screen effect do not
 * travel — they are ours, not the object's.
 */
export async function toGlb(mesh: Mesh): Promise<ArrayBuffer> {
  const clone = mesh.clone();
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.setScalar(1);
  const out = await new GLTFExporter().parseAsync(clone, { binary: true });
  return out as ArrayBuffer;
}
