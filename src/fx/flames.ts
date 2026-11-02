/**
 * Full-screen flame burst drawn by a WebGL fragment shader: a ring of fire bursting from the
 * centre plus flames licking up from the bottom. No video files; rendered at half resolution.
 * Returns null when WebGL is unavailable (the takeover then shows its static glow only).
 */
const VERTEX = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `
precision mediump float;
uniform vec2 res;
uniform float time;
uniform float life;   // 0 -> 1 over the burst
uniform vec3 hot;     // core colour
uniform vec3 deep;    // outer colour

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;
  float rad = length(p);
  float ang = atan(p.y, p.x);

  // (smoothstep with edge0 > edge1 is undefined in GLSL ES: always write 1 - smoothstep(lo, hi, x))
  // burst: a turbulent ring of fire that expands from behind the logo and leaves the screen
  // (p is in screen heights: the edge of a phone screen is about 0.5 away from the centre)
  float grow = 0.05 + 0.9 * sqrt(life);
  float n = fbm(vec2(ang * 2.5 + time * 0.3, rad * 3.0 - time * 4.0));
  float ring = 1.0 - smoothstep(0.0, 0.16, abs(rad - grow + (n - 0.5) * 0.25));
  float core = (1.0 - smoothstep(0.0, 0.35, rad)) * 0.45;

  // flames licking up from the bottom: domain-warped noise stretched upward gives tongues,
  // and the strength falls off with height, so the fire has a hot base and ragged tips
  vec2 q = vec2(uv.x * 7.0, uv.y * 3.5 - time * 4.5);
  float warp = fbm(q + vec2(0.0, time * 0.8));
  float f = fbm(q + warp * 1.6);
  float flames = clamp(f * 1.9 - uv.y * 2.4 - 0.15, 0.0, 1.0);

  float fade = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.7, 1.0, life));
  float k = clamp(ring * (0.35 + n * 0.9) + core + flames, 0.0, 1.0) * fade;
  // heat ramp: deep colour at the edges, core colour, then a white-hot centre
  vec3 col = deep * smoothstep(0.0, 0.45, k) + hot * smoothstep(0.25, 0.85, k) + vec3(1.0, 0.95, 0.8) * pow(k, 6.0) * 0.3;
  float a = smoothstep(0.02, 0.6, k);
  gl_FragColor = vec4(col * a, a);
}`;

export type FlameTone = 'gold' | 'red' | 'rainbow' | 'gray';

const TONES: Record<FlameTone, [number[], number[]]> = {
  gold: [[1.0, 0.75, 0.2], [0.75, 0.12, 0.0]],
  red: [[1.0, 0.45, 0.1], [0.7, 0.0, 0.05]],
  rainbow: [[1.0, 0.6, 1.0], [0.25, 0.1, 0.9]],
  gray: [[0.6, 0.75, 1.0], [0.05, 0.1, 0.35]],
};

export function playFlames(canvas: HTMLCanvasElement, tone: FlameTone, durationMs: number): (() => void) | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;

  const scale = 0.75;
  canvas.width = Math.max(1, Math.floor(canvas.clientWidth * scale));
  canvas.height = Math.max(1, Math.floor(canvas.clientHeight * scale));

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const [hot, deep] = TONES[tone];
  gl.uniform2f(u('res'), canvas.width, canvas.height);
  gl.uniform3fv(u('hot'), hot);
  gl.uniform3fv(u('deep'), deep);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const start = performance.now();
  let frame = 0;
  const draw = (now: number) => {
    const t = (now - start) / 1000;
    const life = Math.min(1, (now - start) / durationMs);
    gl.uniform1f(u('time'), t);
    gl.uniform1f(u('life'), life);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = life < 1 ? requestAnimationFrame(draw) : 0;
  };
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
