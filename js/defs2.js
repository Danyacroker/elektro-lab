// Дополнительные устройства: тепловое реле, реле времени, переключатель, дифавтомат, двигатель с 6 выводами, сигнальная лампа
import { fmt, cabs } from './sim.js';
import { DEFS, tt, U, closeIf, I, P, A120, tripLogic, coilDev } from './defs.js';

Object.assign(DEFS, {
  hl: {
    name: 'Сигнальная лампа', mark: 'HL', cat: 'Нагрузка', w: 4.5, h: 8, d: 5, art: 'signal',
    terms: [...tt(['X1'], [0], 8, 1), ...tt(['X2'], [0], 8, -1)],
    params: { Un: P('Напряжение', [24, 230, 400], 230, 'В'), color: P('Цвет', ['зелёная', 'красная', 'жёлтая'], 'зелёная') },
    init: () => ({ bright: 0, u: 0, burned: false }),
    stamp(c, net, T) { if (!c.state.burned) net.R(T('X1'), T('X2'), c.p.Un * c.p.Un / 3); },
    step(c, net, dt, emit, T) { const s = c.state; s.u = U(net, T, 'X1', 'X2'); s.bright = s.burned ? 0 : Math.min(1.5, (s.u / c.p.Un) ** 2); if (!s.burned && s.u > 1.4 * c.p.Un) { s.burned = true; emit('bad', `💥 ${c.label}: лампа на ${c.p.Un} В получила ${fmt(s.u)}В и сгорела`, 'burn'); } },
    click(c) { c.state.burned = false; },
    read: c => [['Напряжение', fmt(c.state.u) + 'В'], ['Состояние', c.state.burned ? 'СГОРЕЛА (клик)' : c.state.bright > 0.5 ? 'ГОРИТ' : 'не горит']],
    how: 'Маленькая лампа на двери щита: показывает состояние цепи. Зелёная — «включено / работа», красная — «авария» или «отключено» (в разных стандартах по-разному, смотри надписи). Потребляет единицы ватт, подключается через блок-контакты.'
  },
  sa2: {
    name: 'Переключатель (проходной)', mark: 'SA', cat: 'Коммутация', w: 6, h: 8, d: 4, art: 'pass',
    terms: [...tt(['L'], [0], 8, 1), ...tt(['1', '2'], [-1.5, 1.5], 8, -1)], params: {},
    init: () => ({ pos: 0 }),
    stamp(c, net, T) { closeIf(net, true, T('L'), T(c.state.pos ? '2' : '1')); },
    click(c) { c.state.pos = c.state.pos ? 0 : 1; },
    read: c => [['Положение', 'L → ' + (c.state.pos ? '2' : '1')]],
    how: 'Не разрывает цепь, а <b>перебрасывает</b> общий контакт L с вывода 1 на вывод 2. Два таких переключателя, соединённые двумя проводами (1–1 и 2–2), позволяют управлять одной лампой из двух мест — с двух концов коридора или лестницы.'
  },
  qfd: {
    name: 'Дифавтомат 2P', mark: 'QFD', cat: 'Защита', w: 6, h: 9, d: 6.5, art: 'rcd',
    terms: [...tt(['1', 'N1'], [-1.5, 1.5], 9, 1), ...tt(['2', 'N2'], [-1.5, 1.5], 9, -1)],
    params: { In: P('Номинал', [6, 10, 16, 25, 32], 16, 'А'), Id: P('Ток утечки IΔn', [10, 30, 100], 30, 'мА') },
    init: () => ({ on: true, heat: 0, trip: null, i: 0, d: 0 }),
    stamp(c, net, T) { c._e = [['1', '2'], ['N1', 'N2']].map(([a, b]) => closeIf(net, c.state.on, T(a), T(b))); },
    step(c, net, dt, emit) {
      const s = c.state; if (s.on) { const r = c._e[0].i[0] + c._e[1].i[0], im = c._e[0].i[1] + c._e[1].i[1]; s.d = Math.hypot(r, im); if (s.d > c.p.Id / 1000) { s.on = false; s.trip = 'd'; emit('good', `🛡 ${c.label}: утечка ${fmt(s.d)}А — дифференциальная защита отключила цепь`); return; } } else s.d = 0;
      tripLogic(c, [c._e[0]], c.p.In, 7.5, emit, c.label);
    },
    click(c, act) { if (act === 'test') { if (c.state.on) { c.state.on = false; c.state.trip = 'd'; } } else { c.state.on = !c.state.on; c.state.trip = null; } },
    read: c => [['Состояние', c.state.on ? 'ВКЛ' : { em: 'ОТКЛ: КЗ', th: 'ОТКЛ: перегрузка', d: 'ОТКЛ: утечка' }[c.state.trip] || 'ОТКЛ'], ['Ток', fmt(c.state.on ? c.state.i : 0) + 'А'], ['Дифф. ток', fmt(c.state.d) + 'А']],
    how: 'Автомат и УЗО в одном корпусе (АВДТ): защищает и кабель (перегрузка, КЗ), и человека (утечка). Экономит место в щите. Минус — по сработавшему аппарату не сразу понятно, что именно случилось.'
  },
  kk: {
    name: 'Тепловое реле', mark: 'KK', cat: 'Защита', w: 15, h: 9, d: 6.5, art: 'thermal',
    terms: [...tt(['1', '3', '5', '95', '97'], [-6, -3, 0, 3, 6], 9, 1), ...tt(['2', '4', '6', '96', '98'], [-6, -3, 0, 3, 6], 9, -1)],
    params: { Iset: P('Уставка', [1, 1.6, 2.5, 3.2, 4, 6.3, 10, 16, 25], 3.2, 'А') },
    init: () => ({ trip: false, heat: 0, i: 0 }),
    stamp(c, net, T) { c._e = [['1', '2'], ['3', '4'], ['5', '6']].map(([a, b]) => net.R(T(a), T(b), 0.01)); closeIf(net, !c.state.trip, T('95'), T('96')); closeIf(net, c.state.trip, T('97'), T('98')); },
    step(c, net, dt, emit) {
      const s = c.state; s.i = Math.max(...c._e.map(I)); const k = s.i / c.p.Iset;
      s.heat = Math.max(0, Math.min(1.2, s.heat + (k > 1.1 ? (k * k - 1) / 60 + (k > 1.15 ? 0.08 : 0) : -0.12) * dt));
      if (s.heat >= 1 && !s.trip) { s.trip = true; emit('warn', `🌡 ${c.label}: ток ${fmt(s.i)}А при уставке ${c.p.Iset} А — биметалл нагрелся, контакт 95–96 разомкнулся. Клик по синей кнопке — возврат после остывания`); }
    },
    click(c) { if (c.state.trip && c.state.heat < 0.6) c.state.trip = false; },
    read: c => [['Ток', fmt(c.state.i) + 'А'], ['Нагрев', Math.round(c.state.heat * 100) + ' %'], ['95–96 (НЗ)', c.state.trip ? 'РАЗОМКНУТ — сработало' : 'замкнут'], ['97–98 (НО)', c.state.trip ? 'замкнут' : 'разомкнут']],
    how: 'Защита двигателя от перегрузки. Ток всех трёх фаз идёт через биметаллические пластины. При длительном превышении уставки пластины изгибаются и размыкают контакт <b>95–96</b>. Сами силовые цепи реле <b>не рвёт</b>: 95–96 включают в цепь катушки контактора, и отключает уже он.'
  },
  kt: coilDev({
    name: 'Реле времени', mark: 'KT', cat: 'Коммутация', w: 9, h: 9, d: 6, art: 'timer',
    terms: [...tt(['A1', '15'], [-3, 1.5], 9, 1), ...tt(['A2', '16', '18'], [-3, 0, 3], 9, -1)],
    params: { Uc: P('Питание', [24, 230], 230, 'В'), T: P('Задержка', [1, 2, 3, 5, 10], 3, 'с') },
    init: () => ({ on: false, burned: false, uc: 0, t: 0 }),
    stamp(c, net, T) { this.coil(c, net, T); closeIf(net, !c.state.on, T('15'), T('16')); closeIf(net, c.state.on, T('15'), T('18')); },
    step(c, net, dt, emit, T) { const s = c.state; s.uc = s.burned ? 0 : U(net, T, 'A1', 'A2'); if (s.uc > 0.8 * c.p.Uc) { s.t = Math.min(c.p.T, s.t + dt); if (s.t >= c.p.T) s.on = true; } else if (s.uc < 0.5 * c.p.Uc) { s.t = 0; s.on = false; } },
    disp: c => (c.state.uc > 0.5 * c.p.Uc ? Math.max(0, c.p.T - c.state.t).toFixed(1) : c.p.T.toFixed(1)) + ' с',
    read: c => [['Питание A1–A2', fmt(c.state.uc) + 'В'], ['Отсчёт', c.state.t.toFixed(1) + ' / ' + c.p.T + ' с'], ['Контакт 15', c.state.on ? '→ 18 (время вышло)' : '→ 16']],
    how: 'Реле с задержкой включения: подали питание — начался отсчёт, и только когда время вышло, контакт 15 перекидывается с 16 на 18. Сняли питание — мгновенный возврат. Нужно для поочерёдного пуска двигателей, пуска «звезда → треугольник», задержки освещения.'
  }),
  m6: {
    name: 'Двигатель 3ф (6 выводов)', mark: 'M', cat: 'Нагрузка', w: 24, h: 15, d: 12, art: 'stardelta',
    terms: tt(['U1', 'V1', 'W1', 'W2', 'U2', 'V2', 'PE'], [-9, -6, -3, 1.5, 4.5, 7.5, 10.5], 15, 1),
    params: { Pn: P('Мощность', [1.5, 4, 7.5, 15], 4, 'кВт'), Uw: P('Обмотка рассчитана на', [400, 230], 400, 'В') },
    init: () => ({ speed: 0, heat: 0, burned: false, i: [0, 0, 0], il: 0, conn: '—', uw: 0 }),
    Iw: c => c.p.Pn * 1000 / (0.8 * 0.85) / (3 * c.p.Uw),
    stamp(c, net, T) { const ov = c.state.uw / c.p.Uw, z = c.p.Uw / this.Iw(c) / (1 + 5 * (1 - Math.min(1, Math.abs(c.state.speed)))) / (ov > 1.25 ? ov * ov : 1); c._e = c.state.burned ? [] : [['U1', 'U2'], ['V1', 'V2'], ['W1', 'W2']].map(([a, b]) => net.R(T(a), T(b), z * 0.8, z * 0.6)); },
    step(c, net, dt, emit, T) {
      const s = c.state, v = [['U1', 'U2'], ['V1', 'V2'], ['W1', 'W2']].map(([a, b]) => net.u(T(a), T(b)));
      let pr = 0, pi = 0, nr = 0, ni = 0;
      v.forEach((x, k) => { const a = A120[(3 - k) % 3], b = A120[k]; pr += x[0] * a[0] - x[1] * a[1]; pi += x[0] * a[1] + x[1] * a[0]; nr += x[0] * b[0] - x[1] * b[1]; ni += x[0] * b[1] + x[1] * b[0]; });
      const pos = Math.hypot(pr, pi) / 3, neg = Math.hypot(nr, ni) / 3; s.uw = Math.max(...v.map(cabs));
      let tgt = s.burned ? 0 : (pos - neg) / c.p.Uw; tgt = Math.abs(tgt) < 0.4 ? 0 : Math.sign(tgt);
      s.speed += (tgt - s.speed) * Math.min(1, dt / (Math.max(pos, neg) > 0.75 * c.p.Uw ? 0.6 : 1.6)); if (Math.abs(s.speed) < 0.01) s.speed = 0;
      s.i = c._e.map(I); const im = Math.max(0, ...s.i), k = im / this.Iw(c);
      s.conn = net.same(T('U2'), T('V2')) && net.same(T('V2'), T('W2')) && !net.same(T('U1'), T('U2')) ? 'звезда Y' : net.same(T('U1'), T('W2')) && net.same(T('V1'), T('U2')) && net.same(T('W1'), T('V2')) ? 'треугольник Δ' : net.same(T('U1'), T('V2')) && net.same(T('V1'), T('W2')) && net.same(T('W1'), T('U2')) ? 'треугольник Δ' : 'не собрана';
      s.il = s.conn === 'треугольник Δ' ? im * Math.sqrt(3) : im;
      s.stall = !s.burned && im > 0.2 && Math.abs(s.speed) < 0.2 && tgt === 0;
      s.heat = Math.max(0, s.heat + (k > 1.15 ? (k * k - 1.2) / 150 : -0.03) * dt);
      if (s.heat >= 1 && !s.burned) { s.burned = true; emit('bad', `🔥 ${c.label}: обмотки сгорели (ток обмотки ${fmt(im)}А при номинале ${fmt(this.Iw(c))}А)`, 'burn'); }
    },
    click(c) { if (c.state.burned) { c.state.burned = false; c.state.heat = 0; } },
    read(c) { const s = c.state; return [['Схема обмоток', s.conn], ['Напряжение на обмотке', fmt(s.uw) + 'В'], ['Ток в линии', fmt(s.il) + 'А'], ['Ток обмотки', fmt(Math.max(0, ...s.i)) + 'А'], ['Обороты', Math.round(s.speed * 1450) + ' об/мин'], ['Момент', s.uw > 1.25 * c.p.Uw ? 'ПЕРЕНАПРЯЖЕНИЕ обмотки!' : s.uw > 0.75 * c.p.Uw ? '100 %' : s.uw > 150 ? '≈ 33 %' : '0'], ['Нагрев', Math.round(s.heat * 100) + ' %'], ...(s.burned ? [['Состояние', 'СГОРЕЛ (клик)']] : [])]; },
    how: 'У двигателя выведены начала (U1, V1, W1) и концы (U2, V2, W2) всех трёх обмоток. <b>Звезда</b>: концы соединены вместе — на каждой обмотке 230 В. <b>Треугольник</b>: конец одной к началу следующей (U1–W2, V1–U2, W1–V2) — на каждой обмотке 400 В. В звезде ток в линии и момент втрое меньше — этим пользуются для мягкого пуска.'
  },
});
