export type ThumbKind = "shapes" | "materials" | "environments" | "effects";

/** Pre-rendered by scripts/shoot-thumbs.mjs from the engine itself, so a tile looks exactly like what it picks. */
export const thumbUrl = (kind: ThumbKind, id: string) => `/img/thumbs/${kind}/${id}.webp`;
