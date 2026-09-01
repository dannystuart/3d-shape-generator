/**
 * mount(container, { spec }) → one renderer, one scene, one mesh, and a
 * handle whose setSpec() rebuilds only what the new spec changed.
 *
 * Nothing here imports React. The editor, the thumbnail shooter and the
 * snippet people copy out all call this same function, so the preview cannot
 * drift from the export.
 */
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FloatType,
  HalfFloatType,
  HemisphereLight,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  Texture,
  VSMShadowMap,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GRADE_FRAGMENT } from "./effects/grade";
import { SLOT_KEYS, effectIn, effectUniforms } from "./effects/index";
import type { EffectSlot } from "./effects/index";
import { FULLSCREEN_VERTEX } from "./effects/shaders";
import { SURFACE_SIZE, surfaceById, surfaceMaps } from "./surfaces";
import { FALLBACK_ENVIRONMENT, environmentById, gradientPixels } from "./environments";
import { FRAME, cameraAngles, cameraPosition, keyLightPosition } from "./lighting";
import { applyMaterial } from "./materials";
import { buildShape } from "./shapes/catalogue";
import type { Spec } from "./spec";
import { backdropLinear, gradientBackdrop } from "./tonemap";

export interface CameraState {
  azimuth: number;
  elevation: number;
  zoom: number;
}

export interface Handle {
  setSpec(next: Spec): void;
  /** Ask for one more frame; safe to call from anywhere. */
  invalidate(): void;
  resize(): void;
  /** Renders once at `scale × canvas size` and returns a PNG. Transparent follows spec.backdrop. The scale actually used is returned, as it may step down on a small GPU. */
  /** `transparent` drops the backdrop for this one picture, whatever the spec says. */
  snapshot(options: { scale: 1 | 2 | 4; transparent?: boolean }): Promise<{ blob: Blob; scale: number }>;
  /** The current mesh and material, for the GLB export. */
  mesh(): Mesh;
  /** What the camera is looking from right now, for a spec that follows a drag. */
  camera(): CameraState;
  /** Fires after a drag moves the camera, with the new angles. */
  onCamera(cb: (c: CameraState) => void): () => void;
  /** Fires when an environment finishes loading (or fails and falls back). */
  onEnvironment(cb: (id: string, ok: boolean) => void): () => void;
  /** Fires when an effect's shader will not compile on this device; the effect has been dropped to none. */
  onEffectFailed(cb: (id: string) => void): () => void;
  dispose(): void;
}

export interface MountOptions {
  spec: Spec;
  /** Base URL for /env files; the snippet passes an absolute one. */
  assetBase?: string;
  /** Disable drag/zoom, for thumbnails and the snippet's `interactive: false`. */
  interactive?: boolean;
  /** Allow wheel zoom. Defaults to true; a host can set false to keep drag/rotate but let the page scroll past the canvas. */
  zoom?: boolean;
}

const KEY_DISTANCE = 6;
const ZOOM_MIN = 0.4, ZOOM_MAX = 2.5;

const SHAPE_KEYS = ["shape", "svg", "thickness", "rounding", "twist", "shapeA", "shapeB", "shapeC"] as const;
const MATERIAL_KEYS = ["color", "roughness", "metalness", "clearcoat", "clearcoatRoughness", "transmission", "glassThickness", "ior", "glowColor", "glow", "iridescence", "sheen", "sheenColor", "flat", "surface", "surfaceScale", "surfaceDepth"] as const;
const LIGHT_KEYS = ["envIntensity", "envBlur", "envRotation", "lightMode", "keyX", "keyY", "keyIntensity", "keyColor", "floorShadow", "shadowOpacity", "shadowSoftness"] as const;
const ADJUST_KEYS = ["exposure", "brightness", "contrast", "saturation", "hue", "temperature", "tint"] as const;
const EFFECT_KEYS = ["effect", "effectA", "effectB", "effectC", "effectColor1", "effectColor2", "tone", "toneA", "toneB", "toneColor1", "toneColor2", "finish", "finishA", "finishB", "finishC"] as const;
const BACKDROP_KEYS = ["backdrop", "backdropColor", "backdropColor2", "backdropAngle"] as const;
const VIEW_KEYS = ["azimuth", "elevation", "zoom"] as const;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A hex colour as raw sRGB 0..1 — what the post-output shaders want, since they work on display colours. */
function srgb(hex: string): Vector3 {
  return new Vector3(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
}

function changed(prev: Spec | null, next: Spec, keys: readonly (keyof Spec)[]): boolean {
  if (!prev) return true;
  return keys.some((k) => prev[k] !== next[k]);
}

export function mount(container: HTMLElement, options: MountOptions): Handle {
  const { assetBase = "", interactive = true, zoom = true } = options;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    throw new Error("no-webgl");
  }
  const canvas = renderer.domElement;
  if (renderer.getContext().isContextLost()) {
    renderer.dispose();
    throw new Error("no-webgl");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // Neutral keeps the material's own colour rather than bending it the way a
  // film curve does — what a material picker needs. The backdrop is fed its
  // pre-image so it comes out exact (tonemap.ts).
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  // Glass re-renders the scene behind it every frame; at half resolution that is invisible on one shape and a quarter of the cost.
  renderer.transmissionResolutionScale = 0.5;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  // --- scene -----------------------------------------------------------------
  const scene = new Scene();
  const camera = new PerspectiveCamera(options.spec.fov, 1, 0.1, 100);
  const material = new MeshPhysicalMaterial();

  // --- surfaces ----------------------------------------------------------------
  // Each surface is drawn once, the first time it is asked for, and kept.
  const surfaceCache = new Map<string, { normal: DataTexture; roughness: DataTexture; color: DataTexture | null }>();
  function surfaceTextures(id: string) {
    const cached = surfaceCache.get(id);
    if (cached) return cached;
    const maps = surfaceMaps(surfaceById(id));
    const make = (data: Uint8ClampedArray) => {
      const tex = new DataTexture(new Uint8Array(data.buffer), SURFACE_SIZE, SURFACE_SIZE, RGBAFormat);
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.magFilter = LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
      return tex;
    };
    const color = maps.color ? make(maps.color) : null;
    // The tint multiplies the material's colour, so it is read as colour, not data.
    if (color) color.colorSpace = SRGBColorSpace;
    const made = { normal: make(maps.normal), roughness: make(maps.roughness), color };
    surfaceCache.set(id, made);
    return made;
  }
  function applySurface(spec: Spec) {
    const had = `${material.normalMap !== null}/${material.map !== null}`;
    if (spec.surface === "none") {
      material.normalMap = null;
      material.roughnessMap = null;
      material.map = null;
    } else {
      const { normal, roughness, color } = surfaceTextures(spec.surface);
      const [ru, rv] = (mesh.geometry.userData.uvRepeat as [number, number] | undefined) ?? [1, 1];
      normal.repeat.set(spec.surfaceScale * ru, spec.surfaceScale * rv);
      roughness.repeat.set(spec.surfaceScale * ru, spec.surfaceScale * rv);
      color?.repeat.set(spec.surfaceScale * ru, spec.surfaceScale * rv);
      material.map = color;
      material.normalMap = normal;
      material.roughnessMap = roughness;
      material.normalScale.set(spec.surfaceDepth * 1.6, spec.surfaceDepth * 1.6);
      // Glass leans on the same map for its clearcoat, so cracks catch the light on the coat too.
      material.clearcoatNormalMap = normal;
      material.clearcoatNormalScale.set(spec.surfaceDepth * 1.2, spec.surfaceDepth * 1.2);
    }
    if (spec.surface === "none") material.clearcoatNormalMap = null;
    if (had !== `${material.normalMap !== null}/${material.map !== null}`) material.needsUpdate = true;
  }
  const envBlur = { value: 0 };
  // Environment blur: Three has no knob for it, so the reflection lookup is
  // given a floor on its roughness — the material's own roughness is untouched.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEnvBlur = envBlur;
    shader.fragmentShader = ("uniform float uEnvBlur;\n" + shader.fragmentShader)
      .replace("getIBLRadiance( geometryViewDir, geometryNormal, material.roughness )", "getIBLRadiance( geometryViewDir, geometryNormal, max( material.roughness, uEnvBlur ) )")
      .replace("getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness )", "getIBLRadiance( geometryViewDir, geometryClearcoatNormal, max( material.clearcoatRoughness, uEnvBlur ) )");
  };
  const mesh = new Mesh(buildShape(options.spec), material);
  mesh.castShadow = true;
  scene.add(mesh);

  const floorMaterial = new ShadowMaterial({ opacity: 0.35 });
  const floor = new Mesh(new PlaneGeometry(20, 20), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.02;
  floor.receiveShadow = true;
  scene.add(floor);

  const key = new DirectionalLight(0xffffff, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0005;
  scene.add(key);
  scene.add(key.target);

  const fill = new HemisphereLight(0xffffff, 0x303030, 0);
  scene.add(fill);

  // --- composer ----------------------------------------------------------------
  const size = new Vector2(1, 1);
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const outputPass = new OutputPass();
  const gradePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uExposure: { value: 0 },
      uBrightness: { value: 0 },
      uContrast: { value: 0 },
      uSaturation: { value: 0 },
      uHue: { value: 0 },
      uTemperature: { value: 0 },
      uTint: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: GRADE_FRAGMENT,
  });
  composer.addPass(renderPass);
  composer.addPass(outputPass);
  composer.addPass(gradePass);
  // Two slots, texture then colour, each one fullscreen pass; the composer
  // runs them in the order they were added, and they are always added texture
  // first so the colour remap works on the finished texture.
  type Slot = { slot: EffectSlot; pass: ShaderPass | null; id: string };
  const slots: Slot[] = [
    { slot: "texture", pass: null, id: "none" },
    { slot: "tone", pass: null, id: "none" },
    { slot: "finish", pass: null, id: "none" },
  ];

  // A shader that fails to compile on this GPU is reported by the renderer,
  // not thrown. Still log it — this hook replaces Three's own logging — and
  // drop the effect after the frame, not during it.
  const effectFailed = new Set<(id: string) => void>();
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    console.error("THREE.WebGLProgram: shader error", gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader));
    for (const s of slots) {
      if (!s.pass || s.id === "none") continue;
      const failed = s.id;
      const pass = s.pass;
      s.pass = null;
      s.id = "none";
      queueMicrotask(() => {
        composer.removePass(pass);
        pass.dispose();
        for (const cb of effectFailed) cb(failed);
        invalidate();
      });
    }
  };

  // --- controls ----------------------------------------------------------------
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enabled = interactive;
  controls.enableZoom = interactive && zoom;
  controls.enableRotate = interactive;
  const cameraListeners = new Set<(c: CameraState) => void>();
  controls.addEventListener("change", () => invalidate());
  controls.addEventListener("end", () => {
    const c = cameraState();
    for (const cb of cameraListeners) cb(c);
  });

  function cameraState(): CameraState {
    return cameraAngles(camera.position, camera.fov);
  }

  function placeCamera(azimuth: number, elevation: number, zoom: number) {
    camera.position.copy(cameraPosition(azimuth, elevation, camera.fov, zoom));
    controls.update();
  }

  function zoomLimits(fov: number) {
    const half = (fov * Math.PI) / 360;
    controls.minDistance = FRAME / Math.sin(half) / ZOOM_MAX;
    controls.maxDistance = FRAME / Math.sin(half) / ZOOM_MIN;
  }

  // --- frames ------------------------------------------------------------------
  let needsFrame = true;
  let raf = 0;
  let disposed = false;
  function invalidate() {
    needsFrame = true;
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  }
  function frame() {
    if (disposed) return;
    // `raf` stays set while drawing, so a 'change' fired by controls.update()
    // marks needsFrame instead of queueing a second frame alongside this one.
    const moved = controls.update();
    draw();
    raf = 0;
    if (moved || controls.autoRotate || needsFrame) raf = requestAnimationFrame(frame);
  }
  /** One picture, nothing scheduled. The loop above decides whether there is a next one. */
  function draw() {
    needsFrame = false;
    composer.render();
  }

  function resize() {
    const w = Math.max(1, Math.round(container.clientWidth)), h = Math.max(1, Math.round(container.clientHeight));
    if (w === size.x && h === size.y) return;
    size.set(w, h);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const s of slots) if (s.pass) (s.pass.uniforms.uResolution.value as Vector2).set(w, h);
    // Drawn now, not next frame. Giving the canvas a new size wipes it, and a
    // frame queued for later leaves a blank canvas on screen until it lands —
    // on a drawer sliding open over 380ms that is a black flicker on every
    // frame of the slide. The observer fires after layout and before paint,
    // so a draw here is on screen before anyone can see the wipe. Only a
    // draw: with auto-spin on the loop is already running, and a second loop
    // started from here would draw every frame of the slide twice over.
    draw();
  }
  const observer = new ResizeObserver(() => resize());
  observer.observe(container);

  // --- environments ------------------------------------------------------------
  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envCache = new Map<string, Texture>();
  const envListeners = new Set<(id: string, ok: boolean) => void>();
  let envToken = 0;

  async function environmentTexture(id: string): Promise<Texture> {
    const cached = envCache.get(id);
    if (cached) return cached;
    const env = environmentById(id);
    let tex: Texture;
    if (env.kind === "hdr") {
      const hdr = await new HDRLoader().loadAsync(`${assetBase}/env/${env.file}`);
      tex = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
    } else {
      const { data, width, height } = gradientPixels(env, 256, 128);
      const source = new DataTexture(data, width, height, RGBAFormat, FloatType);
      source.mapping = EquirectangularReflectionMapping;
      source.colorSpace = LinearSRGBColorSpace;
      source.needsUpdate = true;
      tex = pmrem.fromEquirectangular(source).texture;
      source.dispose();
    }
    envCache.set(id, tex);
    return tex;
  }

  function loadEnvironment(id: string) {
    const token = ++envToken;
    environmentTexture(id)
      .then((tex) => ({ tex, ok: true }))
      .catch(() => environmentTexture(FALLBACK_ENVIRONMENT).then((tex) => ({ tex, ok: false })))
      .then(({ tex, ok }) => {
        if (token !== envToken || disposed) return;
        scene.environment = tex;
        renderer.shadowMap.needsUpdate = true;
        invalidate();
        for (const cb of envListeners) cb(id, ok);
      })
      .catch(() => {});
  }

  // --- backdrop ----------------------------------------------------------------
  let backdropTexture: DataTexture | null = null;

  function applyBackdrop(spec: Spec) {
    if (backdropTexture) {
      backdropTexture.dispose();
      backdropTexture = null;
    }
    if (spec.backdrop === "transparent") {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    } else if (spec.backdrop === "solid") {
      const [r, g, b] = backdropLinear(spec.backdropColor);
      scene.background = new Color(r, g, b);
    } else {
      // The two colours are blended the way a CSS gradient blends them, and
      // every step is then fed its own pre-image of the tone curve. A pastel
      // near white needs a pre-image far above 1, so this is a float texture —
      // an 8-bit canvas would clip it and a soft blue would come out neon.
      const { data, width, height } = gradientBackdrop(spec.backdropColor, spec.backdropColor2, spec.backdropAngle);
      backdropTexture = new DataTexture(data, width, height, RGBAFormat, HalfFloatType);
      backdropTexture.colorSpace = LinearSRGBColorSpace;
      backdropTexture.minFilter = backdropTexture.magFilter = LinearFilter;
      backdropTexture.needsUpdate = true;
      scene.background = backdropTexture;
    }
  }

  // --- spec --------------------------------------------------------------------
  let prev: Spec | null = null;

  function applyLights(spec: Spec) {
    key.position.copy(keyLightPosition(spec.keyX, spec.keyY, KEY_DISTANCE));
    key.color.set(spec.keyColor);
    const directional = spec.lightMode === "directional";
    key.intensity = spec.keyIntensity * (directional ? 1.6 : 0.9);
    scene.environmentIntensity = spec.envIntensity * (directional ? 0.25 : 1);
    fill.intensity = directional ? 0.35 : 0;
    scene.environmentRotation.y = rad(spec.envRotation);
    envBlur.value = spec.envBlur * 0.85;
    // With no backdrop and a screen effect on, the shadow is a grey smudge
    // hanging in nothing — the effect redraws it as if it were a thing.
    const shadowOn = spec.floorShadow && !(spec.backdrop === "transparent" && (spec.effect !== "none" || spec.tone !== "none" || spec.finish !== "none"));
    key.castShadow = shadowOn;
    floor.visible = shadowOn;
    floorMaterial.opacity = spec.shadowOpacity;
    key.shadow.radius = 1 + spec.shadowSoftness * 12;
    renderer.shadowMap.needsUpdate = true;
  }

  function applyAdjust(spec: Spec) {
    const u = gradePass.uniforms;
    u.uExposure.value = spec.exposure;
    u.uBrightness.value = spec.brightness;
    u.uContrast.value = spec.contrast;
    u.uSaturation.value = spec.saturation;
    u.uHue.value = rad(spec.hue);
    u.uTemperature.value = spec.temperature;
    u.uTint.value = spec.tint;
  }

  function applyEffect(spec: Spec) {
    const rebuild = slots.some((s) => effectIn(spec, s.slot).id !== s.id);
    if (rebuild) {
      // Torn down and put back together as a pair, so the order is always texture then colour.
      for (const s of slots) {
        if (s.pass) {
          composer.removePass(s.pass);
          s.pass.dispose();
          s.pass = null;
        }
        const effect = effectIn(spec, s.slot);
        s.id = effect.id;
        if (effect.id === "none") continue;
        s.pass = new ShaderPass({
          uniforms: {
            tDiffuse: { value: null },
            uResolution: { value: new Vector2(size.x, size.y) },
            uA: { value: 0 },
            uB: { value: 0 },
            uC: { value: 0 },
            uColor1: { value: new Vector3() },
            uColor2: { value: new Vector3() },
          },
          vertexShader: FULLSCREEN_VERTEX,
          fragmentShader: effect.fragment,
        });
        composer.addPass(s.pass);
      }
    }
    for (const s of slots) {
      if (!s.pass) continue;
      const keys = SLOT_KEYS[s.slot];
      const { uA, uB, uC } = effectUniforms(spec, s.slot);
      s.pass.uniforms.uA.value = uA;
      s.pass.uniforms.uB.value = uB;
      s.pass.uniforms.uC.value = uC;
      (s.pass.uniforms.uColor1.value as Vector3).copy(srgb(spec[keys.color1]));
      (s.pass.uniforms.uColor2.value as Vector3).copy(srgb(spec[keys.color2]));
    }
  }

  function setSpec(next: Spec) {
    let shapeError: unknown = null;
    if (changed(prev, next, SHAPE_KEYS) && prev !== null) {
      try {
        const geometry = buildShape(next);
        mesh.geometry.dispose();
        mesh.geometry = geometry;
        renderer.shadowMap.needsUpdate = true;
        // A new shape may map its tiles differently.
        applySurface(next);
      } catch (error) {
        shapeError = error;
      }
    }
    if (changed(prev, next, MATERIAL_KEYS)) {
      applyMaterial(material, next);
      applySurface(next);
    }
    if (!prev || prev.environment !== next.environment) loadEnvironment(next.environment);
    // The backdrop and the effects have a say in the floor shadow, so lights re-run when they move.
    if (changed(prev, next, [...LIGHT_KEYS, "backdrop", "effect", "tone", "finish"])) applyLights(next);
    if (changed(prev, next, ADJUST_KEYS)) applyAdjust(next);
    if (changed(prev, next, EFFECT_KEYS)) applyEffect(next);
    if (changed(prev, next, BACKDROP_KEYS)) applyBackdrop(next);
    if (!prev || prev.fov !== next.fov) {
      // Keep the framing the same at the new lens: read the angles under the old one, place under the new.
      const current = prev ? cameraState() : { azimuth: next.azimuth, elevation: next.elevation, zoom: next.zoom };
      camera.fov = next.fov;
      camera.updateProjectionMatrix();
      zoomLimits(next.fov);
      placeCamera(current.azimuth, current.elevation, current.zoom);
    }
    // Only when the spec's own view changed — a drag must not be fought by the next unrelated setSpec.
    if (changed(prev, next, VIEW_KEYS)) placeCamera(next.azimuth, next.elevation, next.zoom);
    controls.autoRotate = next.autoSpin > 0;
    // OrbitControls' unit: 2.0 is one orbit every 30 seconds, i.e. 2 rpm.
    controls.autoRotateSpeed = next.autoSpin;
    prev = next;
    invalidate();
    if (shapeError) throw shapeError;
  }

  // --- snapshot ----------------------------------------------------------------
  async function snapshot({ scale, transparent = false }: { scale: 1 | 2 | 4; transparent?: boolean }): Promise<{ blob: Blob; scale: number }> {
    const maxSize = renderer.capabilities.maxTextureSize;
    let s: number = scale;
    while (s > 1 && Math.max(size.x, size.y) * s > maxSize) s /= 2;
    const pixelRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(s);
    composer.setPixelRatio(s);
    renderer.setSize(size.x, size.y, false);
    composer.setSize(size.x, size.y);
    controls.update();
    const swap = transparent && prev && prev.backdrop !== "transparent";
    if (swap) {
      // The lights come along too, so the shadow follows the same no-backdrop rule the preview uses.
      applyBackdrop({ ...prev!, backdrop: "transparent" });
      applyLights({ ...prev!, backdrop: "transparent" });
    }
    composer.render();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("snapshot failed"))), "image/png"));
    if (swap) {
      applyBackdrop(prev!);
      applyLights(prev!);
    }
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
    renderer.setSize(size.x, size.y, false);
    composer.setSize(size.x, size.y);
    invalidate();
    return { blob, scale: s };
  }

  // --- go ----------------------------------------------------------------------
  resize();
  setSpec(options.spec);

  return {
    setSpec,
    invalidate,
    resize,
    snapshot,
    mesh: () => mesh,
    camera: cameraState,
    onCamera: (cb) => {
      cameraListeners.add(cb);
      return () => cameraListeners.delete(cb);
    },
    onEnvironment: (cb) => {
      envListeners.add(cb);
      return () => envListeners.delete(cb);
    },
    onEffectFailed: (cb) => {
      effectFailed.add(cb);
      return () => effectFailed.delete(cb);
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      material.dispose();
      for (const t of surfaceCache.values()) {
        t.normal.dispose();
        t.roughness.dispose();
        t.color?.dispose();
      }
      floor.geometry.dispose();
      floorMaterial.dispose();
      backdropTexture?.dispose();
      for (const tex of envCache.values()) tex.dispose();
      envCache.clear();
      pmrem.dispose();
      composer.dispose();
      for (const s of slots) s.pass?.dispose();
      gradePass.dispose();
      canvas.remove();
      // Deferred: a StrictMode remount reuses nothing here, but a context lost
      // synchronously in cleanup can still be the one the next mount asks for.
      setTimeout(() => {
        renderer.dispose();
        renderer.forceContextLoss();
      }, 0);
    },
  };
}
