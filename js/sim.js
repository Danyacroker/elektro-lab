// Расчётное ядро: комплексный метод узловых потенциалов (действующие значения, фазоры).
// Постоянный ток — частный случай (фаза 0). Узел 0 — «земля».
export const cabs = c => Math.hypot(c[0], c[1]);
export const cang = c => Math.atan2(c[1], c[0]) * 180 / Math.PI;

export class Net {
  constructor() { this.n = 1; this.names = new Map(); this.els = []; this.extra = 0; this.par = [0]; }
  node(key) {
    let k = this.names.get(key);
    if (k === undefined) { k = this.n++; this.names.set(key, k); this.par.push(k); }
    return k;
  }
  newNode() { this.par.push(this.n); return this.n++; }
  _f(a) { while (this.par[a] !== a) a = this.par[a] = this.par[this.par[a]]; return a; }
  grounded(a) { return this._f(a) === this._f(0); }
  same(a, b) { return this._f(a) === this._f(b); }
  R(a, b, r, x = 0) {
    const d = r * r + x * x || 1e-18;
    const el = { k: 'R', a, b, gr: r / d, gi: -x / d, i: [0, 0] };
    if (Math.hypot(r, x) < 1) this.par[this._f(a)] = this._f(b);
    this.els.push(el); return el;
  }
  V(a, b, er, ei = 0, rs = 0) { const el = { k: 'V', a, b, er, ei, rs, j: this.extra++, i: [0, 0] }; this.els.push(el); return el; }
  X(p1, p2, s1, s2, n) { const el = { k: 'X', p1, p2, s1, s2, n, j: this.extra++, i: [0, 0] }; this.els.push(el); return el; }
  I(a, b, ir, ii = 0) { const el = { k: 'I', a, b, ir, ii, i: [ir, ii] }; this.els.push(el); return el; }

  solve() {
    const nn = this.n - 1, N = nn + this.extra;
    const Ar = [], Ai = [];
    for (let i = 0; i < N; i++) { Ar.push(new Float64Array(N + 1)); Ai.push(new Float64Array(N + 1)); }
    for (let i = 0; i < nn; i++) Ar[i][i] = 1e-9;
    const add = (r, c, re, im) => { if (r > 0 && c > 0) { Ar[r - 1][c - 1] += re; Ai[r - 1][c - 1] += im; } };
    const addx = (r, j, re) => { if (r > 0) { Ar[r - 1][nn + j] += re; } };   // узел-строка, доп. столбец
    const addr = (j, c, re) => { if (c > 0) { Ar[nn + j][c - 1] += re; } };   // доп. строка, узел-столбец
    for (const e of this.els) {
      if (e.k === 'R') {
        add(e.a, e.a, e.gr, e.gi); add(e.b, e.b, e.gr, e.gi); add(e.a, e.b, -e.gr, -e.gi); add(e.b, e.a, -e.gr, -e.gi);
      } else if (e.k === 'V') {
        addx(e.a, e.j, -1); addx(e.b, e.j, 1); addr(e.j, e.a, 1); addr(e.j, e.b, -1);
        Ar[nn + e.j][nn + e.j] += e.rs; Ar[nn + e.j][N] += e.er; Ai[nn + e.j][N] += e.ei;
      } else if (e.k === 'X') {
        addx(e.p1, e.j, 1); addx(e.p2, e.j, -1); addx(e.s1, e.j, -e.n); addx(e.s2, e.j, e.n);
        addr(e.j, e.p1, 1); addr(e.j, e.p2, -1); addr(e.j, e.s1, -e.n); addr(e.j, e.s2, e.n);
        Ar[nn + e.j][nn + e.j] += 1e-6;
      } else if (e.k === 'I') {
        if (e.a > 0) { Ar[e.a - 1][N] -= e.ir; Ai[e.a - 1][N] -= e.ii; }
        if (e.b > 0) { Ar[e.b - 1][N] += e.ir; Ai[e.b - 1][N] += e.ii; }
      }
    }
    // Гаусс с выбором главного элемента
    for (let c = 0; c < N; c++) {
      let p = c, best = 0;
      for (let r = c; r < N; r++) { const m = Math.abs(Ar[r][c]) + Math.abs(Ai[r][c]); if (m > best) { best = m; p = r; } }
      if (best < 1e-15) continue;
      if (p !== c) { [Ar[p], Ar[c]] = [Ar[c], Ar[p]];[Ai[p], Ai[c]] = [Ai[c], Ai[p]]; }
      const pr = Ar[c][c], pi = Ai[c][c], pd = pr * pr + pi * pi;
      const rc = Ar[c], ic = Ai[c];
      for (let r = c + 1; r < N; r++) {
        const xr = Ar[r][c], xi = Ai[r][c];
        if (xr === 0 && xi === 0) continue;
        const fr = (xr * pr + xi * pi) / pd, fi = (xi * pr - xr * pi) / pd;
        const rr = Ar[r], ri = Ai[r];
        for (let k = c; k <= N; k++) { rr[k] -= fr * rc[k] - fi * ic[k]; ri[k] -= fr * ic[k] + fi * rc[k]; }
      }
    }
    const xr = new Float64Array(N), xi = new Float64Array(N);
    for (let r = N - 1; r >= 0; r--) {
      let sr = Ar[r][N], si = Ai[r][N];
      for (let k = r + 1; k < N; k++) { sr -= Ar[r][k] * xr[k] - Ai[r][k] * xi[k]; si -= Ar[r][k] * xi[k] + Ai[r][k] * xr[k]; }
      const pr = Ar[r][r], pi = Ai[r][r], pd = pr * pr + pi * pi;
      if (pd < 1e-30) { xr[r] = xi[r] = 0; continue; }
      xr[r] = (sr * pr + si * pi) / pd; xi[r] = (si * pr - sr * pi) / pd;
    }
    this.xr = xr; this.xi = xi; this.nn = nn;
    for (const e of this.els) {
      if (e.k === 'R') { const a = this.v(e.a), b = this.v(e.b), dr = a[0] - b[0], di = a[1] - b[1]; e.i = [dr * e.gr - di * e.gi, dr * e.gi + di * e.gr]; }
      else if (e.k === 'V' || e.k === 'X') e.i = [xr[nn + e.j], xi[nn + e.j]];
    }
  }
  v(k) { return k > 0 ? [this.xr[k - 1], this.xi[k - 1]] : [0, 0]; }
  u(a, b) { const x = this.v(a), y = this.v(b); return [x[0] - y[0], x[1] - y[1]]; }
}

// Допустимый длительный ток медного провода, А
export const IZ = { 0.75: 10, 1.5: 19, 2.5: 27, 4: 38, 6: 50, 10: 70, 16: 90, 35: 140 };
export const MM2 = [0.75, 1.5, 2.5, 4, 6, 10, 16, 35];

// Один шаг моделирования всей схемы
export function simulate(circuit, DEFS, dt, emit) {
  const net = new Net();
  const byId = new Map(circuit.comps.map(c => [c.id, c]));
  const tn = (id, t) => net.node(id + '.' + t);
  for (const c of circuit.comps) for (const t of DEFS[c.type].terms) tn(c.id, t.n);
  for (const w of circuit.wires) {
    if (!byId.has(w.a.c) || !byId.has(w.b.c)) continue;
    w._na = tn(w.a.c, w.a.t); w._nb = tn(w.b.c, w.b.t);
    w._el = w.burned ? null : net.R(w._na, w._nb, Math.max(0.0175 * (w.len || 2) / (w.mm2 || 2.5), 1e-4));
  }
  // острова: переменный или постоянный ток (для анимации)
  const par = new Map(); const f = k => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
  const un = (a, b) => { par.set(f(a), f(b)); };
  for (const c of circuit.comps) for (const t of DEFS[c.type].terms) par.set(c.id + '.' + t.n, c.id + '.' + t.n);
  const kinds = [];
  for (const c of circuit.comps) {
    const d = DEFS[c.type];
    const gs = d.groups ? d.groups(c) : [{ t: d.terms.map(t => t.n), src: d.src }];
    for (const g of gs) { for (const t of g.t) un(c.id + '.' + g.t[0], c.id + '.' + t); if (g.src) kinds.push([c.id + '.' + g.t[0], g.src, g.shape]); }
  }
  for (const w of circuit.wires) if (par.has(w.a.c + '.' + w.a.t) && par.has(w.b.c + '.' + w.b.t)) un(w.a.c + '.' + w.a.t, w.b.c + '.' + w.b.t);
  const isl = new Map();
  const shp = new Map();   // форма напряжения в «острове» — для осциллографа
  for (const [k, s, sh] of kinds) { const r = f(k); if (s === 'ac' || !isl.has(r)) isl.set(r, s); if (s === 'ac') shp.set(r, 'sine'); else if (!shp.has(r)) shp.set(r, sh || 'flat'); }
  for (const c of circuit.comps) { const r = f(c.id + '.' + DEFS[c.type].terms[0].n); c._kind = isl.get(r) || null; c._shape = shp.get(r) || null; }
  for (const c of circuit.comps) DEFS[c.type].stamp(c, net, t => tn(c.id, t));
  net.solve();
  circuit.net = net;
  for (const c of circuit.comps) { const d = DEFS[c.type]; if (d.step) d.step(c, net, dt, emit, t => tn(c.id, t)); }
  for (const w of circuit.wires) {
    if (!w._el && !w.burned) continue;
    const va = net.v(w._na);
    w.va = va; w.kind = isl.get(f(w.a.c + '.' + w.a.t)) || null; w.gnd = net.grounded(w._na);
    if (w.burned) { w.i = 0; w.ire = 0; continue; }
    w.i = cabs(w._el.i); w.ire = w._el.i[0];
    // направление потока активной мощности (для анимации): знак Re(U·I*)
    w.pdir = Math.sign(va[0] * w._el.i[0] + va[1] * w._el.i[1]) || 1;
    const iz = IZ[w.mm2 || 2.5] || 27, k = w.i / iz;
    w.heat = Math.max(0, (w.heat || 0) + (k > 1 ? Math.min(dt * (k * k - 1) / 6, 0.34) : -dt * 0.15));
    if (w.heat >= 1) { w.burned = true; w.heat = 0; emit('bad', `🔥 Провод ${w.mm2 || 2.5} мм² сгорел: ток ${fmt(w.i)}А при допустимом ${iz} А. Защита не сработала!`, 'burn'); }
  }
  return net;
}

export function fmt(x, d = 3) {
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toPrecision(d) + ' М';
  if (a >= 1e3) return (x / 1e3).toPrecision(d) + ' к';
  if (a >= 1) return (+x.toPrecision(d)) + ' ';
  if (a >= 1e-3) return (+(x * 1e3).toPrecision(d)) + ' м';
  if (a >= 1e-6) return (+(x * 1e6).toPrecision(d)) + ' мк';
  return '0 ';
}

// Цвет провода по потенциалу: так видно, где фаза, где ноль, а где провод «мёртвый»
export function wireColor(w) {
  if (w.burned) return '#111111';
  const v = w.va || [0, 0], mag = cabs(v);
  if (!w.kind) return '#8a8f96';
  if (w.kind === 'dc') return mag < 0.5 ? (w.i > 1e-4 ? '#2a6fd6' : '#8a8f96') : v[0] > 0 ? '#d03030' : '#2a6fd6';
  if (mag < 3) return w.a.t === 'PE' || w.b.t === 'PE' ? '#9acd32' : w.gnd ? '#2a6fd6' : (w.i > 1e-4 ? '#2a6fd6' : '#8a8f96');
  const a = cang(v), near = x => Math.abs(((a - x + 540) % 360) - 180) < 25;
  return near(0) ? '#f2c400' : near(-120) ? '#2faa4a' : near(120) ? '#d03030' : '#ff8a3c';
}
