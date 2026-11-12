// Быстрая проверка расчётного ядра: node test/sim.test.mjs
import { simulate } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';

export function mk(comps, wires) {
  return {
    comps: comps.map(([id, type, p]) => newComp(type, id, 0, 0, p)),
    wires: wires.map(s => { const [a, b] = s.split(' '), [ac, at] = a.split('.'), [bc, bt] = b.split('.'); return { a: { c: ac, t: at }, b: { c: bc, t: bt }, mm2: 2.5, len: 2 }; })
  };
}
export function run(c, sec = 3, log = []) { for (let i = 0; i < sec * 20; i++) simulate(c, DEFS, 0.05, (k, m) => log.push(m)); return log; }
const get = (c, id) => c.comps.find(x => x.id === id);
let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'OK   ' : 'FAIL ') + name, extra); if (!cond) fails++; };
const near = (a, b, tol = 0.03) => Math.abs(a - b) <= Math.abs(b) * tol + 1e-9;

// 1. Закон Ома: 12 В, 100 Ом → 0,12 А
let c = mk([['g1', 'srcdc'], ['r1', 'r'], ['a1', 'pa']], ['g1.+ a1.1', 'a1.2 r1.1', 'r1.2 g1.-']);
run(c, 1); ok('Ом 12В/100Ом', near(get(c, 'a1').state.val, 0.12), get(c, 'a1').state.val);

// 2. Лампа 230 В 60 Вт
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['l1', 'el']], ['g1.L q1.1', 'q1.2 l1.1', 'l1.2 g1.N']);
run(c, 1); ok('Лампа горит', get(c, 'l1').state.bright > 0.9, get(c, 'l1').state.i);

// 3. КЗ → автомат отключается, провод цел
c = mk([['g1', 'src1'], ['q1', 'qf1']], ['g1.L q1.1', 'q1.2 g1.N']);
let log = run(c, 1); ok('КЗ отключён автоматом', !get(c, 'q1').state.on && get(c, 'q1').state.trip === 'em' && !c.wires.some(w => w.burned), log[0]);

// 4. Перегрузка: ТЭН 6 кВт на автомате 16 А
c = mk([['g1', 'src1'], ['q1', 'qf1'], ['h1', 'eh', { Pn: 6000 }]], ['g1.L q1.1', 'q1.2 h1.1', 'h1.2 g1.N']);
c.wires.forEach(w => w.mm2 = 4);
log = run(c, 30); ok('Перегрузка → тепловой', get(c, 'q1').state.trip === 'th', log[0]);

// 5. УЗО и человек
c = mk([['g1', 'src1'], ['d1', 'rcd2'], ['l1', 'el'], ['h1', 'hum']], ['g1.L d1.1', 'g1.N d1.N1', 'd1.2 l1.1', 'l1.2 d1.N2', 'd1.2 h1.рука']);
run(c, 1); ok('УЗО не срабатывает без утечки', get(c, 'd1').state.on);
get(c, 'h1').state.touch = true; log = run(c, 1); ok('УЗО отключило при касании', !get(c, 'd1').state.on, log.join(' | '));

// 6. Двигатель 3ф через автомат
const m3 = (swap) => mk([['g1', 'src3'], ['q1', 'qf3'], ['m1', 'm3']], ['g1.L1 q1.1', 'g1.L2 q1.3', 'g1.L3 q1.5', swap ? 'q1.2 m1.V' : 'q1.2 m1.U', swap ? 'q1.4 m1.U' : 'q1.4 m1.V', 'q1.6 m1.W']);
c = m3(false); log = run(c, 5); ok('Двигатель вращается вперёд', near(get(c, 'm1').state.speed, 1, 0.08) && get(c, 'q1').state.on, get(c, 'm1').state.speed + ' I=' + get(c, 'm1').state.i[0] + ' ' + log.join('|'));
c = m3(true); run(c, 5); ok('Реверс при перемене фаз', near(get(c, 'm1').state.speed, -1, 0.08), get(c, 'm1').state.speed);
// обрыв фазы
c = m3(false); c.wires.pop(); log = run(c, 15); ok('Без фазы двигатель стоит и горит/отключается', Math.abs(get(c, 'm1').state.speed) < 0.1, log.join('|'));

// 7. Трансформатор 230/24 + мост + лампа 24 В
c = mk([['g1', 'src1'], ['t1', 'tv'], ['v1', 'vd'], ['l1', 'el', { Un: 24, Pn: 25 }], ['pv', 'pv']],
  ['g1.L t1.1', 'g1.N t1.2', 't1.3 v1.~1', 't1.4 v1.~2', 'v1.+ l1.1', 'v1.- l1.2', 'l1.1 pv.1', 'l1.2 pv.2']);
run(c, 3); ok('Трансформатор 24 В', near(get(c, 't1').state.u2, 24, 0.06), get(c, 't1').state.u2);
ok('Выпрямитель ≈ 0.9U', near(get(c, 'pv').state.val, 20, 0.12), get(c, 'pv').state.val + ' i1=' + get(c, 't1').state.i1);
// трансформатор на постоянном токе не должен «работать» — здесь модель упрощена, проверяем только AC

// 8. Контактор с самоподхватом
c = mk([['g1', 'src3'], ['k1', 'km'], ['p1', 'sb_no'], ['s1', 'sb_nc'], ['m1', 'm3']],
  ['g1.L1 k1.1', 'g1.L2 k1.3', 'g1.L3 k1.5', 'k1.2 m1.U', 'k1.4 m1.V', 'k1.6 m1.W',
    'g1.L1 s1.11', 's1.12 p1.13', 'p1.14 k1.A1', 'k1.A2 g1.N', 'p1.13 k1.13', 'k1.14 k1.A1']);
run(c, 1); ok('Контактор отпущен', !get(c, 'k1').state.on);
get(c, 'p1').state.pressed = true; run(c, 0.5); get(c, 'p1').state.pressed = false; run(c, 3);
ok('Самоподхват держит', get(c, 'k1').state.on && get(c, 'm1').state.speed > 0.9, get(c, 'm1').state.speed);
get(c, 's1').state.pressed = true; run(c, 0.5); get(c, 's1').state.pressed = false; run(c, 3);
ok('Стоп отключает', !get(c, 'k1').state.on && get(c, 'm1').state.speed < 0.1);

// 9. ТП 10/0,4
c = mk([['g1', 'src10'], ['t1', 'tv3'], ['e1', 'pe'], ['l1', 'el']], ['g1.A t1.A', 'g1.B t1.B', 'g1.C t1.C', 't1.n e1.1', 't1.a l1.1', 'l1.2 t1.n']);
c.wires.forEach(w => w.mm2 = 35);
run(c, 1); ok('10/0,4: линейное 400', near(get(c, 't1').state.u2, 400, 0.03), get(c, 't1').state.u2); ok('Лампа от ТП', get(c, 'l1').state.bright > 0.9, get(c, 'l1').state.u);

// 10. Счётчик
c = mk([['g1', 'src1'], ['w1', 'pi'], ['h1', 'eh', { Pn: 2000 }]], ['g1.L w1.1', 'g1.N w1.3', 'w1.2 h1.1', 'h1.2 w1.4']);
run(c, 2); ok('Счётчик ≈ 2 кВт', near(get(c, 'w1').state.p, 2000, 0.03), get(c, 'w1').state.p);

if (process.argv[1] && process.argv[1].endsWith('sim.test.mjs')) { console.log(fails ? `\n${fails} FAILED` : '\nВсе проверки пройдены'); process.exit(fails ? 1 : 0); }
