// Проверка проходимости новых квестов: node test/levels2.test.mjs
import { simulate, cabs, IZ } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';
import '../js/defs2.js';
import { LEVELS } from '../js/levels.js';
import '../js/levels2.js';

let wn = 0, fails = 0;
const pw = s => { const [a, b, mm, len] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, len: +len || 2, n: wn++ }; };
const mk = l => (l || []).map(([id, type, x, y, p, st]) => { const c = newComp(type, id, x, y, p); if (st) Object.assign(c.state, st); return c; });
function G(L) {
  const g = { circuit: { comps: mk(L.comps), wires: (L.wires || []).map(pw) }, flags: new Set(), log: [] };
  g.h = {
    get circuit() { return g.circuit; }, flags: g.flags, IZ, c: id => g.circuit.comps.find(c => c.id === id), all: t => g.circuit.comps.filter(c => c.type === t),
    v(c, t) { const n = g.circuit.net; return cabs(n.v(n.node(c.id + '.' + t))); }, wired: (c, t) => g.circuit.wires.some(w => (w.a.c === c.id && w.a.t === t) || (w.b.c === c.id && w.b.t === t)),
    grounded(c, t) { const n = g.circuit.net; return n.grounded(n.node(c.id + '.' + t)); }
  };
  g.run = (sec = 1) => { for (let i = 0; i < sec * 20; i++) simulate(g.circuit, DEFS, 0.05, (k, m, f) => { g.log.push(m); if (f) g.flags.add(f); }); };
  g.sol = () => {
    const s = L.sol; let comps = [...L.comps], wires = [...(L.wires || [])];
    if (Array.isArray(s)) wires = s; else { if (s.comps) comps = [...comps, ...s.comps]; if (s.drop) wires = wires.slice(0, -s.drop); if (s.wires) wires = s.drop ? [...wires, ...s.wires] : s.wires; if (s.add) wires = [...wires, ...s.add]; }
    g.circuit.comps = mk(comps); g.circuit.wires = wires.map(pw); if (s.patch) s.patch(g.h);
  };
  g.goal = (i, sec = 15) => { let hold = 0; for (let k = 0; k < sec * 20; k++) { g.run(0.05); let ok = false; try { ok = !!L.goals[i].ok(g.h); } catch (e) { ok = false; } hold = ok ? hold + 1 : 0; if (hold >= 6) { console.log(`OK   ${L.id} цель ${i + 1}`); return true; } } console.log(`FAIL ${L.id} цель ${i + 1}`, g.log.slice(-3).join(' | ')); fails++; return false; };
  g.wire = s => g.circuit.wires.push(pw(s)); g.unwire = s => { const w = pw(s); g.circuit.wires = g.circuit.wires.filter(x => !(x.a.c === w.a.c && x.a.t === w.a.t && x.b.c === w.b.c && x.b.t === w.b.t)); };
  g.press = (id, sec = 0.6) => { g.h.c(id).state.pressed = true; g.run(sec); g.h.c(id).state.pressed = false; g.run(0.3); };
  return g;
}
const L = id => LEVELS.find(l => l.id === id);
// все ссылки на клеммы должны существовать, у каждого уровня есть глава и навыки
for (const lv of LEVELS) {
  if (lv.ch === undefined || !lv.sk) { console.log('FAIL нет главы/навыков', lv.id); fails++; }
  const g = G(lv); const chk = () => { for (const w of g.circuit.wires) for (const e of [w.a, w.b]) { const c = g.h.c(e.c); if (!c || !DEFS[c.type].terms.some(t => t.n === e.t)) { console.log('FAIL', lv.id, 'нет клеммы', e.c + '.' + e.t); fails++; } } };
  chk(); g.sol(); chk();
}
let g;
g = G(L('pass')); g.sol(); g.goal(0); g.h.c('sa1').state.pos = 1; g.goal(1); g.h.c('sa2').state.pos = 1; g.goal(2);
g = G(L('drop')); g.goal(0); console.log('     U на ТЭНе:', g.h.c('pv1').state.val.toFixed(1)); g.sol(); g.goal(1); console.log('     после замены:', g.h.c('pv1').state.val.toFixed(1));
g = G(L('flat')); g.sol(); g.goal(0); g.goal(1); g.h.c('h1').state.touch = true; g.goal(2); console.log('     события:', g.log.join(' | ').slice(0, 200));
g = G(L('sig')); g.sol(); g.goal(0); g.press('sb2'); g.goal(1); g.press('sb1'); g.goal(2);
g = G(L('kk')); g.press('sb2'); g.run(2); g.h.c('m1').p.load = 'заклинен'; g.goal(0, 25); g.sol(); g.press('sb2'); g.goal(1); g.h.c('m1').p.load = 'заклинен'; g.goal(2); console.log('     события:', g.log.join(' | ').slice(0, 260));
g = G(L('sd')); g.sol(); g.goal(0, 25); const iy = g.h.c('pa1').state.val; g.unwire('m1.U2 m1.V2'); g.unwire('m1.V2 m1.W2'); g.wire('m1.U1 m1.W2'); g.wire('m1.V1 m1.U2'); g.wire('m1.W1 m1.V2'); g.goal(1); console.log('     Iy / IΔ:', iy.toFixed(2), g.h.c('pa1').state.val.toFixed(2), g.log.join('|'));
g = G(L('timer')); g.h.c('sa1').state.on = true; g.goal(0); g.sol(); g.h.c('sa1').state.on = true; g.run(2); console.log('     через 2 с KM2:', g.h.c('km2').state.on); g.goal(1); g.h.c('sa1').state.on = false; g.goal(2);
g = G(L('fault')); g.press('sb2'); g.run(1); console.log('     до ремонта KM1:', g.h.c('km1').state.on); g.sol(); g.press('sb2'); g.goal(0); g.goal(1); console.log('     события:', g.log.join(' | ') || 'нет');
// частичный ремонт: только цепь управления — двигатель на двух фазах, тепловое реле должно спасти
g = G(L('fault')); g.h.c('qf2').state.on = true; g.unwire('km1.A2 g1.L1'); g.wire('km1.A2 g1.N'); g.press('sb2'); g.run(8);
console.log(g.h.c('kk1').state.trip && !g.h.c('m1').state.burned ? 'OK   fault: реле спасло двигатель на двух фазах' : 'FAIL fault: двигатель без фазы не защищён ' + g.log.join('|')); if (!(g.h.c('kk1').state.trip && !g.h.c('m1').state.burned)) fails++;
console.log(`\nВсего квестов: ${LEVELS.length}`); console.log(fails ? `${fails} FAILED` : 'Все новые квесты проходимы'); process.exit(fails ? 1 : 0);
