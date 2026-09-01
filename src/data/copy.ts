/**
 * Every search-facing string in the app, in one place.
 *
 * The rule this file exists for: **no search-facing copy inline in a component,
 * ever.** Page title, meta description, headings and the social card all read
 * from here, so they cannot drift apart — and the port onto vanta.supply is a
 * swap of this file rather than a hunt through the markup. Button labels and
 * slider names do not belong here; they are interface, not copy.
 */
export const COPY = {
  /** 52 / 60 */
  title: "3D Shape Generator — Free 3D Objects, Materials & Effects",
  /** 151 / 160 */
  description:
    "Pick a shape, add a material, lighting and effects like dither or halftone, then download a PNG or copy the code. Free 3D shape generator, no signup.",
  h1: "3D shape generator",
  socialCardAlt: "A chrome star with a halftone effect, made in the 3D shape generator",
  toolUrl: "https://vanta.supply/tools/3d-shape-generator",
} as const;
