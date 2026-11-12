// Проверка проходимости уровней: node test/levels.test.mjs
import { simulate, cabs, IZ } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';
import { LEVELS } from '../js/levels.js';

let wn = 0, fails = 0;
const pw = s => { const [a, b, mm] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, len: 2, n: wn++ }; };
const mk = l => (l || []).map(([id, type, x, y, p]) => newComp(type, id, x, y, p));
function G(L) {
  const g = { circuit: { comps: mk(L.comps), wires: (L.wires || []).map(pw) }, flags: new Set(), log: [] };
  g.h = {
    get circuit() { return g.circuit; }, flags: g.flags, IZ, c: id => g.circuit.comps.find(c => c.id === id), all: t => g.circuit.comps.filter(c => c.type === t),
    v(c, t) { const n = g.circuit.net; return cabs(n.v(n.node(c.id + '.' + t))); }, wired: (c, t) => g.circuit.wires.some(w => (w.a.c === c.id && w.a.t === t) || (w.b.c === c.id && w.b.t === t)),
    grounded(c, t) { const n = g.circuit.net; return n.grounded(n.node(c.id + '.' + t)); }
  };
  g.run = (sec = 1) => { for (let i = 0; i < sec * 20; i++) simulate(g.circuit, DEFS, 0.05, (k, m, f) => { g.log.push(m); if (f) g.flags.add(f); }); };
  g.sol = () => { const s = L.sol; if (Array.isArray(s)) g.circuit.wires = s.map(pw); else { if (s.comps) g.circuit.comps.push(...mk(s.comps)); if (s.drop) g.circuit.wires.splice(-s.drop); if (s.wires) { const w = s.wires.map(pw); if (s.drop) g.circuit.wires.push(...w); else g.circuit.wires = w; } if (s.patch) s.patch(g.h); } };
  // цель должна держаться 6 тактов подряд в течение sec секунд
  g.goal = (i, sec = 12) => { let hold = 0; for (let k = 0; k < sec * 20; k++) { g.run(0.05); let ok = false; try { ok = !!L.goals[i].ok(g.h); } catch (e) { ok = false; } hold = ok ? hold + 1 : 0; if (hold >= 6) { console.log(`OK   ${L.id} цель ${i + 1}`); return true; } } console.log(`FAIL ${L.id} цель ${i + 1}`, g.log.slice(-3).join(' | ')); fails++; return false; };
  g.wire = s => g.circuit.wires.push(pw(s)); g.unwire = s => { const w = pw(s); g.circuit.wires = g.circuit.wires.filter(x => !(x.a.c === w.a.c && x.a.t === w.a.t && x.b.c === w.b.c && x.b.t === w.b.t)); };
  g.press = (id, sec = 0.6) => { g.h.c(id).state.pressed = true; g.run(sec); g.h.c(id).state.pressed = false; g.run(0.3); };
  return g;
}
const L = id => LEVELS.find(l => l.id === id);
// все ссылки на клеммы в схемах должны существовать
for (const lv of LEVELS) {
  const g = G(lv); const chk = () => { for (const w of g.circuit.wires) for (const e of [w.a, w.b]) { const c = g.h.c(e.c); if (!c || !DEFS[c.type].terms.some(t => t.n === e.t)) { console.log('FAIL', lv.id, 'нет клеммы', e.c + '.' + e.t); fails++; } } };
  chk(); g.sol(); chk();
}
let g;
g = G(L('ohm')); g.sol(); g.goal(0); g.h.c('r1').p.R = 10; g.goal(1); g.h.c('g1').p.U = 24; g.goal(2);
g = G(L('k1')); g.sol(); g.goal(0); g.circuit.comps.push(newComp('el', 'el3', 0, 0, { Un: 12, Pn: 5 })); g.wire('pa1.2 el3.1'); g.wire('el3.2 g1.-'); g.goal(1);
g = G(L('k2')); g.sol(); g.goal(0); g.h.c('r1').p.R = 220; g.goal(1);
g = G(L('light')); g.sol(); g.h.c('sa1').state.on = true; g.goal(0); g.h.c('sa1').state.on = false; g.goal(1);
g = G(L('over')); g.h.c('sa1').state.on = true; g.goal(0, 20); g.sol(); g.goal(1, 30); g.wire('qf1.2 g1.N'); g.goal(2); console.log('     сгоревших проводов после КЗ:', g.circuit.wires.filter(w => w.burned).length);
g = G(L('rcd')); g.h.c('h1').state.touch = true; g.goal(0); g.sol(); g.h.c('h1').state.touch = false; g.goal(1); g.h.c('h1').state.touch = true; g.goal(2);
g = G(L('tv')); g.sol(); g.goal(0); g.goal(1); g.h.c('vd1').p.C = 'есть'; g.goal(2);
g = G(L('meas')); g.sol(); g.goal(0); g.goal(1); g.unwire('qf1.2 eh1.1'); g.unwire('p1.COM eh1.2'); g.wire('qf1.2 p1.COM'); g.h.c('p1').p.mode = 'A'; g.goal(2);
g = G(L('ph3')); g.sol(); g.goal(0); g.unwire('pv1.2 g1.N'); g.wire('pv1.2 g1.L2'); g.goal(1); g.h.c('qs1').state.on = true; g.goal(2);
g.unwire('qf1.2 m1.U'); g.unwire('qf1.4 m1.V'); g.wire('qf1.2 m1.V'); g.wire('qf1.4 m1.U'); g.goal(3); console.log('     события:', g.log.join(' | ') || 'нет');
g = G(L('km')); g.sol(); g.h.c('sb2').state.pressed = true; g.goal(0); g.h.c('sb2').state.pressed = false; g.goal(1); g.h.c('sb1').state.pressed = true; g.run(0.5); g.h.c('sb1').state.pressed = false; g.goal(2);
g = G(L('rev')); g.press('sb2'); g.goal(0); g.press('sb1'); g.run(3); g.press('sb3'); g.goal(1); g.press('sb2'); g.goal(2);
g.sol(); g.h.c('qf1').state.on = true; g.h.c('qf1').state.trip = null; g.run(1); g.press('sb2'); g.run(3); g.h.c('sb3').state.pressed = true; g.goal(3); console.log('     события:', g.log.join(' | '));
g = G(L('tp')); g.sol(); g.goal(0); g.goal(1); g.goal(2); console.log('     события:', g.log.join(' | ') || 'нет');
console.log(fails ? `\n${fails} FAILED` : '\nВсе уровни проходимы'); process.exit(fails ? 1 : 0);
