// Сравнение двух схем по соединениям (а не по расположению): одинаковый набор устройств и одинаковые узлы.
// Учитывает взаимозаменяемые выводы (лампа, полюса автомата и т.п.). Клеммы и шины считаются просто проводом.
import { DEFS } from './defs.js';
import { TRANSPARENT } from './defs4.js';

// ---------- допустимые перестановки выводов ----------
const S2 = (a, b) => [{}, { [a]: b, [b]: a }];
const all3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], cyc3 = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
const PERM = (list, rows) => list.map(p => { const m = {}; for (const r of rows) r.forEach((n, i) => m[n] = r[p[i]]); return m; });
const TOP = ['1', '3', '5'], BOT = ['2', '4', '6'], POLE3 = PERM(all3, [TOP, BOT]), FLIP3 = [{}, { 1: '2', 2: '1', 3: '4', 4: '3', 5: '6', 6: '5' }];
const two = t => [S2(DEFS[t].terms[0].n, DEFS[t].terms[1].n)];
const GROUPS = {
  qf3: [POLE3, FLIP3], qs3: [POLE3, FLIP3], km: [POLE3, FLIP3, S2('A1', 'A2'), S2('13', '14'), S2('21', '22')], kk: [POLE3, FLIP3, S2('95', '96'), S2('97', '98')],
  rcd2: [[{}, { 1: '2', 2: '1', N1: 'N2', N2: 'N1' }]], qfd: [[{}, { 1: '2', 2: '1', N1: 'N2', N2: 'N1' }]], rcd4: [[{}, { ...FLIP3[1], N1: 'N2', N2: 'N1' }]],
  tv: [S2('1', '2'), S2('3', '4')], vd: [S2('~1', '~2')], kl: [S2('A1', 'A2')], kt: [S2('A1', 'A2')], sa2: [S2('1', '2')], psu: [S2('L', 'N')], app: [S2('L', 'N')], mw: [S2('L', 'N')],
  xs: [[{}, { L: 'N', N: 'L', l: 'n', n: 'l' }]], m3: [PERM(cyc3, [['U', 'V', 'W']])], src3: [PERM(cyc3, [['L1', 'L2', 'L3']])], vd3: [PERM(all3, [['A', 'B', 'C']])],
};
for (const t of ['qf1', 'sa', 'fu', 'pa', 'pv', 'r', 'eh', 'kz', 'sb_no', 'sb_nc', 'el', 'hl', 'mm', 'osc', 'xt']) GROUPS[t] = two(t);
const cache = {};
function perms(type) {
  if (cache[type]) return cache[type]; let out = [{}];
  for (const g of GROUPS[type] || []) out = out.flatMap(a => g.map(b => { const m = {}; for (const t of DEFS[type].terms) { const x = a[t.n] || t.n; m[t.n] = b[x] || x; } return m; }));
  return cache[type] = out.map(m => { const f = {}; for (const t of DEFS[type].terms) f[t.n] = m[t.n] || t.n; return f; });
}

// ---------- узлы схемы ----------
export function netlist(circ) {
  const par = new Map(), f = k => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; }, un = (a, b) => par.set(f(a), f(b));
  for (const c of circ.comps) for (const t of DEFS[c.type].terms) par.set(c.id + '.' + t.n, c.id + '.' + t.n);
  for (const w of circ.wires) { const a = w.a.c + '.' + w.a.t, b = w.b.c + '.' + w.b.t; if (par.has(a) && par.has(b)) un(a, b); }
  for (const c of circ.comps) for (const [a, b] of TRANSPARENT[c.type] || []) un(c.id + '.' + a, c.id + '.' + b);
  const comps = circ.comps.filter(c => !TRANSPARENT[c.type]).map(c => ({ c, type: c.type, nets: Object.fromEntries(DEFS[c.type].terms.map(t => [t.n, f(c.id + '.' + t.n)])) }));
  const groups = new Map(); for (const k of comps) for (const t in k.nets) (groups.get(k.nets[t]) || groups.set(k.nets[t], []).get(k.nets[t])).push(k.c.label + ':' + t);
  return { comps, groups };
}
const count = comps => { const m = {}; for (const k of comps) m[k.type] = (m[k.type] || 0) + 1; return m; };

// Совпадают ли схемы. Возвращает { ok } или { ok:false, missing, extra } — каких устройств не хватает / лишние
export function compare(target, user) {
  const T = netlist(target), U = netlist(user), ct = count(T.comps), cu = count(U.comps), missing = [], extra = [];
  for (const t in ct) if ((cu[t] || 0) < ct[t]) missing.push(`${DEFS[t].name} × ${ct[t] - (cu[t] || 0)}`);
  for (const t in cu) if ((ct[t] || 0) < cu[t]) extra.push(`${DEFS[t].name} × ${cu[t] - (ct[t] || 0)}`);
  if (missing.length || extra.length) return { ok: false, missing, extra };
  const order = [...T.comps].sort((a, b) => ct[a.type] * perms(a.type).length - ct[b.type] * perms(b.type).length), t2u = new Map(), u2t = new Map(), used = new Set();
  const rec = i => {
    if (i === order.length) return true; const tc = order[i];
    for (const uc of U.comps) {
      if (uc.type !== tc.type || used.has(uc)) continue;
      next: for (const p of perms(tc.type)) {
        const added = [];
        for (const t in tc.nets) {
          const tn = tc.nets[t], unn = uc.nets[p[t]];
          if (t2u.has(tn) ? t2u.get(tn) !== unn : u2t.has(unn)) { for (const [a, b] of added) { t2u.delete(a); u2t.delete(b); } continue next; }
          if (!t2u.has(tn)) { t2u.set(tn, unn); u2t.set(unn, tn); added.push([tn, unn]); }
        }
        used.add(uc); if (rec(i + 1)) return true; used.delete(uc); for (const [a, b] of added) { t2u.delete(a); u2t.delete(b); }
      }
    }
    return false;
  };
  return { ok: rec(0), missing, extra };
}

// Подсказки. Если устройства в обеих схемах названы одинаково (уровень «новичок») — список соединений с отметками.
export function checklist(target, user) {
  const T = netlist(target), U = netlist(user), byLabel = new Map(U.comps.map(k => [k.c.label, k])), res = [];
  for (const [, terms] of T.groups) {
    if (terms.length < 2) continue;
    const un = terms.map(x => { const [l, t] = x.split(':'), k = byLabel.get(l); return k ? k.nets[t] : null; });
    const same = un[0] && un.every(n => n === un[0]), size = same ? (U.groups.get(un[0]) || []).length : 0;
    res.push({ text: terms.join(' — '), ok: same && size === terms.length, part: same && size > terms.length });
  }
  const tset = new Set([...T.groups.values()].filter(g => g.length > 1).map(g => [...g].sort().join('|')));
  const extra = [...U.groups.values()].filter(g => g.length > 1 && !tset.has([...g].sort().join('|'))).length;
  return { list: res, done: res.filter(r => r.ok).length, extra };
}
// Грубая сводка для среднего уровня: сколько узлов и подключённых выводов
export function summary(circ) { const n = netlist(circ); let nodes = 0, pins = 0; for (const g of n.groups.values()) if (g.length > 1) { nodes++; pins += g.length; } return { nodes, pins }; }
