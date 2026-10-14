/**
 * 首屏「算仪」实时场景。几何与配色读 design/instrument.json（与 Blender 渲染同源）。
 * 只在支持 WebGL 且未开启「减少动态」时由 Hero 动态加载；任何失败都退回 Blender 静帧。
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PMREMGenerator,
  Points,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import spec from '../../../design/instrument.json';
import { flowFragment, flowVertex } from './shaders';

export interface HeroOptions {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  tools: string[];
  onFocus?: (info: { index: number; x: number; y: number; visible: boolean }) => void;
  onCount?: (tokens: number) => void;
  onReady?: () => void;
}

const PERIOD = 46; // 一个 Token 从外缘走到墨核的平均秒数
const TOKENS_PER_PARTICLE = 37; // 演示计数器的换算系数（演示值）
const UP = new Vector3(0, 1, 0);

type Ring = (typeof spec.rings)[number];

function tier() {
  const w = Math.min(window.innerWidth, window.innerHeight * 2);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (w < 700 || cores <= 4 || mem <= 2) return { particles: 38000, dpr: 1.5 };
  if (cores <= 8 || mem <= 4) return { particles: 70000, dpr: 1.75 };
  return { particles: 110000, dpr: 2 };
}

function buildFlow(count: number) {
  const f = spec.flow;
  const seeds = new Float32Array(count * 4);
  const rands = new Float32Array(count * 2);
  // Box–Muller，与 Blender 端的 gauss 分布一致
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = Math.floor(Math.random() * f.sources);
    seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = gauss();
    seeds[i * 4 + 3] = gauss();
    rands[i * 2] = 0.82 + Math.random() * 0.36;
    rands[i * 2 + 1] = 0.45 + Math.random() * 0.55;
  }
  const geo = new BufferGeometry();
  // three 需要 position 属性来确定绘制数量；真实位置在着色器里算
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  geo.setAttribute('aRand', new BufferAttribute(rands, 2));
  const mat = new ShaderMaterial({
    vertexShader: flowVertex,
    fragmentShader: flowFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPeriod: { value: PERIOD },
      uOuter: { value: f.outerRadius },
      uCore: { value: f.coreRadius },
      uCount: { value: f.countRadius },
      uTwist: { value: f.twist },
      uThick: { value: f.thickness },
      uSources: { value: f.sources },
      uMouse: { value: new Vector3(99, 0, 99) },
      uMouseAmt: { value: 0 },
      uFocus: { value: -1 },
      uFocusAmt: { value: 0 },
      uIntro: { value: 0 },
      uSize: { value: 0.05 * window.innerHeight },
      uPixelRatio: { value: 1 },
      uBone: { value: new Color(spec.palette.bone) },
      uCinnabar: { value: new Color(spec.palette.cinnabar) },
    },
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat, geo };
}

function beadGeometry() {
  const b = spec.bead;
  const h = b.height;
  const profile = [
    new Vector2(b.hole, -h / 2),
    new Vector2(b.radius * 0.42, -h / 2),
    new Vector2(b.radius, -h * 0.06),
    new Vector2(b.radius, h * 0.06),
    new Vector2(b.radius * 0.42, h / 2),
    new Vector2(b.hole, h / 2),
  ];
  const geo = new LatheGeometry(profile, 40);
  geo.computeVertexNormals();
  return geo;
}

/** 算盘：一部分珠子已拨到「已计」一侧，每隔一段时间再拨一颗过去；拨满后整串缓缓退回。 */
class Abacus {
  mesh: InstancedMesh;
  private ring: Ring;
  private step: number;
  private gap: number;
  private start = 0.35;
  private period: number;
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3(1, 1, 1);
  private tangent = new Vector3();

  constructor(ring: Ring, geo: BufferGeometry, mat: MeshPhysicalMaterial, period: number) {
    this.ring = ring;
    this.step = (spec.bead.height * 1.04) / ring.radius;
    this.gap = Math.min(0.62, 1.1 / ring.radius);
    this.period = period;
    this.mesh = new InstancedMesh(geo, mat, ring.beads);
    this.update(0);
  }

  update(time: number) {
    const n = this.ring.beads;
    const phase = time / this.period;
    const c = Math.floor(phase) % (n + 1);
    const raw = phase - Math.floor(phase);
    const f = MathUtils.smootherstep(Math.min(1, raw / 0.32), 0, 1);
    for (let i = 0; i < n; i++) {
      const counted = this.start + i * this.step;
      const pending = counted + this.gap;
      let a: number;
      if (c === 0) a = MathUtils.lerp(counted, pending, f); // 拨满后整串退回
      else if (i < c - 1) a = counted;
      else if (i === c - 1) a = MathUtils.lerp(pending, counted, f);
      else a = pending;
      const r = this.ring.radius;
      this.p.set(r * Math.cos(a), 0, -r * Math.sin(a));
      this.tangent.set(-Math.sin(a), 0, -Math.cos(a));
      this.q.setFromUnitVectors(UP, this.tangent);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function buildInstrument() {
  const root = new Group();
  const pal = spec.palette;
  const brass = new MeshStandardMaterial({ color: pal.brass, metalness: 1, roughness: 0.38, envMapIntensity: 0.8 });
  const beadMat = new MeshPhysicalMaterial({
    color: pal.cinnabar,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const beadGeo = beadGeometry();
  const tickMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 });
  const abaci: Abacus[] = [];
  const spins: { group: Group; spin: number }[] = [];

  spec.rings.forEach((ring, idx) => {
    const tilt = new Group();
    tilt.rotation.copy(new Euler(...(ring.tilt.map((d) => MathUtils.degToRad(d)) as [number, number, number]), 'XYZ'));
    const spinner = new Group();
    tilt.add(spinner);

    const torus = new Mesh(new TorusGeometry(ring.radius, ring.tube, 8, 320), brass);
    torus.rotation.x = Math.PI / 2;
    spinner.add(torus);

    const pos: number[] = [];
    const col: number[] = [];
    const bone = new Color(pal.bone);
    const cin = new Color(pal.cinnabar);
    for (let i = 0; i < ring.ticks; i++) {
      const a = (2 * Math.PI * i) / ring.ticks;
      const len = i === 0 ? 0.13 : 0.06;
      const r0 = ring.radius + ring.tube + 0.014;
      const r1 = r0 + len;
      pos.push(r0 * Math.cos(a), 0, -r0 * Math.sin(a), r1 * Math.cos(a), 0, -r1 * Math.sin(a));
      const c = i === 0 ? cin : bone;
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const tg = new BufferGeometry();
    tg.setAttribute('position', new Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new Float32BufferAttribute(col, 3));
    spinner.add(new LineSegments(tg, tickMat));

    const abacus = new Abacus(ring, beadGeo, beadMat, 2.6 + idx * 1.7);
    spinner.add(abacus.mesh);
    abaci.push(abacus);
    spins.push({ group: spinner, spin: ring.spin });
    root.add(tilt);
  });

  const core = new Mesh(
    new SphereGeometry(spec.core.radius, 64, 32),
    new MeshPhysicalMaterial({ color: '#020203', roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.1, metalness: 0, envMapIntensity: 0.28 }),
  );
  root.add(core);
  const seam = new Mesh(
    new TorusGeometry(spec.core.radius * 1.006, 0.004, 6, 200),
    new MeshBasicMaterial({ color: pal.cinnabar }),
  );
  seam.rotation.x = Math.PI / 2;
  root.add(seam);

  return { root, abaci, spins };
}

/** 镜头构图：宽屏把算仪放在右侧给文字让位（与 Blender 横幅同一机位），竖屏居中俯视。 */
function framing(aspect: number) {
  const wide = aspect >= 1.05;
  if (wide) {
    const hfov = 40;
    const vfov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(hfov / 2)) / aspect));
    // 越接近方形，越往右推、越往后退，给左侧文字留出空间
    const squeeze = MathUtils.clamp((1.9 - aspect) / 0.6, 0, 1);
    return { fov: vfov, distance: 10.6 + squeeze * 1.6, elevation: 27, azimuth: -18, target: new Vector3(-1.5 - squeeze * 0.9, -0.15, 0), shiftY: 0 };
  }
  // 竖屏：镜头对准算仪中心，再用 viewOffset 把画面中心上移到约 32% 高度，下半屏留给文字
  const narrow = MathUtils.clamp((1.05 - aspect) / 0.6, 0, 1);
  return { fov: 46, distance: 12 + narrow * 2.5, elevation: 46, azimuth: -10, target: new Vector3(0, 0, 0), shiftY: 0.22 };
}

export function startHero(opts: HeroOptions) {
  const { canvas, host } = opts;
  const t = tier();
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(spec.palette.ink, 1);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new DirectionalLight('#fff1dc', 1.6);
  key.position.set(-4.5, 5.5, 3.5);
  scene.add(key);

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const flow = buildFlow(t.particles);
  scene.add(flow.points);
  const inst = buildInstrument();
  scene.add(inst.root);

  let frame = framing(1);
  let dpr = Math.min(window.devicePixelRatio || 1, t.dpr);
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frame = framing(camera.aspect);
    camera.fov = frame.fov;
    if (frame.shiftY) camera.setViewOffset(w, h, 0, h * frame.shiftY, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    flow.mat.uniforms.uPixelRatio.value = dpr;
    flow.mat.uniforms.uSize.value = Math.max(20, Math.min(46, h * 0.042));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // 指针 → y=0 平面上的世界坐标
  const ray = new Raycaster();
  const plane = new Plane(UP, 0);
  const ndc = new Vector2();
  const hit = new Vector3();
  let pointerActive = 0;
  let lastMove = -1e9;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      flow.mat.uniforms.uMouse.value.copy(hit);
      lastMove = performance.now();
    }
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // 滚动：镜头从斜视转向俯视并靠近，首屏滚出后停止渲染
  let scrollP = 0;
  const onScroll = () => {
    scrollP = MathUtils.clamp(window.scrollY / Math.max(1, host.clientHeight), 0, 1.2);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 聚焦的来源：依次点亮一道流，并把它的名字标在流上
  let focusIndex = -1;
  let focusStart = 0;
  const FOCUS_HOLD = 2.8;
  const focusPoint = new Vector3();
  const nextFocus = (from: number) => {
    for (let step = 1; step <= spec.flow.sources; step++) {
      const k = (from + step * 7) % spec.flow.sources; // 跳着走，避免相邻的流挤在一起
      if (projectFocus(k).visible) return k;
    }
    return (from + 1) % spec.flow.sources;
  };
  const projectFocus = (k: number) => {
    const f = spec.flow;
    const tt = 0.34;
    const r = f.coreRadius + (f.outerRadius - f.coreRadius) * (1 - tt);
    const th = (2 * Math.PI * k) / f.sources + f.twist * Math.PI * tt ** 4;
    focusPoint.set(r * Math.cos(th), 0, -r * Math.sin(th)).project(camera);
    const x = (focusPoint.x * 0.5 + 0.5) * host.clientWidth;
    const y = (-focusPoint.y * 0.5 + 0.5) * host.clientHeight;
    const wide = camera.aspect >= 1.05;
    const minX = wide ? host.clientWidth * 0.5 : 24;
    const maxY = wide ? host.clientHeight - 150 : host.clientHeight * 0.4;
    const visible = x > minX && x < host.clientWidth - 200 && y > 110 && y < maxY;
    return { x, y, visible };
  };

  let running = true;
  let visible = true;
  let start = performance.now();
  let prev = start;
  let counted = 0;
  let ready = false;
  const samples: number[] = [];
  let degraded = false;

  const onVisibility = () => {
    visible = document.visibilityState === 'visible';
    if (visible) prev = performance.now();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const camPos = new Vector3();
  const tick = (now: number) => {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible || scrollP >= 1.05) {
      prev = now;
      return;
    }
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const time = (now - start) / 1000;

    // 自适应：前 90 帧平均超过 26ms 就减半粒子、降分辨率
    if (!degraded && samples.length < 90) {
      samples.push(dt);
      if (samples.length === 90) {
        const avg = samples.slice(20).reduce((a, b) => a + b, 0) / 70;
        if (avg > 0.026) {
          degraded = true;
          flow.geo.setDrawRange(0, Math.floor(t.particles / 2));
          dpr = 1;
          resize();
        }
      }
    }

    const u = flow.mat.uniforms;
    u.uTime.value = time;
    u.uIntro.value = MathUtils.smootherstep(Math.min(1, time / 2.6), 0, 1);
    pointerActive = MathUtils.damp(pointerActive, now - lastMove < 1600 ? 1 : 0, 3, dt);
    u.uMouseAmt.value = pointerActive;

    if (focusIndex < 0 || time - focusStart > FOCUS_HOLD) {
      focusIndex = nextFocus(focusIndex < 0 ? 0 : focusIndex);
      focusStart = time;
    }
    const fAge = time - focusStart;
    const fAmt = Math.min(1, fAge / 0.5) * Math.min(1, (FOCUS_HOLD - fAge) / 0.5);
    u.uFocus.value = focusIndex;
    u.uFocusAmt.value = Math.max(0, fAmt) * u.uIntro.value;

    const p = MathUtils.smootherstep(Math.min(scrollP, 1), 0, 1);
    const el = MathUtils.degToRad(MathUtils.lerp(frame.elevation, 64, p));
    const az = MathUtils.degToRad(frame.azimuth + time * 0.35);
    const dist = frame.distance * MathUtils.lerp(1.12, 1, u.uIntro.value) * MathUtils.lerp(1, 0.82, p);
    camPos.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
    camera.position.copy(camPos);
    camera.lookAt(frame.target);

    for (const s of inst.spins) s.group.rotation.y += s.spin * dt;
    for (const a of inst.abaci) a.update(time);

    renderer.render(scene, camera);

    const rate = ((degraded ? t.particles / 2 : t.particles) / PERIOD) * TOKENS_PER_PARTICLE;
    counted += rate * dt * u.uIntro.value;
    opts.onCount?.(counted);
    if (opts.onFocus) {
      const pr = projectFocus(focusIndex);
      opts.onFocus({ index: focusIndex, x: pr.x, y: pr.y, visible: pr.visible && fAmt > 0.15 && p < 0.2 });
    }
    if (!ready) {
      ready = true;
      opts.onReady?.();
    }
  };
  requestAnimationFrame((n) => {
    start = n;
    prev = n;
    tick(n);
  });

  return () => {
    running = false;
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.dispose();
  };
}
