/** The engine's public surface. Nothing in here imports React. */
export { mount } from "./renderer";
export type { Handle, MountOptions, CameraState } from "./renderer";
export { DEFAULT_SPEC, PARAM_META, SECTIONS, coerceSpec, inRange } from "./spec";
export type { Spec, Meta, Section, EffectId, BackdropMode, LightMode } from "./spec";
export { SHAPES, CUSTOM, buildShape, shapeById, shapeDials, shapeDialDefaults } from "./shapes/catalogue";
export type { ShapeEntry, Family } from "./shapes/catalogue";
export { MATERIALS, materialById, materialPatch, applyMaterial } from "./materials";
export type { MaterialPreset, MaterialCategory } from "./materials";
export { ENVIRONMENTS, environmentById, FALLBACK_ENVIRONMENT } from "./environments";
export type { Environment } from "./environments";
export { EFFECTS, effectById, effectDialDefaults } from "./effects/index";
export type { Effect, EffectDial } from "./effects/index";
