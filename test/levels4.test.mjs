// Проходимость квестов «Розетки» и «Аварии»: node test/levels4.test.mjs
import { simulate, cabs, IZ } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';
import '../js/defs2.js';
import '../js/defs3.js';
import { LEVELS } from '../js/levels.js';
import '../js/levels4.js';
import { diagnose } from '../js/diag.js';

let wn = 0, fails = 0;
const pw = s => { const [a, b, mm, len] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, len: +len || 2, n: wn++ }; };
const mk = l => (l || []).map(([id, type, x, y, p, st]) => { const c = newComp(type, id, x, y, p); if (st) Object.assign(c.state, st); return c; });
function G(L) {
  const g = { circuit: { comps: mk(L.comps), wires: (L.wires || []).map(pw) }, flags: new Set(), log: [] };
  g.h = {
    get circuit() { return g.circuit; }, flags: g.flags, IZ, c: id => g.circuit.comps.find(c => c.id === id), all: t => g.circuit.comps.filter(c => c.type === t), diag: () => diagnose(g.circuit),
    v(c, t) { const n = g.circuit.net; return cabs(n.v(n.node(c.id + '.' + t))); }, wired: (c, t) => g.circuit.wires.some(w => (w.a.c === c.id && w.a.t === t) || (w.b.c === c.id && w.b.t === t)),
  };
  g.run = (sec = 1) => { for (let i = 0; i < sec * 20; i++) simulate(g.circuit, DEFS, 0.05, (k, m, f) => { g.log.push(m); if (f) g.flags.add(f); }); };
  g.sol = () => {
    const s = L.sol; let comps = [...L.comps], wires = [...(L.wires || [])];
    if (s.comps) comps = [...comps, ...s.comps]; if (s.wires) wires = s.wires; if (s.add) wires = [...wires, ...s.add];
    g.circuit.comps = mk(comps); g.circuit.wires = wires.map(pw); if (s.patch) s.patch(g.h);
  };
  g.goal = (i, sec = 15) => { let hold = 0; for (let k = 0; k < sec * 20; k++) { g.run(0.05); let ok = false; try { ok = !!L.goals[i].ok(g.h); } catch (e) { ok = false; } hold = ok ? hold + 1 : 0; if (hold >= 6) { console.log(`OK   ${L.id} цель ${i + 1}`); return true; } } console.log(`FAIL ${L.id} цель ${i + 1}`, g.log.slice(-3).join(' | ').slice(0, 300)); fails++; return false; };
  g.wire = s => g.circuit.wires.push(pw(s)); g.unwire = (a, b) => { g.circuit.wires = g.circuit.wires.filter(x => !((x.a.c + '.' + x.a.t === a && x.b.c + '.' + x.b.t === b) || (x.a.c + '.' + x.a.t === b && x.b.c + '.' + x.b.t === a))); };
  g.fix = () => g.circuit.wires.forEach(w => { w.burned = false; w.heat = 0; });
  g.clean = () => { const d = diagnose(g.circuit).filter(x => x.sev === 'crit'); if (d.length && !L.lax) { console.log(`FAIL ${L.id}: в конце остались замечания: ` + d.map(x => x.text).join(' | ')); fails++; } };
  return g;
}
const L = id => LEVELS.find(l => l.id === id);
for (const lv of LEVELS.filter(l => l.ch >= 4)) {   // клеммы существуют
  const g = G(lv), chk = () => { for (const w of g.circuit.wires) for (const e of [w.a, w.b]) { const c = g.h.c(e.c); if (!c || !DEFS[c.type].terms.some(t => t.n === e.t)) { console.log('FAIL', lv.id, 'нет клеммы', e.c + '.' + e.t); fails++; } } };
  chk(); g.sol(); chk();
}
let g;
g = G(L('sock')); g.sol(); g.goal(0); g.h.c('h1').state.touch = true; g.h.c('a1').p.fault = 'пробой на корпус'; g.goal(1); g.clean();
// та же розетка без PE: человек получает удар
g = G(L('sock')); g.sol(); g.unwire('g1.PE', 'x1.PE'); g.h.c('h1').state.touch = true; g.h.c('a1').p.fault = 'пробой на корпус'; g.run(1);
console.log(g.h.c('h1').state.i > 0.1 && g.h.c('qf1').state.on ? 'OK   sock без PE: удар током, автомат молчит' : 'FAIL sock без PE'); if (!(g.h.c('h1').state.i > 0.1)) fails++;
g = G(L('sock2')); g.h.c('h1').state.touch = true; g.goal(0); console.log('     ток через человека, мА:', (g.h.c('h1').state.i * 1000).toFixed(0)); g.h.c('h1').state.touch = false; g.wire('g1.PE x1.PE'); g.goal(1); g.sol(); g.goal(2); g.clean();
g = G(L('rect')); g.wire('o1.1 tv1.3'); g.wire('o1.2 tv1.4'); g.goal(0); g.sol(); g.goal(1); g.h.c('vd1').p.sch = 'мост (2 полупериода)'; g.goal(2); g.h.c('vd1').p.C = 'есть'; g.goal(3); console.log('     лампа цела:', !g.h.c('el1').state.burned, g.h.c('vd1').state.vdc.toFixed(1)); if (g.h.c('el1').state.burned) fails++; g.clean();
g = G(L('psuq')); g.sol(); g.goal(0); g.goal(1); g.goal(2); g.clean();
g = G(L('loose')); g.h.c('a1').state.on = g.h.c('a2').state.on = true; g.goal(0, 20); g.sol(); g.goal(1); g.clean();
g = G(L('ext')); g.h.c('a1').state.on = g.h.c('a2').state.on = true; g.goal(0, 30); console.log('     автомат остался включён:', g.h.c('qf1').state.on); g.sol(); g.goal(1); g.clean();
g = G(L('charB')); g.run(0.5); g.h.c('k1').state.on = true; g.goal(0); g.h.c('k1').state.on = false; g.fix(); g.h.c('qf1').p.curve = 'B'; g.h.c('qf1').state.on = true; g.h.c('qf1').state.trip = null; g.run(0.5); g.h.c('k1').state.on = true; g.goal(1);
// альтернатива: оставить C, но взять провод 4 мм²
g = G(L('charB')); g.circuit.wires.forEach(w => { if (w.len >= 80) w.mm2 = 4; }); g.run(0.5); g.h.c('k1').state.on = true; g.goal(1);
g = G(L('charD')); g.h.c('qf1').state.on = true; g.goal(0); g.h.c('qf1').p.curve = 'C'; g.h.c('qf1').state.on = true; g.h.c('qf1').state.trip = null; g.goal(1); g.wire('k1.1 m1.U'); g.wire('k1.2 m1.V'); g.h.c('k1').state.on = true; g.goal(2);
g = G(L('pks')); g.run(0.3); g.h.c('k1').state.on = true; g.goal(0); console.log('     ток КЗ:', g.log[0].slice(0, 40)); g.h.c('k1').state.on = false; g.fix(); const q = g.h.c('qf1'); q.state.dead = false; q.state.on = true; q.p.pks = 6; g.run(0.5); g.h.c('k1').state.on = true; g.goal(1);
g = G(L('null3')); g.run(1); g.h.c('s1').state.on = false; g.goal(0); g.h.c('s1').state.on = true; g.circuit.comps.forEach(c => c.state.burned = false); g.goal(1);
console.log(fails ? `\n${fails} FAILED` : '\nВсе квесты проходимы'); process.exit(fails ? 1 : 0);
