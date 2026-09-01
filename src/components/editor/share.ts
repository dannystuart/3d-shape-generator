import { DEFAULT_SPEC, coerceSpec } from "@/engine/spec";
import type { Spec } from "@/engine/spec";

/**
 * A design as a link.
 *
 * Only what differs from the defaults travels, so a fresh sphere is a bare
 * URL and a tuned one is a few dozen characters. It rides in the hash, so the
 * page is one static page whatever is in it and nothing reaches a server.
 */
const KEY = "s";

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(text: string): string {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function toShareHash(spec: Spec): string {
  const diff: Partial<Spec> = {};
  for (const key of Object.keys(DEFAULT_SPEC) as (keyof Spec)[]) {
    if (spec[key] !== DEFAULT_SPEC[key]) (diff as Record<string, unknown>)[key] = spec[key];
  }
  return Object.keys(diff).length ? `#${KEY}=${encode(JSON.stringify(diff))}` : "";
}

export function toShareUrl(spec: Spec, base: string): string {
  return base.split("#")[0] + toShareHash(spec);
}

/** The spec a hash carries, or null when it carries none (or nonsense). */
export function fromShareHash(hash: string): Spec | null {
  const match = hash.match(new RegExp(`[#&]${KEY}=([A-Za-z0-9_-]+)`));
  if (!match) return null;
  try {
    return coerceSpec(JSON.parse(decode(match[1])));
  } catch {
    return null;
  }
}
