// Проверка лабораторных: для каждого варианта собранная схема даёт измерения, из которых получаются «истинные» ответы
// node test/labs.test.mjs
import { simulate, cabs } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';
import '../js/defs2.js';
import { LABS } from '../js/labs.js';

let wn = 0, fails = 0;
const pw = s => { const [a, b, mm, len] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, len: +len || 2, n: wn++ }; };
const mk = l => l.map(([id, type, x, y, p, st]) => { const c = newComp(type, id, x, y, p); if (st) Object.assign(c.state, st); return c; });
const close = (x, t, tol) => Math.abs(x - t) <= Math.abs(t) * tol;
for (const L of LABS) {
  let bad = 0, burns = 0;
  for (let v = 1; v <= 12; v++) {
    const d = L.make(v), c = { comps: mk(d.comps), wires: (d.sol || d.wires).map(pw) }, h = { circuit: c, c: id => c.comps.find(x => x.id === id) };
    const run = (s = 1) => { for (let i = 0; i < s * 20; i++) simulate(c, DEFS, 0.05, (k, m, f) => { if (f === 'burn') burns++; }); };
    const rec = () => { run(); const r = {}; for (const col of L.cols) if (col.get) r[col.k] = col.get(h, d); const e = L.rowCheck(r); if (e) { console.log('   ', L.id, 'v' + v, 'rowCheck:', e); bad++; } return r; };
    const rows = [], ans = {};
    if (L.id === 'l1') { for (const U of [5, 12, 24, 36]) { h.c('g1').p.U = U; rows.push(rec()); } ans.R = rows[2].U / rows[2].I; }
    if (L.id === 'l2') { rows.push(rec()); h.c('sa1').state.on = true; for (const R of [100, 47, 22, 10]) { h.c('r1').p.R = R; rows.push(rec()); } ans.E = rows[0].U; ans.r = (rows[0].U - rows[4].U) / rows[4].I; }
    if (L.id === 'l3') { rows.push(rec()); ans.Req = d.Req; ans.Ip = rows[0].I1; ans.P = d.E * rows[0].I1; if (!close(rows[0].I1, rows[0].I2 + rows[0].I3, 0.01)) { console.log('    Кирхгоф 1 нарушен', v); bad++; } }
    if (L.id === 'l4') { rows.push(rec()); ans.Ia = rows[0].Ua / d.Ra; ans.IN = rows[0].IN; h.c('sa1').state.on = false; rows.push(rec()); if (close(rows[1].Ua, rows[1].Uc, 0.02) && d.Ra !== d.Rc) { console.log('    нет перекоса при обрыве нуля', v); bad++; } }
    if (L.id === 'l5') { for (const S of [1.5, 2.5, 4, 6, 10]) { c.wires.filter(w => w.len >= d.L).forEach(w => w.mm2 = S); rows.push(rec()); } ans.dU = rows[0].U1 - rows[0].U; ans.S = rows.find(r => (r.U1 - r.U) / 230 <= 0.05).S; }
    if (new Set(rows.map(L.rowKey)).size !== rows.length) { console.log('    совпадающие ключи строк', L.id, v); bad++; }
    for (const a of L.answers) { const t = a.truth(d, rows); if (!close(ans[a.k], t, a.tol)) { console.log(`    ${L.id} v${v} ${a.k}: по измерениям ${ans[a.k].toFixed(3)}, «истина» ${t.toFixed(3)}`); bad++; } }
  }
  console.log((bad || burns ? 'FAIL ' : 'OK   ') + L.id + ' — 12 вариантов' + (burns ? `, сгорело: ${burns}` : '')); if (bad || burns) fails++;
}
console.log(fails ? `\n${fails} FAILED` : '\nВсе лабораторные согласованы'); process.exit(fails ? 1 : 0);
