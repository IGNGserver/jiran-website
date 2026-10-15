/**
 * Token 流着色器。位置是 (种子, 时间) 的纯函数，没有 GPGPU 状态，WebGL1/2 都能跑。
 * 公式与 design/blender/build_instrument.py 的 flow_state() 一一对应：
 *   t 从 0（外缘来源）走到 1（墨核）；半径线性收缩；角度 = 来源角 + twist·π·t⁴；
 *   越过 countRadius 的那一段是「被计入」——朱砂高亮，之后余烬渐暗。
 */

// 3D simplex noise — Ian McEwan, Ashima Arts / Stefan Gustavson (MIT License)
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 snoise3(vec3 p){
  return vec3(snoise(p),snoise(p+vec3(31.416,-47.853,12.793)),snoise(p+vec3(-19.73,71.11,-5.29)));
}
`;

export const flowVertex = /* glsl */ `
uniform float uTime;
uniform float uPeriod;
uniform float uOuter;
uniform float uCore;
uniform float uCount;
uniform float uTwist;
uniform float uThick;
uniform float uSources;
uniform vec3 uMouse;
uniform float uMouseAmt;
uniform float uFocus;
uniform float uFocusAmt;
uniform float uIntro;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uBone;
uniform vec3 uCinnabar;

attribute vec4 aSeed;   // k, u0, jitter, lane
attribute vec2 aRand;   // speed, brightness

varying vec3 vColor;
varying float vGlow;

${SNOISE}

void main(){
  float k = aSeed.x;
  float t = fract(aSeed.y + uTime * aRand.x / uPeriod);
  float r = uCore + (uOuter - uCore) * (1.0 - t);
  float theta = 6.2831853 * k / uSources + uTwist * 3.1415927 * pow(t, 4.0) + aSeed.w * 0.012;
  float y = aSeed.z * uThick * pow(1.0 - t, 2.0) * 0.6;
  vec3 p = vec3(r * cos(theta), y, -r * sin(theta));

  vec3 n = snoise3(p * 0.5 + vec3(0.0, k * 0.37, uTime * 0.04));
  p += n * 0.09 * (1.0 - t);

  // 指针：像放在流上的一块透镜，把 Token 轻轻推开并照亮
  vec2 dm = p.xz - uMouse.xz;
  float dist = length(dm);
  float push = uMouseAmt * pow(max(0.0, 1.0 - dist / 1.5), 2.0);
  p.xz += (dist > 1e-4 ? dm / dist : vec2(0.0)) * push * 0.55;
  p.y += push * 0.18;

  // 入场：从外缘散开处收拢
  p *= mix(1.35, 1.0, uIntro);

  float d = (uCount - r) / 0.45;
  float band = d > -0.4 ? exp(-pow(d - 0.35, 2.0) * 6.0) : 0.0;
  float inside = r < uCount ? 1.0 : 0.0;
  float edge = clamp((uOuter - r) / 1.2, 0.0, 1.0) * smoothstep(uCore, uCore + 0.3, r);

  float focus = uFocusAmt * (1.0 - step(0.5, abs(k - uFocus))) * (1.0 - inside);
  vColor = mix(uBone, uCinnabar, min(1.0, band + inside * 0.7));
  vGlow = (aRand.y * (1.0 - inside * 0.93) + band * 4.0 + focus * 1.3) * edge * uIntro;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.65 + 0.7 * aRand.y) * (1.0 + band * 0.5 + focus * 0.6) / -mv.z;
}
`;

export const flowFragment = /* glsl */ `
varying vec3 vColor;
varying float vGlow;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  a *= a;
  gl_FragColor = vec4(vColor * vGlow * a * 0.62, 1.0);
}
`;
