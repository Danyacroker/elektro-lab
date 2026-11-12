// Бытовая электрика и аварийные сценарии: node test/dev3.test.mjs
import { simulate } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';
import '../js/defs2.js';
import '../js/defs3.js';

let fails = 0, wn = 0;
const ok = (n, c, x = '') => { console.log((c ? 'OK   ' : 'FAIL ') + n, String(x).slice(0, 200)); if (!c) fails++; };
const pw = s => { const [a, b, mm, len] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, len: +len || 2, n: wn++ }; };
function mk(comps, wires) {
  const c = { comps: comps.map(([id, type, p, st]) => { const x = newComp(type, id, 0, 0, p); if (st) Object.assign(x.state, st); return x; }), wires: wires.map(pw), log: [], flags: new Set() };
  c.g = id => c.comps.find(x => x.id === id); c.run = (s = 1) => { for (let i = 0; i < s * 20; i++) simulate(c, DEFS, 0.05, (k, m, f) => { c.log.push(m); if (f) c.flags.add(f); }); return c; };
  return c;
}
const SOCK = ['g1.L q1.1', 'q1.2 x1.L', 'g1.N x1.N', 'g1.PE x1.PE', 'x1.l a1.L', 'x1.n a1.N', 'x1.pe a1.PE'];
let c = mk([['g1', 'src1'], ['q1', 'qf1'], ['x1', 'xs'], ['a1', 'app']], SOCK).run(2);
ok('Чайник от розетки', Math.abs(c.g('a1').state.i - 8.5) < 0.4 && c.g('q1').state.on, c.g('a1').state.i);
c.g('a1').p.fault = 'пробой на корпус'; c.run(1); ok('Пробой на корпус с PE → автомат отключил', c.g('q1').state.trip === 'em' && c.g('a1').state.uc < 50, c.log.join('|'));
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['x1', 'xs'], ['a1', 'app', { fault: 'пробой на корпус' }], ['h1', 'hum', {}, { touch: true }]], [...SOCK.filter(w => w !== 'g1.PE x1.PE'), 'a1.корпус h1.рука']).run(1);
ok('Пробой без PE → корпус под фазой, человек под током, автомат молчит', c.g('q1').state.on && c.g('h1').state.i > 0.15, c.g('h1').state.i);
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['d1', 'rcd2'], ['x1', 'xs'], ['a1', 'app', { kind: 'стиральная машина 2,2 кВт', fault: 'утечка 50 мА' }]], ['g1.L q1.1', 'q1.2 d1.1', 'g1.N d1.N1', 'd1.2 x1.L', 'd1.N2 x1.N', 'g1.PE x1.PE', 'x1.l a1.L', 'x1.n a1.N', 'x1.pe a1.PE']).run(1);
ok('Утечка 50 мА + PE + УЗО → УЗО отключило', c.g('d1').state.trip === 'd', c.log.join('|'));
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['x1', 'xs', { contact: 'ослаблены' }], ['a1', 'app']], SOCK).run(25);
ok('Ослабленный контакт: розетка оплавилась, автомат не сработал', c.g('x1').state.burned && c.g('q1').state.on, c.log.join('|'));
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['a1', 'app', { kind: 'обогреватель 1,5 кВт' }], ['a2', 'app']], ['g1.L q1.1', 'q1.2 a1.L 0.75', 'a1.L a2.L 0.75', 'a1.N g1.N 0.75', 'a2.N a1.N 0.75']).run(30);
ok('Тонкий удлинитель 0,75 мм² на 15 А: провод сгорел, автомат C16 молчал', c.wires.some(w => w.burned) && c.g('q1').state.on, c.log.join('|'));
// блок питания и выпрямители
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['p1', 'psu'], ['l1', 'el', { Un: 12, Pn: 25 }], ['o1', 'osc'], ['o2', 'osc']], ['g1.L q1.1', 'q1.2 p1.L', 'g1.N p1.N', 'p1.+ l1.1', 'p1.- l1.2', 'o1.1 p1.+', 'o1.2 p1.-', 'o2.1 q1.2', 'o2.2 g1.N']).run(2);
ok('БП: лампа 12 В горит', c.g('l1').state.bright > 0.9 && Math.abs(c.g('p1').state.vdc - 12) < 0.2, c.g('p1').state.vdc); ok('Осциллограф: выход БП ровный, сеть — синус', c.g('o1').state.shape === 'flat' && c.g('o2').state.shape === 'sine', c.g('o1').state.shape + ' ' + c.g('o2').state.shape);
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['t1', 'tv', { U2: 12 }], ['v1', 'vd', { sch: 'один диод (1 полупериод)' }], ['l1', 'el', { Un: 12, Pn: 5 }], ['o1', 'osc']], ['g1.L q1.1', 'q1.2 t1.1', 'g1.N t1.2', 't1.3 v1.~1', 't1.4 v1.~2', 'v1.+ l1.1', 'v1.- l1.2', 'o1.1 v1.+', 'o1.2 v1.-']).run(2);
const half = c.g('v1').state.vdc; ok('Один диод: ≈0,45·U, форма «половина»', Math.abs(half - 4.7) < 0.6 && c.g('o1').state.shape === 'half', half);
c.g('v1').p.sch = 'мост (2 полупериода)'; c.run(2); const full = c.g('v1').state.vdc; ok('Мост: ≈0,9·U, обе полуволны', Math.abs(full - 9.4) < 0.8 && c.g('o1').state.shape === 'full', full);
c.g('v1').p.C = 'есть'; c.run(2); ok('С конденсатором: ≈1,41·U, сглажено', c.g('v1').state.vdc > 14 && c.g('o1').state.shape === 'flt', c.g('v1').state.vdc);
c = mk([['g1', 'src3'], ['q1', 'qf3'], ['v1', 'vd3'], ['r1', 'r', { R: 1000 }], ['o1', 'osc']], ['g1.L1 q1.1', 'g1.L2 q1.3', 'g1.L3 q1.5', 'q1.2 v1.A', 'q1.4 v1.B', 'q1.6 v1.C', 'v1.+ r1.1', 'v1.- r1.2', 'o1.1 v1.+', 'o1.2 v1.-']).run(2);
ok('Трёхфазный мост: ≈1,35·400 = 540 В', Math.abs(c.g('v1').state.vdc - 538) < 12 && c.g('o1').state.shape === 'six', c.g('v1').state.vdc);
// характеристики автоматов
const line = cv => mk([['g1', 'src1'], ['q1', 'qf1', { curve: cv }], ['k1', 'kz']], ['g1.L q1.1', 'q1.2 k1.1 1.5 80', 'k1.2 g1.N 1.5 80']);
c = line('C'); c.run(0.5); c.g('k1').state.on = true; c.run(3); ok('КЗ в конце длинной линии, C16: кабель сгорел раньше автомата', c.wires.some(w => w.burned) && c.g('q1').state.trip !== 'em', 'I=' + c.g('k1').state.i + ' ' + c.log.join('|'));
c = line('B'); c.run(0.5); c.g('k1').state.on = true; c.run(3); ok('То же, B16: мгновенное отключение, кабель цел', c.g('q1').state.trip === 'em' && !c.wires.some(w => w.burned), c.log.join('|'));
const mot = cv => mk([['g1', 'src3'], ['q1', 'qf3', { In: 10, curve: cv }], ['m1', 'm3', { Pn: 4 }]], ['g1.L1 q1.1', 'g1.L2 q1.3', 'g1.L3 q1.5', 'q1.2 m1.U', 'q1.4 m1.V', 'q1.6 m1.W', 'g1.PE m1.PE']).run(15);
c = mot('B'); ok('Двигатель 4 кВт на B10: выбивает при пуске', c.g('q1').state.trip === 'em', c.log.join('|')); c = mot('C'); ok('Тот же двигатель на C10: работает', c.g('q1').state.on && c.g('m1').state.speed > 0.95, c.log.join('|'));
const comp = cv => mk([['g1', 'src1'], ['q1', 'qf1', { In: 10, curve: cv }], ['x1', 'xs'], ['a1', 'app', { kind: 'компрессор 1,5 кВт' }]], SOCK).run(10);
c = comp('C'); ok('Компрессор (пуск ×14) на C10: выбивает', c.g('q1').state.trip === 'em', c.log.join('|')); c = comp('D'); ok('Компрессор на D10: работает', c.g('q1').state.on && c.g('a1').state.i > 5, c.log.join('|'));
// отключающая способность
const pk = p => { const x = mk([['g1', 'src1', { net: 'мощная (рядом ТП)' }], ['q1', 'qf1', { pks: p }], ['k1', 'kz']], ['g1.L q1.1 6 1', 'q1.2 k1.1 6 1', 'k1.2 g1.N 6 1']); x.run(0.3); x.g('k1').state.on = true; return x.run(2); };
c = pk(4.5); ok('Мощная сеть, ПКС 4,5 кА: автомат разрушен, провод горит', c.g('q1').state.dead && c.flags.has('weld') && c.wires.some(w => w.burned), c.log.join('|'));
c = pk(10); ok('ПКС 10 кА: отключил', c.g('q1').state.trip === 'em' && !c.g('q1').state.dead && !c.wires.some(w => w.burned), c.log.join('|'));
// двигатель 230/400 треугольником в сети 400 В
const d6 = (delta) => mk([['g1', 'src3'], ['q1', 'qf3', { In: 25, curve: 'D' }], ['m1', 'm6', { Uw: 230, Pn: 1.5 }]], ['g1.L1 q1.1', 'g1.L2 q1.3', 'g1.L3 q1.5', 'q1.2 m1.U1', 'q1.4 m1.V1', 'q1.6 m1.W1', ...(delta ? ['m1.U1 m1.W2', 'm1.V1 m1.U2', 'm1.W1 m1.V2'] : ['m1.U2 m1.V2', 'm1.V2 m1.W2'])]).run(25);
c = d6(false); ok('Двигатель 230/400 звездой в сети 400 В: работает', c.g('m1').state.speed > 0.95 && !c.g('m1').state.burned, c.log.join('|'));
c = d6(true); ok('Он же треугольником: обмотки сгорели', c.g('m1').state.burned, c.log.join('|'));
// обрыв нуля в трёхфазной сети с однофазными приборами
c = mk([['g1', 'src3'], ['q1', 'qf3'], ['s1', 'sa', {}, { on: true }], ['a1', 'app'], ['a2', 'app', { kind: 'холодильник 150 Вт' }], ['a3', 'app', { kind: 'обогреватель 1,5 кВт' }]],
  ['g1.L1 q1.1', 'g1.L2 q1.3', 'g1.L3 q1.5', 'q1.2 a1.L', 'q1.4 a2.L', 'q1.6 a3.L', 'a1.N a2.N', 'a2.N a3.N', 'a3.N s1.2', 's1.1 g1.N']).run(3);
ok('С нулём все приборы целы', !c.comps.some(x => x.state.burned)); c.g('s1').state.on = false; c.run(3);
ok('Обрыв нуля: маломощный прибор сгорел от перенапряжения', c.g('a2').state.burned, c.log.join('|'));
console.log(fails ? `\n${fails} FAILED` : '\nВсе проверки пройдены'); process.exit(fails ? 1 : 0);
