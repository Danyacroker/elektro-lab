// Общие помощники для процедурных 3D-моделей
import * as THREE from 'three';

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
export const COL = { brass: 0xd8b44a, copper: 0xc8702a, steel: 0x9aa4ae, dark: 0x22262b, white: 0xe9ecef, grey: 0xb9c0c7, core: 0x4a5058, red: 0xd03030, green: 0x2faa4a, yellow: 0xf2c400, blue: 0x2a6fd6 };
const metal = c => mat(c, { metalness: 0.8, roughness: 0.3 });
export const MET = { brass: metal(COL.brass), copper: metal(COL.copper), steel: metal(COL.steel) };

export function box(w, h, d, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
export function cyl(r, h, m, x = 0, y = 0, z = 0, axis = 'z', r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, h, 24); if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o;
}
export function torus(R, r, m, x = 0, y = 0, z = 0, arc = Math.PI * 2) { const o = new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 28, arc), m); o.position.set(x, y, z); return o; }
export function sphere(r, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); o.position.set(x, y, z); return o; }
// катушка: стопка витков
export function coil(R, r, n, m, x, y, z, axis = 'y') {
  const g = new THREE.Group(); for (let i = 0; i < n; i++) { const t = torus(R, r, m, 0, 0, (i - (n - 1) / 2) * r * 1.9); g.add(t); }
  if (axis === 'y') g.rotation.x = Math.PI / 2; else if (axis === 'x') g.rotation.y = Math.PI / 2; g.position.set(x, y, z); return g;
}

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches, HITMAT = new THREE.MeshBasicMaterial({ visible: false });
const texCache = new Map();
export function textTexture(text, { fg = '#111', bg = null, w = 128, h = 64, font = 'bold 40px Arial' } = {}) {
  const key = text + fg + bg + w + h + font; if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
export function plate(text, w, h, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(text, { w: Math.round(64 * w / h), h: 64, ...o }), transparent: !o.bg }));
  m.position.set(x, y, z); return m;
}
// экранчик прибора с обновляемым текстом
export function display(w, h, x, y, z, { fg = '#7dff9b', bg = '#0a1a10' } = {}) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w); const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(x, y, z);
  let last = null;
  m.userData.draw = (text) => {
    if (text === last) return; last = text; g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = cv.height * 0.6; g.font = `bold ${fs}px Consolas, monospace`;
    while (g.measureText(text).width > cv.width - 12 && fs > 10) { fs -= 2; g.font = `bold ${fs}px Consolas, monospace`; }
    g.fillText(text, cv.width / 2, cv.height / 2 + 2); tex.needsUpdate = true;
  };
  m.userData.draw(''); return m;
}

// Контекст сборки модели одного устройства
export class Ctx {
  constructor(c, def) {
    this.c = c; this.def = def; this.g = new THREE.Group(); this.inner = new THREE.Group(); this.g.add(this.inner);
    this.shells = []; this.w = def.w; this.h = def.h; this.d = def.d; this.zt = def.d * 0.55;
  }
  shell(m) { m.userData.shell = true; this.shells.push(m); this.g.add(m); return m; }
  add(m, act) { if (act) m.traverse(o => o.userData.act = act); this.g.add(m); return m; }
  in(m) { this.inner.add(m); return m; }
  // корпус модульного аппарата: тело + выступающий «нос»
  modular(color = COL.white) {
    const { w, h, d } = this; const m = mat(color);
    this.shell(box(w - 0.15, h, this.zt, m, 0, 0, this.zt / 2));
    this.shell(box(w - 0.15, h - 3.6, d - this.zt, m.clone(), 0, 0, (d + this.zt) / 2));
    this.add(box(w * 0.5, 1.2, 0.6, mat(COL.steel), 0, 0, -0.1)); // защёлка на DIN-рейку
    return this;
  }
  plain(color, depth = this.d) { this.zt = depth; this.shell(box(this.w - 0.15, this.h, depth, mat(color), 0, 0, depth / 2)); return this; }
  terms(zLab = this.d + 0.03) {
    for (const t of this.def.terms) {
      const s = cyl(0.55, 0.7, MET.brass, t.x, t.y, this.zt + 0.3); s.userData.term = t.n;
      s.add(box(0.8, 0.14, 0.1, mat(COL.dark), 0, 0, 0.36));
      this.g.add(s);
      if (COARSE) { const hit = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 6), HITMAT); hit.position.copy(s.position); hit.userData.term = t.n; this.g.add(hit); }   // на сенсорном экране — увеличенная область попадания по клемме
      const l = plate(t.n, t.n.length > 2 ? 1.5 : 1.1, 0.62, t.x, t.y - t.s * 1.15, zLab, { fg: '#222', font: 'bold 44px Arial' }); this.g.add(l);
    }
    return this;
  }
  label(y = 0, z = this.d + 0.03, extra = '') {
    const p = plate(this.c.label + (extra ? ' ' + extra : ''), Math.min(this.w - 0.6, 5.5), 1.1, 0, y, z, { fg: '#0a2a66', font: 'bold 38px Arial' }); this.g.add(p); return this;
  }
}
