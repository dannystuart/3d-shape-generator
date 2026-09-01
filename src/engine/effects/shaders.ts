/** Shared between every fullscreen pass: the quad's vertex shader and the uniform header. */
export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const HEADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uA;
uniform float uB;
uniform float uC;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Pixel coordinates in on-screen (CSS) pixels, not device pixels — so a 2×
// export and a 2× display both look exactly like the 1× preview.
#define px (vUv * uResolution)`;
