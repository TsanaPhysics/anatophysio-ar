// X-ray / solid anatomy shader (GLSL)
export const VERT = `
uniform mat4 uToHead; uniform float uOrtho;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  vL = (uToHead * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = uOrtho > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
export const FRAG = `
uniform vec3 uColor; uniform vec3 uSolidColor;
uniform float uOpacity, uGain, uMode, uClipOn, uFade, uFeather, uCutSoft, uSpec, uFibers, uAlphaMul, uCutaway; uniform vec4 uClip;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  float soft = 1.0;
  if (uClipOn > 0.5) {
    float dcut = dot(uClip.xyz, vL) - uClip.w;
    if (dcut < 0.0) discard;
    if (uCutSoft > 0.001) soft *= smoothstep(0.0, uCutSoft, dcut);
  }
  if (uCutaway > 0.5) {
    // Clean anatomical anterior window into the 4 cardiac chambers
    float wx = (vL.x - 0.55) / 1.85;
    float wy = (vL.y + 20.1) / 2.35;
    if (vL.z > 0.35 && (wx * wx + wy * wy) < 1.0) discard;
  }
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  float ndv = abs(dot(n, v));
  if (uFeather > 0.001) soft *= smoothstep(0.0, uFeather, ndv);
  float fade = uFade > 0.5 ? smoothstep(-12.4, -9.2, vL.y) : 1.0;
  if (uMode > 1.5) {
    gl_FragColor = vec4(uColor, uOpacity * fade * soft);
  } else if (uMode > 0.5) {
    vec3 fn = gl_FrontFacing ? n : -n;
    vec3 lDir1 = normalize(vec3(0.42, 0.58, 0.70));
    vec3 lDir2 = normalize(vec3(-0.55, -0.20, 0.45));
    float d1 = max(dot(fn, lDir1), 0.0);
    float d2 = max(dot(fn, lDir2), 0.0) * 0.35;
    // Wrap subsurface scattering for fleshy organic tissue
    float sss = clamp((dot(fn, lDir1) + 0.5) / 1.5, 0.0, 1.0);
    // Wet Blinn-Phong specular sheen
    vec3 h = normalize(lDir1 + v);
    float spec = pow(max(dot(fn, h), 0.0), 48.0) * (0.28 + uSpec);
    float rim = pow(1.0 - ndv, 2.6);
    // Procedural myocardial fiber & micro-vascular variation
    float tex = 1.0;
    vec3 tissueCol = uSolidColor;
    if (uFibers > 0.01) {
      float w1 = sin(vL.x * 4.5 + vL.y * 6.2 + sin(vL.z * 4.8));
      float w2 = cos(vL.y * 9.0 - vL.z * 5.4);
      tex = 1.0 + uFibers * (0.10 * w1 + 0.06 * w2);
      // Interior wall slightly darker crimson when back-facing inside cutaway
      if (!gl_FrontFacing) tissueCol *= 0.62;
    }
    vec3 base = tissueCol * tex * (0.26 + 0.62 * d1 + d2 + 0.22 * sss) * uGain;
    vec3 col = base + vec3(1.0, 0.94, 0.95) * spec + tissueCol * 0.32 * rim;
    float aMul = uAlphaMul > 0.01 ? uAlphaMul : 1.0;
    gl_FragColor = vec4(col, uOpacity * soft * aMul);
  } else {
    float rim = pow(1.0 - ndv, 2.1);
    float a = clamp((0.035 + 0.95 * rim) * uGain * uOpacity * fade, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a * soft);
  }
}`;
