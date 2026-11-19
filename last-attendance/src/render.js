'use strict';
// ============================================================
//  렌더링: PBR 재질 도우미, 후처리(블룸·톤매핑·색보정·비네트·안티에일리어싱)
// ============================================================
// sRGB 색을 받아 선형 공간으로 바꾼 PBR 재질
function stdMat(p) {
  const o = Object.assign({ roughness: 0.85, metalness: 0 }, p);
  const m = new THREE.MeshStandardMaterial(o);
  if (p.color !== undefined) m.color.convertSRGBToLinear();
  if (p.emissive !== undefined) m.emissive.convertSRGBToLinear();
  return m;
}
function srgbTex(t) { t.encoding = THREE.sRGBEncoding; return t; }

const GRADE = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, sat: { value: 1.08 }, contrast: { value: 1.05 }, vig: { value: 0.35 }, tint: { value: new THREE.Color(1, 1, 1) }, flash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; uniform float sat; uniform float contrast; uniform float vig; uniform vec3 tint; uniform float flash; varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){ const mat3 iM = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
      const mat3 oM = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602); c = iM * c; c = RRTAndODTFit(c); c = oM * c; return clamp(c, 0.0, 1.0); }
    void main(){
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb * exposure * tint + flash;
      c = aces(c / 0.6);
      c = pow(c, vec3(1.0 / 2.2));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat); c = (c - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5; c *= 1.0 - vig * dot(d, d) * 1.6;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
};
const RENDER = { composer: null, on: false };
function initPost() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const gl2 = renderer.capabilities.isWebGL2;
  const rt = gl2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(size.x, size.y, { type: THREE.HalfFloatType }) : new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  if (rt.samples !== undefined) rt.samples = 4;
  const C = new THREE.EffectComposer(renderer, rt);
  C.addPass(new THREE.RenderPass(scene, camera));
  RENDER.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.2, 0.5, 0.95); C.addPass(RENDER.bloom);
  RENDER.grade = new THREE.ShaderPass(GRADE); C.addPass(RENDER.grade);
  if (!gl2) { RENDER.fxaa = new THREE.ShaderPass(THREE.FXAAShader); C.addPass(RENDER.fxaa); }
  RENDER.composer = C; resizePost();
}
function resizePost() {
  if (!RENDER.composer) return;
  const pr = renderer.getPixelRatio(); RENDER.composer.setPixelRatio(pr); RENDER.composer.setSize(innerWidth, innerHeight);
  if (RENDER.fxaa) RENDER.fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
}
function renderFrame() {
  const usePost = ENV.gfx !== 'low' && RENDER.composer;
  if (usePost) {
    renderer.toneMapping = THREE.NoToneMapping; renderer.outputEncoding = THREE.LinearEncoding;
    RENDER.bloom.enabled = ENV.gfx === 'high';
    RENDER.grade.uniforms.exposure.value = ENV.exposure || 1; RENDER.grade.uniforms.flash.value = (ENV.lightning || 0) * 0.25;
    RENDER.grade.uniforms.sat.value = ENV.sat || 1.08;
    RENDER.composer.render();
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = (ENV.exposure || 1) * 1.4; renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.render(scene, camera);
  }
}
