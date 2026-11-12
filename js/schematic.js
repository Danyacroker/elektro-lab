// Принципиальная схема (SVG), строится автоматически по той же сборке, что и 3D
import { DEFS, termPos } from './defs.js';
import { wireColor, fmt } from './sim.js';

export const ln = (x1, y1, x2, y2, e = '') => `<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" ${e}/>`;
export const tx = (x, y, s, size = 1.5, anchor = 'middle', e = '') => `<text x="${x}" y="${-y}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="central" stroke="none" fill="#222" ${e}>${s}</text>`;
export const rc = (x, y, w, h, e = 'fill="#fffdf5"') => `<rect x="${x - w / 2}" y="${-y - h / 2}" width="${w}" height="${h}" ${e}/>`;
export const ci = (x, y, r, e = 'fill="#fffdf5"') => `<circle cx="${x}" cy="${-y}" r="${r}" ${e}/>`;
export const DASH = 'stroke-dasharray="0.6 0.4" stroke-width="0.15"';
export const T = (d, n) => d.terms.find(t => t.n === n);

function contact(x, yt, yb, closed, kind) {
  let s = ln(x, yt, x, 1.6) + ln(x, -1.6, x, yb);
  if (kind === 'nc') s += ln(x, 1.6, x + 1, 1.6) + (closed ? ln(x, -1.6, x + 0.9, 1.9) : ln(x, -1.6, x - 1.7, 1.3));
  else s += closed ? ln(x, -1.6, x, 1.6) : ln(x, -1.6, x - 1.7, 1.3);
  if (kind === 'qf') s += ln(x - 0.45, 2.05, x + 0.45, 1.15) + ln(x - 0.45, 1.15, x + 0.45, 2.05);
  if (kind === 'qs') s += ln(x - 0.7, 1.6, x + 0.7, 1.6);
  if (kind === 'km') s += `<path d="M ${x} ${-1.6} a 0.45 0.45 0 0 1 0 -0.9" fill="none"/>`;
  return s;
}
const link = (xs, closed) => ln(xs[0] - (closed ? 0 : 0.85), 0, xs[xs.length - 1] - (closed ? 0 : 0.85), 0, DASH);
function poles(d, closed, kind) {
  const ups = d.terms.filter(t => t.s > 0), dn = d.terms.filter(t => t.s < 0);
  return ups.map((t, i) => contact(t.x, t.y, dn[i].y, closed, kind)).join('') + (ups.length > 1 ? link(ups.map(t => t.x), closed) : '');
}
export function boxSym(d, title, sub = '') {
  const hh = d.h / 2 - 1.9; let s = rc(0, 0, d.w - 1, hh * 2);
  for (const t of d.terms) s += ln(t.x, t.y, t.x, t.s * hh);
  return s + tx(0, sub ? 0.9 : 0, title, 1.7, 'middle', 'font-weight="bold"') + (sub ? tx(0, -1.1, sub, 1.4) : '');
}
const coilBox = (x, d, on) => ln(x, T(d, 'A1').y, x, 1.5) + ln(x, -1.5, x, T(d, 'A2').y) + rc(x, 0, 2.6, 3, `fill="${on ? '#ffb347' : '#fffdf5'}"`);

export const SYM = {
  qf1: (c, d) => poles(d, c.state.on, 'qf') + rc(0, -2.7, 1, 0.9) + tx(-1.4, -2.7, c.p.curve + c.p.In, 1.1, 'end'),
  qf3: (c, d) => poles(d, c.state.on, 'qf') + [-3, 0, 3].map(x => rc(x, -2.7, 1, 0.9)).join('') + tx(-4.2, -2.7, c.p.curve + c.p.In, 1.1, 'end'),
  rcd2: (c, d) => poles(d, c.state.on, 'qs') + `<ellipse cx="0" cy="2.7" rx="${d.w / 2 - 0.6}" ry="0.7" fill="none" stroke="${c.state.trip ? '#d03030' : '#222'}"/>` + tx(d.w / 2, -2.7, 'IΔ', 1.2, 'start'),
  fu: (c, d) => ln(0, T(d, '1').y, 0, c.state.blown ? 1 : -3.6) + ln(0, -1, 0, T(d, '2').y) + rc(0, 0, 1.5, 3.8, 'fill="none"') + (c.state.blown ? tx(0, 0, '✕', 2, 'middle', 'fill="#d03030"') : ''),
  qs3: (c, d) => poles(d, c.state.on, 'qs'),
  sa: (c, d) => poles(d, c.state.on, ''),
  sb_no: (c, d) => poles(d, c.state.pressed, '') + ln(-3, 0, -1, 0, DASH) + ln(-3, -0.8, -3, 0.8),
  sb_nc: (c, d) => poles(d, !c.state.pressed, 'nc') + ln(-3, 0, -0.6, 0, DASH) + ln(-3, -0.8, -3, 0.8),
  km(c, d) {
    const on = c.state.on, y = T(d, '1').y;
    return coilBox(-7.5, d, c.state.uc > c.p.Uc * 0.5) + [-4.5, -1.5, 1.5].map(x => contact(x, y, -y, on, 'km')).join('') + contact(4.5, y, -y, on, '') + contact(7.5, y, -y, !on, 'nc')
      + ln(-6.2, 0, 7.5 - (on ? 0.85 : 0), 0, DASH);
  },
  kl(c, d) {
    const on = c.state.on, yb = T(d, '12').y;
    return coilBox(-3, d, c.state.uc > c.p.Uc * 0.5) + ln(1.5, T(d, '11').y, 1.5, 1) + ln(1.5, 1, on ? 3 : 0, -1.6) + ln(0, -1.6, 0, yb) + ln(3, -1.6, 3, yb) + ln(-1.7, 0, 1, 0, DASH);
  },
  tv(c, d) {
    const w = (y, f) => `<path d="M -3 ${-y} ${[0, 1, 2, 3].map(() => `a 0.75 0.75 0 0 ${f} 1.5 0`).join(' ')}" fill="none"/>`;
    return ln(-3, T(d, '1').y, -3, 1.7) + ln(3, T(d, '2').y, 3, 1.7) + ln(-3, T(d, '3').y, -3, -1.7) + ln(3, T(d, '4').y, 3, -1.7) + w(1.7, 0) + w(-1.7, 1)
      + ln(-3.2, 0.25, 3.2, 0.25, 'stroke-width="0.35"') + ln(-3.2, -0.25, 3.2, -0.25, 'stroke-width="0.35"') + tx(4.2, 1.9, c.p.U1 + 'В', 1.1, 'start') + tx(4.2, -1.9, c.p.U2 + 'В', 1.1, 'start') + (c.state.burned ? tx(0, 0, '✕', 3, 'middle', 'fill="#d03030"') : '');
  },
  tv3(c, d) {
    let s = ''; for (const t of d.terms) s += ln(t.x, t.y, t.x, t.s * 3) + (Math.abs(t.x) > 2.5 ? ln(t.x, t.s * 3, Math.sign(t.x) * 2.2, t.s * 3) : '');
    return s + ci(0, 1.7, 3.2) + ci(0, -1.7, 3.2, 'fill="none"') + tx(0, 2.4, 'Δ', 2) + tx(0, -2.4, 'Y', 2) + tx(4, 0, c.p.U1 + '/0,4 кВ', 1.2, 'start');
  },
  vd: (c, d) => boxSym(d, '', '') + `<path d="M -1.2 -1 L 1.2 -1 L 0 1 Z M -1.2 1 L 1.2 1" fill="${c.state.idc > 0.001 ? '#ffb347' : 'none'}"/>` + tx(0, 2, '~', 1.4) + tx(0, -2.1, '=', 1.4),
  el(c, d) {
    const b = c.state.burned ? 0 : Math.min(1, c.state.bright), y = T(d, '1').y, k = 1 - Math.sqrt(4 - 2.25);
    return ln(-1.5, y, -1.5, k) + ln(1.5, y, 1.5, k) + ci(0, 1, 2, `fill="rgba(255,205,40,${b.toFixed(2)})"`) + ln(-1.4, 2.4, 1.4, -0.4) + ln(-1.4, -0.4, 1.4, 2.4) + (c.state.burned ? tx(3, 1, 'сгорела', 1.1, 'start', 'fill="#d03030"') : '');
  },
  r: (c, d) => ln(0, T(d, '1').y, 0, 2) + ln(0, -2, 0, T(d, '2').y) + rc(0, 0, 1.8, 4, `fill="rgba(255,90,20,${Math.min(0.8, c.state.bright).toFixed(2)})"`) + tx(1.4, 0, c.secret ? 'R = ?' : fmt(c.p.R) + 'Ом', 1.1, 'start'),
  eh: (c, d) => ln(0, T(d, '1').y, 0, 2) + ln(0, -2, 0, T(d, '2').y) + rc(0, 0, 1.8, 4, `fill="rgba(255,90,20,${Math.min(0.8, c.state.bright).toFixed(2)})"`) + [1, 0, -1].map(y => ln(-0.9, y - 0.4, 0.9, y + 0.4, 'stroke-width="0.15"')).join('') + tx(1.4, 0, c.p.Pn / 1000 + ' кВт', 1.1, 'start'),
  m3(c, d) {
    const s = c.state, cy = -1.5, y = T(d, 'U').y; let o = '';
    for (const n of ['U', 'V', 'W']) { const x = T(d, n).x; o += ln(x, y, x, cy + Math.sqrt(25 - x * x)); }
    return o + ln(6, y, 6, cy, DASH) + ln(6, cy, 5, cy, DASH) + ci(0, cy, 5,`fill="${s.burned ? '#555' : s.stall ? '#ffb0a0' : '#fffdf5'}"`) + tx(0, cy + 0.9, 'M', 2.6, 'middle', 'font-weight="bold"') + tx(0, cy - 1.4, '3~', 1.5)
      + tx(0, cy - 6.2, s.burned ? 'СГОРЕЛ' : s.stall ? 'гудит, не вращается!' : Math.abs(s.speed) > 0.05 ? (s.speed > 0 ? '↻ ' : '↺ ') + Math.round(Math.abs(s.speed) * 1450) + ' об/мин' : 'стоит', 1.3, 'middle', s.stall || s.burned ? 'fill="#d03030"' : '');
  },
  pa: (c, d) => ln(0, T(d, '1').y, 0, 2) + ln(0, -2, 0, T(d, '2').y) + ci(0, 0, 2) + tx(0, 0, 'A', 2, 'middle', 'font-weight="bold"') + tx(2.5, 0, d.disp(c), 1.4, 'start', 'fill="#06c"'),
  pv: (c, d) => ln(0, T(d, '1').y, 0, 2) + ln(0, -2, 0, T(d, '2').y) + ci(0, 0, 2) + tx(0, 0, 'V', 2, 'middle', 'font-weight="bold"') + tx(2.5, 0, d.disp(c), 1.4, 'start', 'fill="#06c"'),
  pe: (c, d) => ln(0, T(d, '1').y, 0, -0.5) + ln(-1.6, -0.5, 1.6, -0.5) + ln(-1, -1.1, 1, -1.1) + ln(-0.4, -1.7, 0.4, -1.7),
  mm: (c, d) => boxSym(d, c.p.mode === 'V' ? 'V' : 'A', d.disp(c)),
  pi: (c, d) => boxSym(d, 'Wh', d.disp(c)),
  hum: (c, d) => boxSym(d, '🧍', c.state.touch ? (c.state.i > 0.005 ? fmt(c.state.i) + 'А!' : 'касается') : 'не касается'),
  srcdc: (c, d) => boxSym(d, c.secret ? '= ? В' : '= ' + c.p.U + ' В'), src1: (c, d) => boxSym(d, '~ 230 В'), src3: (c, d) => boxSym(d, '3~ 400/230 В'), src10: (c, d) => boxSym(d, '3~ ' + c.p.U + ' кВ'),
};
SYM.rcd4 = SYM.rcd2;
const LENS = { 'зелёная': '40,200,80', 'красная': '235,40,40', 'жёлтая': '255,200,0' };
Object.assign(SYM, {
  hl: (c, d) => ln(0, T(d, 'X1').y, 0, 1.5) + ln(0, -1.5, 0, T(d, 'X2').y) + ci(0, 0, 1.5, `fill="rgba(${LENS[c.p.color]},${(0.15 + 0.85 * Math.min(1, c.state.bright)).toFixed(2)})"`) + ln(-1.05, 1.05, 1.05, -1.05) + ln(-1.05, -1.05, 1.05, 1.05),
  sa2(c, d) { const yb = T(d, '1').y; return ln(0, T(d, 'L').y, 0, 1.2) + ln(0, 1.2, c.state.pos ? 1.5 : -1.5, -1.6) + ln(-1.5, -1.6, -1.5, yb) + ln(1.5, -1.6, 1.5, yb); },
  qfd: (c, d) => poles(d, c.state.on, 'qf') + `<ellipse cx="0" cy="2.7" rx="2.4" ry="0.7" fill="none" stroke="${c.state.trip === 'd' ? '#d03030' : '#222'}"/>` + tx(3.2, -2.7, 'IΔ', 1.2, 'start') + tx(-2.6, 0, 'C' + c.p.In, 1.1, 'end'),
  kk(c, d) {
    const y = T(d, '1').y, tr = c.state.trip, h = Math.min(0.9, c.state.heat);
    return [-6, -3, 0].map(x => ln(x, y, x, -y) + rc(x, 0, 1.4, 1.8, `fill="rgba(255,80,20,${h.toFixed(2)})"`) + `<path d="M ${x - 0.35} 0.5 h 0.35 v -1 h 0.35" fill="none" stroke-width="0.15"/>`).join('')
      + contact(3, y, -y, !tr, 'nc') + contact(6, y, -y, tr, '') + ln(0.7, 0, 6 - (tr ? 0 : 0.85), 0, DASH) + tx(-7.2, 0, c.p.Iset + 'А', 1.1, 'end') + (tr ? tx(4.5, -3.2, 'сработало', 1.1, 'middle', 'fill="#d03030"') : '');
  },
  kt(c, d) {
    const on = c.state.on, yb = T(d, '16').y;
    return coilBox(-3, d, c.state.uc > c.p.Uc * 0.5) + ln(-4.3, 1.5, -1.7, -1.5, 'stroke-width="0.15"') + ln(1.5, T(d, '15').y, 1.5, 1) + ln(1.5, 1, on ? 3 : 0, -1.6) + ln(0, -1.6, 0, yb) + ln(3, -1.6, 3, yb) + ln(-1.7, 0, 1, 0, DASH) + tx(4.2, 1.2, d.disp(c), 1.2, 'start', 'fill="#a60"');
  },
  m6: (c, d) => boxSym(d, 'M 3~', c.state.burned ? 'СГОРЕЛ' : c.state.conn + (Math.abs(c.state.speed) > 0.05 ? (c.state.speed > 0 ? ' ↻ ' : ' ↺ ') + Math.round(Math.abs(c.state.speed) * 1450) : c.state.stall ? ' — гудит!' : ' — стоит')),
});

// Прямоугольники, которые провода должны обходить: корпуса устройств и их подписи
export const obstacles = comps => comps.flatMap(c => {
  const d = DEFS[c.type], lw = (c.label || '').length * 1.0 + 0.8;
  return [{ x0: c.x - d.w / 2, x1: c.x + d.w / 2, y0: c.y - d.h / 2, y1: c.y + d.h / 2 }, { x0: c.x - d.w / 2 - lw, x1: c.x - d.w / 2, y0: c.y + d.h / 2 - 3.1, y1: c.y + d.h / 2 - 1.3, soft: true }];
});
const hits = (p, q, o) => Math.max(p[0], q[0]) > o.x0 + 0.15 && Math.min(p[0], q[0]) < o.x1 - 0.15 && Math.max(p[1], q[1]) > o.y0 + 0.15 && Math.min(p[1], q[1]) < o.y1 - 0.15;
// Трассировка провода под прямыми углами. Перебирает варианты пути и выбирает кратчайший из тех, что не идут через устройства.
export function route(a, b, n, obs = []) {
  const st = 1.4 + (n % 4) * 0.5, m = 1.2 + (n % 5) * 0.45, lane = ((n % 5) - 2) * 0.5, A = [a.x, a.y + a.s * st], B = [b.x, b.y + b.s * st];
  const cost = path => { let c = 0; for (let i = 0; i < path.length - 1; i++) { const p = path[i], q = path[i + 1]; c += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]); for (const o of obs) if (hits(p, q, o)) c += o.soft ? 60 : 500; } return c + path.length * 1.5; };
  const xs = [(A[0] + B[0]) / 2 + lane], ys = [(A[1] + B[1]) / 2 + lane];
  for (const o of obs) if (!o.soft) { xs.push(o.x0 - m, o.x1 + m); ys.push(o.y0 - m, o.y1 + m); }
  let best = null, bc = Infinity; const tryP = p => { const c = cost(p); if (c < bc - 1e-6) { bc = c; best = p; } };
  tryP([A, [A[0], B[1]], B]); tryP([A, [B[0], A[1]], B]);
  for (const x of xs) tryP([A, [x, A[1]], [x, B[1]], B]);
  for (const y of ys) tryP([A, [A[0], y], [B[0], y], B]);
  if (bc >= 60) for (const x of xs) for (const y of ys) { tryP([A, [x, A[1]], [x, y], [B[0], y], B]); tryP([A, [A[0], y], [x, y], [x, B[1]], B]); }   // сложный обход — только если простого нет
  const pts = [[a.x, a.y], ...best, [b.x, b.y]], out = [];
  for (const p of pts) {   // убираем совпадающие точки и точки на одной прямой
    const k = out.length; if (k && Math.abs(out[k - 1][0] - p[0]) < 0.01 && Math.abs(out[k - 1][1] - p[1]) < 0.01) continue;
    if (k > 1 && ((Math.abs(out[k - 2][0] - out[k - 1][0]) < 0.01 && Math.abs(out[k - 1][0] - p[0]) < 0.01) || (Math.abs(out[k - 2][1] - out[k - 1][1]) < 0.01 && Math.abs(out[k - 1][1] - p[1]) < 0.01))) out.pop();
    out.push(p);
  }
  return out.length > 1 ? out : pts;
}

const HITW = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 3.4 : 1.6;   // ширина области нажатия по проводу
export class Schematic {
  constructor(el, game) {
    this.el = el; this.game = game; this.vb = null;
    this.ptrs = new Map();   // активные касания: два пальца — масштаб
    el.addEventListener('pointerdown', e => { this.ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (this.ptrs.size === 2) { const [p, q] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]) || 1, v: { ...this.cur } }; this.dn = null; return; } this.down(e); });
    window.addEventListener('pointermove', e => this.move(e)); window.addEventListener('pointerup', e => this.up(e)); window.addEventListener('pointercancel', e => this.up(e));
    el.addEventListener('wheel', e => { e.preventDefault(); const v = this.cur; if (!v) return; const k = e.deltaY > 0 ? 1.15 : 0.87, r = el.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      this.vb = { x: v.x + v.w * fx * (1 - k), y: v.y + v.h * fy * (1 - k), w: v.w * k, h: v.h * k }; this.render(); }, { passive: false });
    el.addEventListener('dblclick', () => { this.vb = null; this.render(); });
  }
  unit() { const r = this.el.getBoundingClientRect(), v = this.cur; return v ? Math.max(v.w / r.width, v.h / r.height) : 1; }
  toUnits(e) { const r = this.el.getBoundingClientRect(), v = this.cur, u = Math.max(v.w / r.width, v.h / r.height); return { x: v.x + v.w / 2 + (e.clientX - r.left - r.width / 2) * u, y: -(v.y + v.h / 2 + (e.clientY - r.top - r.height / 2) * u) }; }
  down(e) {
    const g = this.game, tEl = e.target.closest('[data-t]'), cEl = e.target.closest('[data-c]'), wEl = e.target.closest('[data-w]');
    if (tEl) { const ref = { c: tEl.dataset.c, t: tEl.dataset.t }; g.termClick ? g.termClick(ref) : g.scene.clickTerm(ref); this.render(); return; }
    if (cEl) { const c = g.circuit.comps.find(c => c.id === cEl.dataset.c); if (!c) return; if (DEFS[c.type].momentary) { c.state.pressed = true; this.dn = { press: c }; } else this.dn = { c, x: e.clientX, y: e.clientY, cx: c.x, cy: c.y }; g.select(c); return; }
    if (wEl) { g.select(g.circuit.wires[+wEl.dataset.w]); return; }
    if (g.placeType && !cEl && !wEl) { const p = this.toUnits(e); g.addComp(g.placeType, Math.round(p.x / 1.5) * 1.5, Math.round(p.y)); this.render(); return; }   // поставить обозначение кликом по листу
    this.dn = { pan: true, x: e.clientX, y: e.clientY, v: { ...this.cur } }; g.scene.cancel(); g.select(null);
  }
  move(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (this.pinch && this.ptrs.size === 2) { const [p, q] = [...this.ptrs.values()], k = this.pinch.d / (Math.hypot(p[0] - q[0], p[1] - q[1]) || 1), v = this.pinch.v; this.vb = { x: v.x + v.w * (1 - k) / 2, y: v.y + v.h * (1 - k) / 2, w: v.w * k, h: v.h * k }; this.render(); return; }
    const d = this.dn; if (!d || d.press) return; const u = this.unit(), dx = (e.clientX - d.x) * u, dy = (e.clientY - d.y) * u;
    if (d.pan) { this.vb = { ...d.v, x: d.v.x - dx, y: d.v.y - dy }; this.render(); return; }
    if (d.c && !d.c.locked && (d.moved || Math.hypot(dx, dy) > 1)) { d.moved = true; d.c.x = Math.round((d.cx + dx) / 1.5) * 1.5; d.c.y = Math.round(d.cy - dy); const it = this.game.scene.items.get(d.c.id); if (it) { it.g.position.set(d.c.x, d.c.y, 0); this.game.scene.rewire(d.c.id); } this.render(); }
  }
  up(e) {
    if (e) this.ptrs.delete(e.pointerId); if (this.pinch) { if (this.ptrs.size < 2) this.pinch = null; this.dn = null; return; }
    const d = this.dn; this.dn = null; if (!d) return;
    if (d.press) { d.press.state.pressed = false; return; }
    if (d.c && !d.moved) { const df = DEFS[d.c.type]; if (df.click) { df.click(d.c, 'toggle'); this.game.changed(); } } else if (d.moved) this.game.changed();
  }
  render() {
    const g = this.game, cs = g.circuit.comps, sel = g.selected; if (!this.el.clientWidth) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of cs) { const d = DEFS[c.type]; x0 = Math.min(x0, c.x - d.w / 2 - 6); x1 = Math.max(x1, c.x + d.w / 2 + 8); y0 = Math.min(y0, -c.y - d.h / 2 - 5); y1 = Math.max(y1, -c.y + d.h / 2 + 5); }
    if (!cs.length) { x0 = -40; x1 = 40; y0 = -25; y1 = 25; }
    if (g.sheet) { x0 = Math.min(x0, -g.sheet.w / 2); x1 = Math.max(x1, g.sheet.w / 2); y0 = Math.min(y0, -g.sheet.h / 2); y1 = Math.max(y1, g.sheet.h / 2); }   // лист фиксированного размера, чтобы было куда ставить обозначения
    const v = this.cur = this.vb || { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" preserveAspectRatio="xMidYMid meet"><g stroke="#222" stroke-width="0.25" stroke-linecap="round" fill="none" font-family="Arial">`;
    const cnt = {}; const byId = new Map(cs.map(c => [c.id, c])), obs = obstacles(cs), placed = obs.map(o => ({ ...o })); let lbl = '';
    const free = (x, y, w, h) => !placed.some(o => x + w / 2 > o.x0 && x - w / 2 < o.x1 && y + h / 2 > o.y0 && y - h / 2 < o.y1);
    g.circuit.wires.forEach((w, i) => {
      const ca = byId.get(w.a.c), cb = byId.get(w.b.c); if (!ca || !cb) return;
      const a = termPos(ca, w.a.t), b = termPos(cb, w.b.t); a.cx = ca.x; a.w = DEFS[ca.type].w; b.cx = cb.x; b.w = DEFS[cb.type].w;
      const pts = route(a, b, w.n || i, obs), col = wireColor(w);
      const p = pts.map(q => q[0] + ',' + (-q[1])).join(' ');
      s += `<polyline points="${p}" stroke="${col}" stroke-width="${w === sel ? 0.7 : 0.4}" ${w.burned ? 'stroke-dasharray="0.8 0.8"' : ''}/><polyline data-w="${i}" points="${p}" stroke="transparent" stroke-width="${HITW}" style="cursor:pointer"/>`;
      for (const k of [w.a.c + '.' + w.a.t, w.b.c + '.' + w.b.t]) cnt[k] = (cnt[k] || 0) + 1;
      if (g.showVals && w.i > 1e-3) {
        const segs = pts.slice(0, -1).map((p, q) => [Math.abs(pts[q + 1][0] - p[0]) + Math.abs(pts[q + 1][1] - p[1]), q]).sort((x, y) => y[0] - x[0]), t = fmt(w.i) + 'А', lw = t.length * 0.62 + 0.8;
        for (const [len, q] of segs) { if (len < 2.5) break; let done = false;
          for (const f of [0.5, 0.3, 0.7]) { const mx = pts[q][0] + (pts[q + 1][0] - pts[q][0]) * f, my = pts[q][1] + (pts[q + 1][1] - pts[q][1]) * f; if (!free(mx, my, lw, 1.5)) continue;
            placed.push({ x0: mx - lw / 2, x1: mx + lw / 2, y0: my - 0.75, y1: my + 0.75 }); lbl += rc(mx, my, lw, 1.4, 'fill="#fffdf5" stroke="none" opacity="0.9" rx="0.3"') + tx(mx, my, t, 1.1, 'middle', 'fill="#a40"'); done = true; break; }
          if (done) break; }
      }
    });
    for (const c of cs) {
      const d = DEFS[c.type];
      s += `<g data-c="${c.id}" transform="translate(${c.x},${-c.y})" style="cursor:pointer">` + rc(0, 0, d.w, d.h, `fill="${c === sel ? 'rgba(255,210,63,0.25)' : 'transparent'}" stroke="${c === sel ? '#c90' : 'none'}" stroke-dasharray="0.5 0.5"`);
      s += (SYM[c.type] || ((c, d) => boxSym(d, d.mark)))(c, d);
      s += `<text x="${-d.w / 2 - 0.4}" y="${-(d.h / 2 - 2.2)}" font-size="1.5" text-anchor="end" dominant-baseline="central" fill="#0a2a66" font-weight="bold" stroke="#f4f1e8" stroke-width="0.5" paint-order="stroke">${c.label}</text>`;
      for (const t of d.terms) s += `<circle data-c="${c.id}" data-t="${t.n}" cx="${t.x}" cy="${-t.y}" r="${g.pendRef && g.pendRef.c === c.id && g.pendRef.t === t.n ? 0.8 : cnt[c.id + '.' + t.n] > 1 ? 0.55 : 0.4}" fill="${g.pendRef && g.pendRef.c === c.id && g.pendRef.t === t.n ? '#ffb000' : cnt[c.id + '.' + t.n] ? '#222' : '#fffdf5'}" stroke="rgba(0,0,0,0.01)" stroke-width="1.4" paint-order="stroke" style="cursor:crosshair"><title>${c.label}:${t.n}</title></circle>` + tx(t.x + 0.7, t.y + t.s * 0.2, t.n, 0.95, 'start', 'fill="#777"');
      s += '</g>';
    }
    this.el.innerHTML = s + lbl + '</g></svg>';
  }
}
