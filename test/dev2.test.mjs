// Проверка дополнительных устройств: node test/dev2.test.mjs
import '../js/defs2.js';
import { mk, run } from './sim.test.mjs';
const get = (c, id) => c.comps.find(x => x.id === id); let fails = 0;
const ok = (n, cond, x = '') => { console.log((cond ? 'OK   ' : 'FAIL ') + n, x); if (!cond) fails++; };
const src = ['g1.L1 q1.1', 'g1.L2 q1.3', 'g1.L3 q1.5'];
let c = mk([['g1', 'src3'], ['q1', 'qf3'], ['m1', 'm6']], [...src, 'q1.2 m1.U1', 'q1.4 m1.V1', 'q1.6 m1.W1', 'm1.U2 m1.V2', 'm1.V2 m1.W2']);
run(c, 20); const iy = get(c, 'm1').state.il; ok('Звезда', get(c, 'm1').state.conn === 'звезда Y' && get(c, 'm1').state.speed > 0.9, iy);
c = mk([['g1', 'src3'], ['q1', 'qf3', { In: 25 }], ['m1', 'm6']], [...src, 'q1.2 m1.U1', 'q1.4 m1.V1', 'q1.6 m1.W1', 'm1.U1 m1.W2', 'm1.V1 m1.U2', 'm1.W1 m1.V2']);
let log = run(c, 6); const id = get(c, 'm1').state.il; ok('Треугольник', get(c, 'm1').state.conn === 'треугольник Δ' && get(c, 'm1').state.speed > 0.9, id + ' ' + log.join('|')); ok('Iδ ≈ 3·Iy', Math.abs(id / iy - 3) < 0.2, id / iy);
// тепловое реле + контактор, двигатель заклинен
c = mk([['g1', 'src3'], ['q1', 'qf3', { curve: 'D' }], ['k1', 'km'], ['kk1', 'kk'], ['m1', 'm3', { load: 'заклинен' }], ['s1', 'sa']],
  [...src, 'q1.2 k1.1', 'q1.4 k1.3', 'q1.6 k1.5', 'k1.2 kk1.1', 'k1.4 kk1.3', 'k1.6 kk1.5', 'kk1.2 m1.U', 'kk1.4 m1.V', 'kk1.6 m1.W', 'g1.L1 s1.1', 's1.2 kk1.95', 'kk1.96 k1.A1', 'k1.A2 g1.N']);
get(c, 's1').state.on = true; log = run(c, 10); ok('Тепловое реле спасло заклиненный двигатель', get(c, 'kk1').state.trip && !get(c, 'k1').state.on && !get(c, 'm1').state.burned, log.join('|'));
c.comps.find(x => x.id === 'm1').p.load = 'номинальная'; get(c, 'kk1').state.trip = false; get(c, 'kk1').state.heat = 0; log = run(c, 20); ok('Нормальный пуск без ложного срабатывания', !get(c, 'kk1').state.trip && get(c, 'm1').state.speed > 0.9, get(c, 'kk1').state.heat + log.join('|'));
get(c, 'm1').p.load = 'перегруз ×1,5'; log = run(c, 30); ok('Перегруз ×1,5 отключён', get(c, 'kk1').state.trip && !get(c, 'm1').state.burned, log.join('|'));
// реле времени
c = mk([['g1', 'src1'], ['t1', 'kt', { T: 2 }], ['h1', 'hl']], ['g1.L t1.A1', 't1.A2 g1.N', 'g1.L t1.15', 't1.18 h1.X1', 'h1.X2 g1.N']);
run(c, 1); ok('Реле времени ещё ждёт', get(c, 'h1').state.bright < 0.1); run(c, 1.5); ok('Реле времени сработало', get(c, 'h1').state.bright > 0.9);
// проходные выключатели
c = mk([['g1', 'src1'], ['a', 'sa2'], ['b', 'sa2'], ['l', 'el']], ['g1.L a.L', 'a.1 b.1', 'a.2 b.2', 'b.L l.1', 'l.2 g1.N']);
run(c, 0.5); const s0 = get(c, 'l').state.bright > 0.8; get(c, 'a').state.pos = 1; run(c, 0.5); const s1 = get(c, 'l').state.bright > 0.8; get(c, 'b').state.pos = 1; run(c, 0.5); const s2 = get(c, 'l').state.bright > 0.8;
ok('Проходные выключатели', s0 && !s1 && s2);
// дифавтомат
c = mk([['g1', 'src1'], ['d', 'qfd'], ['l', 'el'], ['h', 'hum']], ['g1.L d.1', 'g1.N d.N1', 'd.2 l.1', 'l.2 d.N2', 'd.2 h.рука']);
run(c, 0.5); get(c, 'h').state.touch = true; run(c, 0.5); ok('Дифавтомат: утечка', get(c, 'd').state.trip === 'd');
console.log(fails ? `\n${fails} FAILED` : '\nВсе проверки пройдены'); process.exit(fails ? 1 : 0);
