/**
 * The colour-grade pass: exposure, brightness, contrast, saturation, hue,
 * temperature and tint, in that order, on display-referred colour. Alpha
 * passes straight through so a transparent backdrop survives.
 */
export const GRADE_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uExposure;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uHue;
uniform float uTemperature;
uniform float uTint;
varying vec2 vUv;
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float s = sin(a), co = cos(a);
  return c * co + cross(k, c) * s + k * dot(k, c) * (1.0 - co);
}
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  vec3 c = texel.rgb;
  c *= pow(2.0, uExposure);
  c += uBrightness * 0.5;
  c = (c - 0.5) * (1.0 + uContrast) + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.0 + uSaturation);
  c = hueShift(c, uHue);
  // Warm pushes red up and blue down; magenta tint pulls green down.
  c += vec3(uTemperature * 0.12, -uTint * 0.1, -uTemperature * 0.12);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
}`;
