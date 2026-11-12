// 3D-сцена: монтажная панель, аппараты, провода, взаимодействие мышью
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFS, termPos } from './defs.js';
import { wireColor, fmt, cabs } from './sim.js';
import { Ctx, mat, box } from './m3d.js';
import { MODELS_A } from './models_a.js';
import { MODELS_B } from './models_b.js';
import { MODELS_C, TAGS } from './models_c.js';
import { MODELS_D } from './models_d.js';
import { MODELS_E } from './models_e.js';
import { route, obstacles } from './schematic.js';
const MODELS = { ...MODELS_A, ...MODELS_B, ...MODELS_C, ...MODELS_D, ...MODELS_E };
export const BOARD = { w: 170, h: 100 };
const snap = (v, s) => Math.round(v / s) * s;

export class Scene3D {
  constructor(el, game) {
    this.el = el; this.game = game; this.items = new Map(); this.wires = new Map(); this.xray = false; this.labels = [];
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2)); el.appendChild(r.domElement);
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x1a222c);
    this.cam = new THREE.PerspectiveCamera(38, 1, 1, 2000); this.cam.position.set(0, -10, 150);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.5)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(40, 80, 120); sc.add(dl);
    // панель и DIN-рейки
    sc.add(box(BOARD.w, BOARD.h, 1, mat(0xcfd4d9), 0, 0, -0.5));
    const grid = new THREE.GridHelper(BOARD.w, BOARD.w / 5, 0xaab2ba, 0xbcc3ca); grid.rotation.x = Math.PI / 2; grid.position.z = 0.02; grid.scale.z = BOARD.h / BOARD.w; sc.add(grid);
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const c = this.ctl = new OrbitControls(this.cam, r.domElement);
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.screenSpacePanning = true; c.minDistance = 20; c.maxDistance = 320; c.maxPolarAngle = Math.PI * 0.85; c.minPolarAngle = Math.PI * 0.15; c.minAzimuthAngle = -1.2; c.maxAzimuthAngle = 1.2;
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    // точки-«электроны»
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.27, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffaa }), 900); this.dots.count = 0; this.dots.frustumCulled = false; this.dots.raycast = () => { }; sc.add(this.dots);
    this.rubber = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffd23f })); this.rubber.visible = false; this.rubber.frustumCulled = false; sc.add(this.rubber);
    this.ghost = box(1, 1, 1, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35 })); this.ghost.visible = false; sc.add(this.ghost);
    this.selBox = new THREE.BoxHelper(this.ghost, 0xffd23f); this.selBox.visible = false; sc.add(this.selBox);
    this.lab = document.createElement('div'); this.lab.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; el.appendChild(this.lab);
    const d = r.domElement;
    d.addEventListener('pointerdown', e => this.down(e), true); d.addEventListener('pointermove', e => this.move(e)); window.addEventListener('pointerup', e => this.up(e));
    d.addEventListener('contextmenu', e => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(el); this.resize();
  }
  resize() { const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  resetView() {   // вписать всю сборку в окно, с лёгким наклоном, чтобы был виден объём
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const cs = this.game.circuit.comps;
    for (const c of cs) { const d = DEFS[c.type]; x0 = Math.min(x0, c.x - d.w / 2); x1 = Math.max(x1, c.x + d.w / 2); y0 = Math.min(y0, c.y - d.h / 2); y1 = Math.max(y1, c.y + d.h / 2); }
    if (!cs.length) { x0 = -45; x1 = 45; y0 = -30; y1 = 30; }
    const w = Math.max(50, x1 - x0 + 24), h = Math.max(40, y1 - y0 + 16), t = Math.tan(this.cam.fov * Math.PI / 360), asp = this.cam.aspect || 1;
    this.focus((x0 + x1) / 2, (y0 + y1) / 2, Math.min(300, Math.max(h / 2 / t, w / 2 / t / asp) * 1.08));
  }
  focus(x, y, dist) { this.cam.position.set(x + dist * 0.12, y - dist * 0.2, dist * 0.97); this.ctl.target.set(x, y, 0); this.ctl.update(); }

  // ---------- построение ----------
  rebuild() {
    for (const it of this.items.values()) this.scene.remove(it.g); this.items.clear();
    for (const m of this.wires.values()) { this.scene.remove(m); m.geometry.dispose(); } this.wires.clear();
    for (const c of this.game.circuit.comps) this.addComp(c);
    for (const w of this.game.circuit.wires) this.addWire(w);
    this.applyXray(); this.pend = null; this.rubber.visible = false;
  }
  addComp(c) {
    if (!this.game.circuit.comps.includes(c)) return;
    const old = this.items.get(c.id); if (old) this.scene.remove(old.g);
    const k = new Ctx(c, DEFS[c.type]); const upd = MODELS[c.type](k, c);
    k.g.position.set(c.x, c.y, 0); k.g.userData.compId = c.id; this.scene.add(k.g);
    this.items.set(c.id, { g: k.g, upd, k, c }); this.applyXray(k);
  }
  removeComp(id) { const it = this.items.get(id); if (it) { this.scene.remove(it.g); this.items.delete(id); } }
  tpos(ref) {
    const c = this.game.circuit.comps.find(c => c.id === ref.c); if (!c) return null; const p = termPos(c, ref.t), it = this.items.get(c.id);
    return { v: new THREE.Vector3(p.x, p.y, (it ? it.k.zt : 3) + 0.7), s: p.s };
  }
  // Провод идёт «по-монтажному»: прямыми участками под прямым углом, каждый в своей «дорожке»
  addWire(w) {
    if (!this.game.circuit.wires.includes(w)) return;
    const old = this.wires.get(w); if (old) { this.scene.remove(old); old.geometry.dispose(); }
    const ca = this.comp(w.a.c), cb = this.comp(w.b.c), A = this.tpos(w.a), B = this.tpos(w.b); if (!A || !B) return;
    const a = termPos(ca, w.a.t), b = termPos(cb, w.b.t); a.cx = ca.x; a.w = DEFS[ca.type].w; b.cx = cb.x; b.w = DEFS[cb.type].w;
    let p2 = route(a, b, w.n || 0, obstacles(this.game.circuit.comps)); if (Math.hypot(p2[0][0] - a.x, p2[0][1] - a.y) > 0.01) p2 = p2.slice().reverse();
    const zl = Math.max(A.v.z, B.v.z) + 0.9 + ((w.n || 0) % 6) * 0.42;
    let pts = p2.map((q, i) => new THREE.Vector3(q[0], q[1], i === 0 ? A.v.z : i === p2.length - 1 ? B.v.z : zl));
    pts = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.05);
    if (pts.length < 2) pts = [A.v, B.v.clone().add(new THREE.Vector3(0.01, 0, 0))];
    const curve = new THREE.CurvePath(); let prev = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const P = pts[i], d1 = P.clone().sub(pts[i - 1]), d2 = pts[i + 1].clone().sub(P), r = Math.min(0.9, d1.length() / 2, d2.length() / 2);
      const e1 = P.clone().sub(d1.normalize().multiplyScalar(r)), e2 = P.clone().add(d2.normalize().multiplyScalar(r));
      if (e1.distanceTo(prev) > 0.01) curve.add(new THREE.LineCurve3(prev, e1)); curve.add(new THREE.QuadraticBezierCurve3(e1, P, e2)); prev = e2;
    }
    curve.add(new THREE.LineCurve3(prev, pts[pts.length - 1]));
    const len = curve.getLength(), rad = 0.13 + Math.sqrt(w.mm2 || 2.5) * 0.075;
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(len * 1.5)), rad, 7), mat(0x8a8f96, { roughness: 0.45, emissive: 0xff2200, emissiveIntensity: 0, transparent: true }));
    m.userData.wire = w; m.userData.curve = curve; m.userData.len = len; w.ph = w.ph || 0;
    if (!w.len) w.len = Math.max(0.5, +(len * 0.06).toFixed(1));
    this.scene.add(m); this.wires.set(w, m);
  }
  removeWire(w) { const m = this.wires.get(w); if (m) { this.scene.remove(m); m.geometry.dispose(); this.wires.delete(w); } }
  rewire(id) { for (const w of this.game.circuit.wires) if (w.a.c === id || w.b.c === id) this.addWire(w); }
  setXray(on) { this.xray = on; this.applyXray(); }
  inspect(c) { this.inspectId = c ? c.id : null; this.applyXray(); if (c) { const df = DEFS[c.type], dist = Math.max(df.w, df.h) * 1.5 + 16; this.cam.position.set(c.x + dist * 0.3, c.y - dist * 0.22, dist * 0.93); this.ctl.target.set(c.x, c.y, df.d / 2); this.ctl.update(); } }
  applyXray(only) {
    for (const it of only ? [{ k: only }] : this.items.values()) {
      const on = this.xray || (this.inspectId && it.k.c.id === this.inspectId); it.k.xr = on; it.k.inner.visible = on;
      for (const s of it.k.shells) { s.material.transparent = on; s.material.opacity = on ? 0.16 : 1; s.material.depthWrite = !on; s.material.needsUpdate = true; s.renderOrder = on ? 2 : 0; }
    }
  }

  // ---------- указатель ----------
  pick(e, withBoard) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.cam);
    if (withBoard) { const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? p : null; }
    const objs = [...this.wires.values()]; for (const it of this.items.values()) objs.push(it.g);
    const hits = this.ray.intersectObjects(objs, true).filter(h => h.object.visible && !(this.xray && h.object.userData.shell && false));
    // клеммы имеют приоритет, если они рядом с первым попаданием
    const first = hits[0]; if (!first) return null;
    const th = hits.find(h => h.object.userData.term || (h.object.parent && h.object.parent.userData.term));
    const h = th && th.distance - first.distance < 2.5 ? th : first;
    let o = h.object, res = { act: null, term: null, comp: null, wire: o.userData.wire || null };
    while (o) { if (o.userData.term && !res.term) res.term = o.userData.term; if (o.userData.act && !res.act) res.act = o.userData.act; if (o.userData.compId) { res.comp = o.userData.compId; break; } o = o.parent; }
    return res;
  }
  comp(id) { return this.game.circuit.comps.find(c => c.id === id); }
  down(e) {
    if (e.button !== 0) return; const g = this.game;
    if (g.placeType) { const p = this.pick(e, true); if (p) g.addComp(g.placeType, snap(p.x, 1.5), snap(p.y, 1)); this.ctl.enabled = false; this.dn = { none: true }; return; }
    const h = this.pick(e);
    if (!h) { if (this.pend) { this.pend = null; this.rubber.visible = false; } g.select(null); this.dn = null; return; }
    this.ctl.enabled = false; this.dn = { x: e.clientX, y: e.clientY, h, moved: false };
    if (h.term && h.comp) { this.dn.none = true; if (!this.readonly) this.clickTerm({ c: h.comp, t: h.term }); return; }
    if (h.comp) {
      const c = this.comp(h.comp);
      if (h.act === 'press') { c.state.pressed = true; this.dn.press = c; g.select(c); return; }
      const p = this.pick(e, true); this.dn.c = c; this.dn.off = p ? { x: c.x - p.x, y: c.y - p.y } : { x: 0, y: 0 };
    }
  }
  move(e) {
    const g = this.game, d = this.dn;
    if (g.placeType) { const p = this.pick(e, true), df = DEFS[g.placeType]; this.ghost.visible = !!p; if (p) { this.ghost.scale.set(df.w, df.h, df.d); this.ghost.position.set(snap(p.x, 1.5), snap(p.y, 1), df.d / 2); } return; }
    this.ghost.visible = false;
    if (d && d.c && !d.c.locked && (d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5)) {
      d.moved = true; const p = this.pick(e, true); if (!p) return; const c = d.c, df = DEFS[c.type];
      c.x = Math.max(-BOARD.w / 2 + df.w / 2, Math.min(BOARD.w / 2 - df.w / 2, snap(p.x + d.off.x, 1.5))); c.y = Math.max(-BOARD.h / 2 + df.h / 2, Math.min(BOARD.h / 2 - df.h / 2, snap(p.y + d.off.y, 1)));
      this.items.get(c.id).g.position.set(c.x, c.y, 0); this.rewire(c.id); g.changed(true); return;
    }
    if (this.pend) { const a = this.tpos(this.pend), p = this.pick(e, true); if (a && p) { p.z = a.v.z; this.rubber.geometry.setFromPoints([a.v, p]); this.rubber.visible = true; } }
    if (!d) {
      const h = this.pick(e); let tip = '';
      if (h && h.comp) { const c = this.comp(h.comp), df = DEFS[c.type]; if (h.term) { const net = g.circuit.net, v = net ? cabs(net.v(net.node(c.id + '.' + h.term))) : 0; tip = `${c.label} · клемма «${h.term}» · ${fmt(v)}В относительно земли — клик, чтобы ${this.pend ? 'подключить провод' : 'начать провод'}`; } else tip = `${c.label} — ${df.name}` + (h.act ? ' · клик — действие' : ''); }
      else if (h && h.wire) { const w = h.wire, la = this.comp(w.a.c), lb = this.comp(w.b.c); tip = `Провод ${la ? la.label : '?'}:${w.a.t} ⟷ ${lb ? lb.label : '?'}:${w.b.t} · ${w.mm2} мм² · ${fmt(w.i || 0)}А — клик, чтобы выделить`; }
      if (this.readonly) tip = tip.replace(/ — клик, чтобы (подключить|начать) провод/, '');
      if (this.blind) tip = h && h.comp ? this.comp(h.comp).label + (h.term ? ' · клемма «' + h.term + '»' : ' — ' + DEFS[this.comp(h.comp).type].name) : '';
      this.hoverWire = !this.blind && h && h.wire || null;
      this.renderer.domElement.style.cursor = h ? 'pointer' : g.placeType ? 'crosshair' : 'grab'; g.hud(tip);
    }
  }
  up(e) {
    const d = this.dn; this.dn = null; this.ctl.enabled = true; if (!d || d.none) return; const g = this.game;
    if (d.press) { d.press.state.pressed = false; return; }
    if (d.moved) { g.select(d.c); g.changed(); return; }
    if (d.h.wire) { g.select(d.h.wire); return; }
    if (d.c) { const df = DEFS[d.c.type]; if (d.h.act && df.click) { df.click(d.c, d.h.act); g.changed(); } g.select(d.c); }
  }
  clickTerm(ref) {
    if (!this.pend) { this.pend = ref; this.game.hud(''); return; }
    const a = this.pend; this.pend = null; this.rubber.visible = false;
    if (a.c === ref.c && a.t === ref.t) return; this.game.addWire(a, ref);
  }
  cancel() { this.pend = null; this.rubber.visible = false; this.ghost.visible = false; }

  // ---------- кадр ----------
  update(t, dt) {
    this.ctl.update(); const g = this.game, M = new THREE.Matrix4(); let n = 0; const col = new THREE.Color();
    for (const it of this.items.values()) it.upd(it.c, t, dt);
    let li = 0; const lpos = [];
    for (const [w, m] of this.wires) {
      col.set(this.blind ? '#c2a23a' : wireColor(w)); m.material.color.lerp(col, 0.3); m.material.emissiveIntensity = Math.min(1, (w.heat || 0) * 1.5);
      const I = w.i || 0; if (I < 1e-4 || w.burned || this.blind) continue;
      const sp = Math.min(1, Math.log10(1 + I * 100) / 4), L = m.userData.len, cnt = Math.max(2, Math.min(12, Math.round(L / 4)));
      let off; if (w.kind === 'dc') { w.ph = (w.ph + Math.sign(w.ire) * sp * dt * 9 / L + 1) % 1; off = w.ph; } else off = 0.5 / cnt + Math.sin(t * 7) * (0.25 + sp) * 1.2 / L;
      for (let i = 0; i < cnt && n < 900; i++) { const u = ((i / cnt + off) % 1 + 1) % 1, p = m.userData.curve.getPointAt(u); M.makeTranslation(p.x, p.y, p.z); this.dots.setMatrixAt(n++, M); }
      if (g.showVals && I > 1e-3) { const W = this.el.clientWidth, H = this.el.clientHeight; for (const u of [0.5, 0.3, 0.7, 0.15, 0.85]) { const p = m.userData.curve.getPointAt(u).project(this.cam), sx = (p.x + 1) / 2 * W, sy = (1 - p.y) / 2 * H; if (p.z > 1 || lpos.some(q => Math.abs(q[0] - sx) < 58 && Math.abs(q[1] - sy) < 17)) continue; lpos.push([sx, sy]); this.setLabel(li++, p, fmt(I) + 'А'); break; } }
    }
    for (; li < this.labels.length; li++) this.labels[li].style.display = 'none';
    this.dots.count = n; this.dots.instanceMatrix.needsUpdate = true;
    const s = g.selected; if (s && s.type && this.items.get(s.id)) { this.selBox.setFromObject(this.items.get(s.id).g); this.selBox.visible = !this.items.get(s.id).k.xr; } else this.selBox.visible = false;
    // выделенное подсвечиваем, остальные провода приглушаем — так легко проследить цепь
    for (const [w, m] of this.wires) {
      const rel = !s || w === s || (s.type && (w.a.c === s.id || w.b.c === s.id)), hi = w === s || w === this.hoverWire;
      m.material.opacity += ((this.inspectId ? 0.1 : rel || w === this.hoverWire ? 1 : 0.16) - m.material.opacity) * 0.25; m.material.depthWrite = m.material.opacity > 0.6;
      m.material.emissive.setHex(hi ? 0xffffff : 0xff2200); if (hi) m.material.emissiveIntensity = 0.35;
    }
    // подписи деталей у «вскрытого» устройства
    let ti = 0; const it = s && s.type ? this.items.get(s.id) : null;
    if (it && it.k.xr && TAGS[s.type]) {
      const W = this.el.clientWidth, H = this.el.clientHeight, v = new THREE.Vector3();
      const ps = TAGS[s.type].map(([text, x, y, z]) => { v.set(s.x + x, s.y + y, z).project(this.cam); return { text, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; }).sort((p, q) => p.y - q.y);
      const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length;
      ps.forEach((p, i) => { p.side = p.x === cx ? (i % 2 ? 1 : -1) : p.x > cx ? 1 : -1; });
      for (const sd of [-1, 1]) { const col = ps.filter(p => p.side === sd); if (!col.length && false) continue; }
      if (ps.filter(p => p.side > 0).length > ps.length - 1 || ps.filter(p => p.side < 0).length > ps.length - 1) ps.forEach((p, i) => p.side = i % 2 ? 1 : -1);
      for (let i = 0; i < ps.length; i++) { const p = ps[i]; let ly = p.y; for (let j = 0; j < i; j++) if (ps[j].side === p.side && Math.abs(ps[j].ly - ly) < 21) ly = ps[j].ly + 21; p.ly = ly; this.setTag(ti++, p); }
    }
    for (; ti < (this.tagEls || []).length; ti++) this.tagEls[ti].style.display = 'none';
    this.renderer.render(this.scene, this.cam);
  }
  setTag(i, p) {
    this.tagEls = this.tagEls || []; let d = this.tagEls[i];
    if (!d) { d = this.tagEls[i] = document.createElement('div'); d.innerHTML = '<i></i><b></b><span></span>'; d.className = 'tag3d'; this.lab.appendChild(d); }
    if (p.z > 1) { d.style.display = 'none'; return; }
    const right = p.side > 0, lx = p.x + p.side * 90;
    d.style.display = ''; const [dot, line, txt] = d.children;
    dot.style.cssText = `left:${p.x - 3}px;top:${p.y - 3}px`;
    const dx = lx - p.x, dy = p.ly - p.y; line.style.cssText = `left:${p.x}px;top:${p.y}px;width:${Math.hypot(dx, dy)}px;transform:rotate(${Math.atan2(dy, dx)}rad)`;
    txt.style.cssText = `top:${p.ly}px;` + (right ? `left:${lx}px;transform:translateY(-50%)` : `left:${lx}px;transform:translate(-100%,-50%)`); if (txt.textContent !== p.text) txt.textContent = p.text;
  }
  setLabel(i, p, text) {
    let d = this.labels[i]; if (!d) { d = this.labels[i] = document.createElement('div'); d.style.cssText = 'position:absolute;background:#000b;color:#ffe;padding:0 4px;border-radius:3px;font:11px Consolas,monospace;transform:translate(-50%,-50%);white-space:nowrap'; this.lab.appendChild(d); }
    if (p.z > 1) { d.style.display = 'none'; return; }
    d.style.display = ''; d.style.left = ((p.x + 1) / 2 * this.el.clientWidth) + 'px'; d.style.top = ((1 - p.y) / 2 * this.el.clientHeight) + 'px'; if (d.textContent !== text) d.textContent = text;
  }
}
