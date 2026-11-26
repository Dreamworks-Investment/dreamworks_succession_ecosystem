import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Source-informed room types and route order; deliberately not a measured plan. */
export function createOfficeScene({ container, sections = [], onSelect = () => {}, onMove, onError = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    const hint = document.createElement('p');
    hint.className = 'scene-fallback';
    hint.textContent = '3D 暂不可用 · 请继续使用实景照片与路线导览。';
    container.append(hint); onError(error);
    return { selectSection() {}, setMode() {}, setDirection() {}, step() {}, look: () => false, enterRoom: () => false, leaveRoom: () => false, setActive() {}, resize() {}, exportGLB: async () => null, dispose() { hint.remove(); } };
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e5e9e5');
  scene.fog = new THREE.Fog('#e5e9e5', 165, 240);
  const model = new THREE.Group(); model.name = 'Office tour - schematic, not to scale'; scene.add(model);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Office schematic, not to scale. Drag to look. Select a numbered room, or use forward and back in walkthrough mode.');
  canvas.tabIndex = 0;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  container.append(canvas);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 240);
  camera.position.set(32.8, 37.4, 42.9);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.minDistance = 18; controls.maxDistance = 175;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = Math.PI / 2.08;
  controls.target.set(0, -3, 0);
  scene.add(new THREE.HemisphereLight('#eaf3ff', '#887554', 2.3));
  const sun = new THREE.DirectionalLight('#fff4d8', 3.6); sun.position.set(-24, 48, 22);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -43, right: 43, top: 38, bottom: -38, near: 1, far: 115 });
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0001; scene.add(sun);
  const fill = new THREE.DirectionalLight('#d8eaff', 1.2); fill.position.set(28, 23, -32); scene.add(fill);
  const makeMat = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.04, ...extras });
  const m = {
    base: makeMat('#cbd1cc'), stone: makeMat('#efeee3'), carpet: makeMat('#b0b4b0'),
    navy: makeMat('#173d48'), walnut: makeMat('#76533c'), oak: makeMat('#be986a'),
    brass: makeMat('#bc9552', { metalness: 0.65, roughness: 0.35 }), paper: makeMat('#f6f4e9'),
    blue: makeMat('#3e6680'), leather: makeMat('#77523d'), seat: makeMat('#2a3b42'),
    chrome: makeMat('#89918e', { metalness: 0.8, roughness: 0.25 }), rug: makeMat('#d5c9ac'),
    green: makeMat('#6a8573'), pot: makeMat('#c8b293'), screen: makeMat('#123c4a', { emissive: '#244c5a', emissiveIntensity: 0.24 }),
    glass: makeMat('#b3dcd8', { transparent: true, opacity: 0.24, roughness: 0.15, depthWrite: false }),
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 24);
  const sphereGeometry = new THREE.SphereGeometry(1, 14, 10);
  const textures = new Set(); const rooms = new Map(); const pickables = []; const labels = [];
  const stationPoints = []; const arrowMarkers = []; const count = sections.length;
  const previousCamera = camera.position.clone(); const previousTarget = controls.target.clone();
  let mode = 'overview', direction = 1, currentIndex = 0, progress = 0, travel = null;
  let yaw = 0, pitch = 0, pointerDown = null, moved = false, frame, disposed = false, active = true;
  let interior = false, entryTransition = null;
  let autoFit = true;
  controls.addEventListener('start', () => { autoFit = false; });

  function mesh(geometry, material, parent, x = 0, y = 0, z = 0, w = 1, h = 1, d = 1) {
    const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); item.scale.set(w, h, d);
    item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  }
  const box = (parent, material, x, y, z, w, h, d) => mesh(boxGeometry, material, parent, x, y, z, w, h, d);
  const cylinder = (parent, material, x, y, z, r, h) => mesh(cylinderGeometry, material, parent, x, y, z, r, h, r);
  function roundedShape(width, depth, radius = 0.7) {
    const s = new THREE.Shape(), x = -width / 2, z = -depth / 2, r = radius;
    s.moveTo(x + r, z); s.lineTo(x + width - r, z); s.quadraticCurveTo(x + width, z, x + width, z + r);
    s.lineTo(x + width, z + depth - r); s.quadraticCurveTo(x + width, z + depth, x + width - r, z + depth);
    s.lineTo(x + r, z + depth); s.quadraticCurveTo(x, z + depth, x, z + depth - r);
    s.lineTo(x, z + r); s.quadraticCurveTo(x, z, x + r, z); return s;
  }
  function slab(parent, material, width, depth, height = 0.22, y = 0, radius = 0.7) {
    const g = new THREE.ExtrudeGeometry(roundedShape(width, depth, radius), { depth: height, bevelEnabled: false, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); return mesh(g, material, parent, 0, y, 0);
  }
  function plant(parent, x, z, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0.27, z); g.scale.setScalar(scale); parent.add(g);
    cylinder(g, m.pot, 0, 0.3, 0, 0.25, 0.6); cylinder(g, m.walnut, 0, 0.77, 0, 0.035, 0.9);
    for (let i = 0; i < 4; i++) { const a = i * 2.3; const leaf = mesh(sphereGeometry, m.green, g, Math.cos(a) * 0.2, 1.01 + i * 0.11, Math.sin(a) * 0.2, 0.3, 0.4, 0.19); leaf.rotation.z = i % 2 ? 0.4 : -0.4; }
  }
  function chair(parent, x, z, rotation = 0, mat = m.seat, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0.27, z); g.rotation.y = rotation; g.scale.setScalar(scale); parent.add(g);
    box(g, m.chrome, 0, 0.35, 0, 0.09, 0.68, 0.09); box(g, m.chrome, 0, 0.08, 0, 0.5, 0.08, 0.5);
    box(g, mat, 0, 0.69, 0, 0.61, 0.15, 0.57); box(g, mat, 0, 1, -0.25, 0.6, 0.53, 0.11); return g;
  }
  function desk(parent, x, z, rotation = 0, width = 2.2, screen = true, mat = m.oak) {
    const g = new THREE.Group(); g.position.set(x, 0.27, z); g.rotation.y = rotation; parent.add(g);
    box(g, mat, 0, 0.97, 0, width, 0.13, 1);
    for (const side of [-1, 1]) box(g, m.chrome, side * (width / 2 - 0.2), 0.47, 0, 0.08, 0.93, 0.8);
    if (screen) { box(g, m.seat, 0, 1.17, -0.17, 0.06, 0.3, 0.09); box(g, m.screen, 0, 1.47, -0.18, 0.86, 0.53, 0.055); box(g, m.seat, 0, 1.05, 0.2, 0.54, 0.025, 0.18); }
    box(g, m.paper, width / 2 - 0.3, 1.05, 0, 0.3, 0.022, 0.4); chair(g, 0, 0.88, Math.PI); return g;
  }
  function sofa(parent, x, z, rotation = 0, width = 2.3, mat = m.blue) {
    const g = new THREE.Group(); g.position.set(x, 0.26, z); g.rotation.y = rotation; parent.add(g);
    box(g, mat, 0, 0.45, 0, width, 0.66, 0.85); box(g, mat, 0, 0.92, -0.32, width, 0.52, 0.17);
    for (const side of [-1, 1]) box(g, mat, side * width / 2, 0.68, 0, 0.15, 0.4, 0.86);
    for (let i = 0; i < Math.round(width / 0.35); i++) mesh(sphereGeometry, mat, g, -width / 2 + 0.22 + i * 0.35, 0.95, -0.21, 0.025, 0.025, 0.03);
  }
  function shelf(parent, x, z, width = 2.5, rotation = 0, wine = false) {
    const g = new THREE.Group(); g.position.set(x, 0.27, z); g.rotation.y = rotation; parent.add(g);
    box(g, m.walnut, 0, 0.95, -0.1, width, 1.9, 0.1);
    for (let row = 0; row < 3; row++) {
      box(g, m.oak, 0, 0.2 + row * 0.59, 0.08, width, 0.08, 0.5);
      box(g, m.brass, 0, 0.27 + row * 0.59, -0.02, width - 0.08, 0.025, 0.025);
      for (let col = 0; col < 6; col++) {
        const px = -width / 2 + 0.23 + col * (width - 0.46) / 5;
        if (wine) { cylinder(g, col % 2 ? m.navy : m.brass, px, 0.49 + row * 0.59, 0.1, 0.075, 0.39); }
        else box(g, [m.navy, m.brass, m.paper][col % 3], px, 0.47 + row * 0.59, 0.07, 0.15, 0.37, 0.27);
      }
    }
  }
  function furnishings(parent, section, width, depth) {
    const id = Number(section.id), g = new THREE.Group(); parent.add(g);
    g.scale.set(Math.min(1, width / 7), 1, Math.min(1, depth / 6.1));
    if (id === 8) {
      for (const x of [-3.5, -0.2, 3.1]) for (const z of [-1.7, 1.7]) desk(g, x, z, z > 0 ? Math.PI : 0, 2.5, true, m.paper);
      plant(g, -5.2, -3.2); plant(g, 5.2, 3.1); return;
    }
    plant(g, -2.8, -2.2, 0.87);
    if (id === 1) {
      box(g, m.walnut, 0, 0.95, -0.6, 3.4, 1.35, 0.85); box(g, m.oak, 0, 1.65, -0.6, 3.5, 0.07, 0.95);
      box(g, m.brass, 0, 1.05, -0.16, 1.6, 0.05, 0.018); shelf(g, 0.1, -2.55, 4.1);
      for (const x of [-2.45, 2.45]) { cylinder(g, m.paper, x, 0.8, -0.8, 0.31, 1.04); cylinder(g, m.paper, x, 1.39, -0.8, 0.23, 0.25); }
    } else if (id === 2) {
      for (const x of [-1.8, 0, 1.8]) { const d = desk(g, x, -0.1, 0, 1.65, true, m.walnut); box(d, m.screen, 0.66, 1.47, -0.18, 0.48, 0.53, 0.055); }
      shelf(g, 0.6, -2.55, 3.7);
    } else if (id === 4) {
      box(g, m.chrome, 0, 0.77, 0, 0.7, 0.95, 3.5); box(g, m.paper, 0, 1.29, 0, 1.5, 0.14, 4.8);
      for (const z of [-1.8, -0.9, 0, 0.9, 1.8]) { chair(g, -1.21, z, -Math.PI / 2, m.seat, 0.86); chair(g, 1.21, z, Math.PI / 2, m.seat, 0.86); }
      chair(g, 0, -2.9); chair(g, 0, 2.9, Math.PI); box(g, m.screen, 0.4, 1.72, -3.2, 2.65, 1.25, 0.06);
    } else if (id === 5) {
      for (const x of [-1.4, 1.4]) desk(g, x, -1.2, 0, 2, true, m.paper);
      box(g, m.glass, 0, 1.3, 1.1, 5.2, 2.05, 0.06); box(g, m.chrome, 0, 1.34, 1.11, 0.06, 2.1, 0.07);
      box(g, m.rug, 0, 0.29, 2, 5.7, 0.025, 1.5);
    } else if (id === 7) {
      shelf(g, 0.4, -2.55, 4.6, 0, true);
      box(g, m.walnut, 0.65, 0.8, -0.1, 0.75, 1, 2.7); box(g, m.oak, 0.65, 1.34, -0.1, 1.3, 0.1, 3.6);
      for (const z of [-1.2, -0.1, 1]) { chair(g, -0.45, z, -Math.PI / 2, m.paper, 0.8); chair(g, 1.75, z, Math.PI / 2, m.paper, 0.8); }
      sofa(g, -2.3, 0.8, Math.PI / 2, 1.9, m.leather); cylinder(g, m.paper, -1.3, 0.65, 1.1, 0.4, 0.5);
      box(g, m.screen, 1.65, 1.65, -2.65, 1.75, 0.95, 0.06);
    } else if (id === 12) {
      box(g, m.walnut, 0, 0.72, 0, 2.9, 0.86, 1.25); box(g, m.oak, 0, 1.21, 0, 3, 0.11, 1.3);
      for (const x of [-0.85, 0.85]) for (const z of [-1.1, 1.1]) { cylinder(g, m.oak, x, 0.62, z, 0.2, 0.72); cylinder(g, m.paper, x, 1.01, z, 0.33, 0.1); }
      for (const x of [-0.8, 0, 0.8]) cylinder(g, m.paper, x, 1.35, 0.2, 0.065, 0.12);
    } else if (id === 13) {
      desk(g, -1.4, -0.4, 0, 2.65, true, m.walnut); desk(g, 1.4, -0.4, 0, 2.65, true, m.walnut);
      shelf(g, 0.4, -2.55, 4); plant(g, 2.4, 2);
    } else if (id === 14) {
      shelf(g, 0.4, -2.55, 4.7); shelf(g, -2.85, -0.1, 3.5, Math.PI / 2);
      for (const x of [-1.3, 0, 1.3]) { box(g, m.walnut, x, 0.85, 0.4, 0.78, 1.1, 0.65); box(g, m.glass, x, 1.57, 0.4, 0.76, 0.35, 0.62); }
      box(g, m.brass, 0.4, 1.82, -2.43, 2.8, 0.12, 0.025);
    } else if ([9, 10, 11].includes(id)) {
      // The newly attributed IMG_2885–2889 set confirms the same office type,
      // but station 11 has a clear desk, two rear-wall prints and a side whiteboard.
      desk(g, 0.1, -0.45, 0, 3, id !== 11, m.walnut); chair(g, -0.65, 1.15, Math.PI); chair(g, 0.7, 1.15, Math.PI);
      if (id === 11) {
        box(g, m.chrome, -3.1, 1.65, -0.55, 0.08, 1.5, 2.65);
        box(g, m.paper, -3.04, 1.65, -0.55, 0.02, 1.34, 2.48);
        for (const x of [-0.6, 0.65]) {
          box(g, m.walnut, x, 2, -2.59, 0.86, 1.05, 0.07);
          box(g, m.paper, x, 2, -2.545, 0.72, 0.9, 0.02);
          box(g, m.rug, x, 2, -2.53, 0.47, 0.61, 0.012);
        }
      } else {
        box(g, m.chrome, 0.6, 1.65, -2.58, 2.65, 1.5, 0.08); box(g, m.paper, 0.6, 1.65, -2.52, 2.48, 1.34, 0.02);
      }
    } else {
      desk(g, 0.8, -0.9, 0, 2.9, true, id === 3 ? m.oak : m.walnut); shelf(g, 0.8, -2.55, 3.9);
      sofa(g, -2.2, 0.95, Math.PI / 2, 2.2, id === 3 ? m.leather : m.blue);
      const table = cylinder(g, m.paper, -0.8, 0.62, 1, 0.58, 0.5); table.scale.z *= 1.4;
      if (id === 6) { box(g, m.blue, 2.35, 0.78, -0.2, 0.7, 1, 1.8); sofa(g, 0, 2.1, Math.PI, 1, m.blue); }
    }
  }
  function labelTexture(number, text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 144; const ctx = c.getContext('2d');
    ctx.fillStyle = '#193c44'; ctx.beginPath(); ctx.roundRect(4, 4, 248, 136, 54); ctx.fill();
    ctx.strokeStyle = '#d8b77b'; ctx.lineWidth = 5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e6c58b';
    ctx.font = '600 94px system-ui,sans-serif'; ctx.fillText(number, 128, 76);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture); return texture;
  }
  slab(model, m.base, 65, 51, 0.55, -0.9, 5); slab(model, m.stone, 64.5, 50.5, 0.16, -0.35, 4.8);
  const ground = mesh(new THREE.PlaneGeometry(250, 250), makeMat('#e5e9e5'), scene, 0, -0.93, 0);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  sections.forEach((section, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, count), central = Number(section.id) === 8;
    const x = section.position?.x ?? (central ? 0 : Math.cos(angle) * 23);
    const z = section.position?.z ?? (central ? 0 : Math.sin(angle) * 17);
    const width = section.size?.width ?? (central ? 13 : 7), depth = section.size?.depth ?? (central ? 9 : 6.1);
    let rotation = section.rotation ?? (central ? 0 : -angle - Math.PI / 2); if (Math.abs(rotation) > Math.PI * 2) rotation *= Math.PI / 180;
    const group = new THREE.Group(); group.name = `${String(section.id).padStart(2, '0')} ${section.titleZh || section.title}`;
    group.userData = { sectionId: section.id, approximate: true }; group.position.set(x, 0, z); group.rotation.y = rotation; model.add(group);
    const floor = slab(group, (Number(section.id) === 1 || Number(section.id) === 14 ? m.stone : m.carpet).clone(), width, depth, 0.28, 0, central ? 2.1 : 0.85);
    const trim = slab(group, m.brass.clone(), width + 0.14, depth + 0.14, 0.08, -0.035, central ? 2.15 : 0.9);
    if (central) {
      // Curved glass boundary is supported by section 08 photos; plan remains approximate.
      const curve = new THREE.EllipseCurve(0, 0, width / 2, depth / 2, 0.15, Math.PI * 1.85, false, 0);
      const points = curve.getPoints(42);
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1], len = a.distanceTo(b);
        const panel = box(group, m.glass, (a.x + b.x) / 2, 1.4, (a.y + b.y) / 2, len + 0.02, 2.15, 0.055);
        panel.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        if (i % 4 === 0) box(group, m.chrome, a.x, 1.4, a.y, 0.045, 2.2, 0.045);
      }
    } else if (![5, 13, 14].includes(Number(section.id))) {
      box(group, m.walnut, 0, 0.88, -depth / 2 + 0.1, width - 1, 1.2, 0.17);
      box(group, m.brass, 0, 1.5, -depth / 2 + 0.1, width - 1, 0.04, 0.19);
      for (const side of [-1, 1]) {
        box(group, m.navy, side * (width / 2 - 0.12), 0.51, -0.2, 0.13, 0.45, depth - 1.5);
        box(group, m.glass, side * (width / 2 - 0.12), 1.41, -0.2, 0.06, 1.38, depth - 1.5);
        box(group, m.chrome, side * (width / 2 - 0.12), 2.12, -0.2, 0.07, 0.025, depth - 1.5);
      }
    }
    furnishings(group, section, width, depth);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(String(section.id).padStart(2, '0'), section.titleZh || section.title || 'Room'), depthTest: false, depthWrite: false }));
    sprite.position.set(0, central ? 3.8 : 3.4, 0); sprite.scale.set(2.6, 1.46, 1); sprite.renderOrder = 5; sprite.userData.label = section.titleZh || section.title; group.add(sprite); labels.push(sprite);
    group.traverse(item => { if (item.isMesh || item.isSprite) item.userData.sectionId = section.id; }); pickables.push(group);
    const manager = section.kind === 'manager';
    // Stand beside the visitor chairs, not immediately behind their backrests.
    const interiorLocal = central ? new THREE.Vector3(width * 0.369, 1.85, depth * 0.255) : new THREE.Vector3(manager ? width * 0.34 : 0, 1.85, depth / 2 - 1.1);
    const interiorPosition = interiorLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation).add(group.position);
    const interiorHeading = central ? rotation + Math.atan2(-interiorLocal.x - 1, -interiorLocal.z - 0.4) : manager ? rotation + Math.atan2(-interiorLocal.x, -interiorLocal.z - 0.45) : rotation + Math.PI;
    rooms.set(String(section.id), { group, floor, trim, sprite, index, interiorPosition, interiorHeading, originalColor: floor.material.color.clone() });
    // Stations follow sequence; the central workspace is accessed from the loop.
    const waypoint = new THREE.Vector3(Math.cos(angle) * 17.6, 0.2, Math.sin(angle) * 11.5); stationPoints.push(waypoint);
    const entrance = new THREE.Vector3(0, 0.1, depth / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation).add(group.position);
    if (central) entrance.set(0, 0.1, depth / 2);
    const mid = entrance.clone().add(waypoint).multiplyScalar(0.5);
    const bridge = box(model, m.rug, mid.x, 0.055, mid.z, 1.75, 0.1, entrance.distanceTo(waypoint) + 0.25);
    bridge.rotation.y = Math.atan2(entrance.x - waypoint.x, entrance.z - waypoint.z);
  });
  const route = new THREE.CatmullRomCurve3(stationPoints.length > 1 ? stationPoints : [new THREE.Vector3(-5, 0.2, 0), new THREE.Vector3(5, 0.2, 0)], true, 'centripetal');
  const vertices = [], indices = [], samples = Math.max(200, count * 24);
  for (let i = 0; i <= samples; i++) {
    const p = route.getPointAt(i / samples), t = route.getTangentAt(i / samples), side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(1.18);
    vertices.push(p.x + side.x, 0.08, p.z + side.z, p.x - side.x, 0.08, p.z - side.z);
    if (i < samples) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const ribbonGeometry = new THREE.BufferGeometry(); ribbonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); ribbonGeometry.setIndex(indices); ribbonGeometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(ribbonGeometry, makeMat('#d8c9a9', { side: THREE.DoubleSide })); ribbon.name = 'Clockwise and counterclockwise connection corridor'; ribbon.receiveShadow = true; model.add(ribbon);
  const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.getSpacedPoints(samples)), new THREE.LineDashedMaterial({ color: '#aa8247', dashSize: 0.4, gapSize: 0.3 })); routeLine.computeLineDistances(); model.add(routeLine);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count, p = route.getPoint(t), tangent = route.getTangent(t);
    const g = new THREE.ConeGeometry(0.18, 0.45, 3); g.rotateX(Math.PI / 2);
    const arrow = mesh(g, m.navy, model, p.x, 0.24, p.z); arrow.rotation.y = Math.atan2(tangent.x, tangent.z); arrow.userData.heading = arrow.rotation.y; arrowMarkers.push(arrow);
  }
  const marker = new THREE.Group(); scene.add(marker); cylinder(marker, m.brass, 0, 0.09, 0, 0.42, 0.17);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 48), new THREE.MeshBasicMaterial({ color: '#a87533', transparent: true, opacity: 0.65, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; marker.add(halo);
  const stationProgress = stationPoints.map(point => {
    let min = Infinity, at = 0; for (let i = 0; i < 1000; i++) { const d = route.getPointAt(i / 1000).distanceToSquared(point); if (d < min) { min = d; at = i / 1000; } } return at;
  });
  function selectSection(id, animate = true) {
    const chosen = rooms.get(String(id)); if (!chosen) return; currentIndex = chosen.index;
    interior = false; entryTransition = null;
    rooms.forEach(room => {
      const active = room === chosen; room.floor.material.color.copy(active ? new THREE.Color('#f3e5bd') : room.originalColor);
      room.trim.material.color.set(active ? '#e0ac54' : '#bc9552'); room.sprite.material.color.set(active ? '#ffffff' : '#d6e0dc');
      room.sprite.scale.set(active ? 3.05 : 2.6, active ? 1.72 : 1.46, 1);
    });
    const next = stationProgress[currentIndex] || 0;
    if (mode === 'walk' && animate) {
      const normalized = ((progress % 1) + 1) % 1;
      let delta = next - normalized; if (delta > 0.5) delta -= 1; if (delta < -0.5) delta += 1;
      travel = { from: progress, delta, start: performance.now(), duration: Math.min(2600, 600 + Math.abs(delta) * 4200) };
    } else { progress = next; travel = null; }
    marker.position.copy(stationPoints[currentIndex] || new THREE.Vector3());
  }
  function walkView(time = performance.now()) {
    const t = ((progress % 1) + 1) % 1, p = route.getPointAt(t), tangent = route.getTangentAt(t).multiplyScalar(direction);
    const room = rooms.get(String(sections[currentIndex]?.id));
    const position = interior && room ? room.interiorPosition.clone() : new THREE.Vector3(p.x, 1.85, p.z);
    if (entryTransition) {
      const elapsed = Math.min(1, (time - entryTransition.start) / 900), eased = elapsed * elapsed * (3 - 2 * elapsed);
      position.lerpVectors(entryTransition.from, entryTransition.to, eased);
      if (elapsed === 1) entryTransition = null;
    }
    const angle = (interior && room ? room.interiorHeading : Math.atan2(tangent.x, tangent.z)) + yaw;
    camera.position.copy(position); camera.lookAt(position.x + Math.sin(angle) * Math.cos(pitch), position.y + Math.sin(pitch), position.z + Math.cos(angle) * Math.cos(pitch)); marker.position.copy(p);
  }
  function setMode(next) {
    if (!['walk', 'overview'].includes(next)) return;
    if (next === mode) { if (next === 'overview') { autoFit = true; fitOverview(); controls.update(); } return; }
    if (next === 'walk') { previousCamera.copy(camera.position); previousTarget.copy(controls.target); controls.enabled = false; yaw = 0; pitch = 0; progress = stationProgress[currentIndex] || 0; }
    else { camera.position.copy(previousCamera); controls.target.copy(previousTarget); controls.enabled = true; controls.update(); }
    mode = next; camera.fov = mode === 'walk' ? 60 : 40; camera.updateProjectionMatrix(); travel = null; interior = false; entryTransition = null; marker.visible = mode === 'overview'; labels.forEach(label => { label.visible = mode === 'overview'; }); if (mode === 'walk') walkView();
  }
  function enterRoom() {
    const room = rooms.get(String(sections[currentIndex]?.id)); if (!room) return false;
    if (interior) return true;
    setMode('walk'); travel = null; progress = stationProgress[currentIndex] || 0; yaw = 0; pitch = 0;
    // selectSection can run before the next render frame. Resolve the selected
    // doorway now so entering never starts at the previous room or overview camera.
    entryTransition = null; walkView();
    entryTransition = { from: camera.position.clone(), to: room.interiorPosition.clone(), start: performance.now() }; interior = true; return true;
  }
  function leaveRoom() {
    if (!interior) return false; interior = false; yaw = 0; pitch = 0;
    const target = route.getPointAt(((progress % 1) + 1) % 1); target.y = 1.85;
    entryTransition = { from: camera.position.clone(), to: target, start: performance.now() }; return true;
  }
  function setDirection(value) { direction = value < 0 ? -1 : 1; yaw = 0; arrowMarkers.forEach(arrow => { arrow.rotation.y = arrow.userData.heading + (direction < 0 ? Math.PI : 0); }); }
  function step(delta = 1) { if (!count) return; const index = (currentIndex + Math.sign(delta || 1) * direction + count) % count; selectSection(sections[index].id); onSelect(sections[index].id); }
  function look(delta = 0) {
    if (mode !== 'walk' || !Number.isFinite(delta)) return false;
    yaw += delta; walkView(); return true;
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function pointerStart(event) { pointerDown = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY }; moved = false; if (mode === 'walk') canvas.setPointerCapture?.(event.pointerId); }
  function pointerMove(event) {
    if (!pointerDown) return; if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) moved = true;
    if (mode === 'walk') { yaw -= (event.clientX - pointerDown.lastX) * 0.005; pitch = THREE.MathUtils.clamp(pitch + (event.clientY - pointerDown.lastY) * 0.004, -1.02, 1.02); }
    pointerDown.lastX = event.clientX; pointerDown.lastY = event.clientY;
  }
  function pointerEnd(event) {
    const clicked = pointerDown && !moved; pointerDown = null; if (mode !== 'overview' || !clicked) return;
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(pickables, true).find(item => item.object.userData.sectionId != null);
    if (hit) { const id = hit.object.userData.sectionId; selectSection(id); onSelect(id); }
  }
  function keydown(event) {
    if (mode !== 'walk') return;
    if (['ArrowUp', 'w', 'W'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (typeof onMove === 'function') onMove('forward'); else step(1); }
    else if (['ArrowDown', 's', 'S'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (typeof onMove === 'function') onMove('back'); else step(-1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); look(0.16); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); look(-0.16); }
  }
  function contextLost(event) { event.preventDefault(); onError(new Error('WebGL context lost. The photo tour remains available.')); }
  canvas.addEventListener('pointerdown', pointerStart); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerEnd); canvas.addEventListener('pointercancel', pointerEnd); canvas.addEventListener('keydown', keydown); canvas.addEventListener('webglcontextlost', contextLost);
  function fitOverview() { const factor = Math.max(1, 1.4 / camera.aspect); camera.position.set(32.8 * factor, 37.4 * factor, 42.9 * factor); controls.target.set(0, -3, 0); }
  function resize() { if (disposed) return; const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight || 500); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); if (mode === 'overview' && autoFit) fitOverview(); }
  const observer = new ResizeObserver(resize); observer.observe(container); resize(); if (count) selectSection(sections[0].id, false);
  function animate(time) {
    if (disposed || !active) return; frame = requestAnimationFrame(animate);
    if (mode === 'walk') { if (travel) { const t = Math.min(1, (time - travel.start) / travel.duration); progress = travel.from + travel.delta * t * t * (3 - 2 * t); if (t === 1) { progress = ((progress % 1) + 1) % 1; travel = null; } } walkView(time); }
    else controls.update(); halo.material.opacity = 0.55 + Math.sin(time * 0.002) * 0.16; renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  function setActive(value) { const next = Boolean(value); if (active === next || disposed) return; active = next; if (active) { resize(); frame = requestAnimationFrame(animate); } else cancelAnimationFrame(frame); }
  async function exportGLB() {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    // Sprites are viewer labels, not geometry. Export architectural illustration only.
    const visibility = labels.map(label => label.visible); labels.forEach(label => { label.visible = false; });
    try { const bytes = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true }); return new Blob([bytes], { type: 'model/gltf-binary' }); }
    finally { labels.forEach((label, index) => { label.visible = visibility[index]; }); }
  }
  function dispose() {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
    canvas.removeEventListener('pointerdown', pointerStart); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerEnd); canvas.removeEventListener('pointercancel', pointerEnd); canvas.removeEventListener('keydown', keydown); canvas.removeEventListener('webglcontextlost', contextLost);
    const geometries = new Set(), materials = new Set(); scene.traverse(item => { if (item.geometry) geometries.add(item.geometry); if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(mat => materials.add(mat)); });
    geometries.forEach(g => g.dispose()); materials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose()); renderer.dispose(); canvas.remove();
  }
  return { selectSection, setMode, setDirection, step, look, enterRoom, leaveRoom, setActive, resize, exportGLB, dispose };
}
