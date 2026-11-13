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
uniform float uOpacity, uGain, uMode, uClipOn, uFade, uFeather, uCutSoft, uSpec, uFibers, uAlphaMul; uniform vec4 uClip;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  float soft = 1.0;
  if (uClipOn > 0.5) {
    float dcut = dot(uClip.xyz, vL) - uClip.w;
    if (dcut < 0.0) discard;
    if (uCutSoft > 0.001) soft *= smoothstep(0.0, uCutSoft, dcut);
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
    vec3 lDir = normalize(vec3(0.35, 0.55, 0.76));
    float d = max(dot(fn, lDir), 0.0);
    // Wrap subsurface lighting for organic tissue softness
    float sss = clamp((dot(fn, lDir) + 0.45) / 1.45, 0.0, 1.0);
    // Wet Blinn-Phong specular highlight
    vec3 h = normalize(lDir + v);
    float spec = pow(max(dot(fn, h), 0.0), 42.0) * (0.35 + uSpec);
    float rim = pow(1.0 - ndv, 2.4);
    // Procedural organic fiber / vascular micro-texture
    float tex = 1.0;
    if (uFibers > 0.01) {
      float w1 = sin(vL.x * 3.8 + vL.y * 5.2 + sin(vL.z * 4.1));
      float w2 = cos(vL.y * 7.5 - vL.z * 4.7);
      tex = 1.0 + uFibers * (0.09 * w1 + 0.06 * w2);
    }
    vec3 base = uSolidColor * tex * (0.24 + 0.62 * d + 0.24 * sss) * uGain;
    vec3 col = base + vec3(0.95, 0.92, 0.94) * spec + uSolidColor * 0.35 * rim;
    float aMul = uAlphaMul > 0.01 ? uAlphaMul : 1.0;
    gl_FragColor = vec4(col, uOpacity * soft * aMul);
  } else {
    float rim = pow(1.0 - ndv, 2.1);
    float a = clamp((0.035 + 0.95 * rim) * uGain * uOpacity * fade, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a * soft);
  }
}`;
