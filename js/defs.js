// Электрические модели устройств: выводы, параметры, уравнения, поведение во времени.
import { cabs, fmt } from './sim.js';

export const tt = (names, xs, h, s) => names.map((n, i) => ({ n, x: xs[i], y: s * (h / 2 - 0.9), s }));
export const A120 = [[1, 0], [-0.5, -0.8660254], [-0.5, 0.8660254]];
export const U = (net, T, a, b) => cabs(net.u(T(a), T(b)));
export const closeIf = (net, on, a, b) => on ? net.R(a, b, 0.002) : null;
export const I = el => el ? cabs(el.i) : 0;
export const P = (label, opts, def, unit = '') => ({ label, opts, def, unit });

// тепловой + электромагнитный расцепитель
export function tripLogic(c, els, In, km, emit, name) {
  const s = c.state; if (!s.on) { s.heat = Math.max(0, s.heat - 0.02); return; }
  const imax = Math.max(...els.map(I)); s.i = imax; if (s.dead) return;
  if (c.p.pks && imax > c.p.pks * 1000) { s.dead = true; emit('bad', `💥 ${name}: ток КЗ ${fmt(imax)}А больше отключающей способности ${c.p.pks} кА — дугу погасить не удалось, контакты сварились. Автомат разрушен и больше ничего не отключает!`, 'weld'); return; }
  if (imax > km * In) { s.on = false; s.trip = 'em'; emit('warn', `⚡ ${name}: ток ${fmt(imax)}А — мгновенно сработал электромагнитный расцепитель (короткое замыкание)`, 'short'); return; }
  const k = imax / In;
  s.heat = Math.max(0, s.heat + (k > 1.13 ? (k * k - 1) / 24 : -0.3) * 0.05);
  if (s.heat >= 1) { s.on = false; s.trip = 'th'; s.heat = 0.6; emit('warn', `🌡 ${name}: перегрузка ${fmt(imax)}А при номинале ${In} А — биметаллическая пластина нагрелась и отключила автомат`); }
}
export const toggle = c => { if (c.state.dead) { c.state.dead = false; c.state.on = false; c.state.heat = 0; c.state.trip = null; return; } c.state.on = !c.state.on; c.state.trip = null; };

function breaker(np) {
  const xs = np === 1 ? [0] : [-3, 0, 3], up = np === 1 ? ['1'] : ['1', '3', '5'], dn = np === 1 ? ['2'] : ['2', '4', '6'];
  return {
    name: `Автомат ${np}P`, mark: 'QF', cat: 'Защита', w: np * 3, h: 9, d: 6.5, art: 'qf',
    terms: [...tt(up, xs, 9, 1), ...tt(dn, xs, 9, -1)],
    params: { In: P('Номинал', [2, 6, 10, 16, 25, 32, 63], 16, 'А'), curve: P('Характеристика', ['B', 'C', 'D'], 'C'), pks: P('Откл. способность (ПКС)', [4.5, 6, 10], 4.5, 'кА') },
    init: () => ({ on: true, heat: 0, trip: null, i: 0 }),
    stamp(c, net, T) { c._e = up.map((u, i) => closeIf(net, c.state.on, T(u), T(dn[i]))); },
    step(c, net, dt, emit) { tripLogic(c, c._e, c.p.In, { B: 4, C: 7.5, D: 15 }[c.p.curve], emit, c.label); },
    click: toggle,
    read: c => [['Состояние', c.state.dead ? 'РАЗРУШЕН (клик — заменить)' : c.state.on ? 'ВКЛ' : c.state.trip === 'em' ? 'ОТКЛ: КЗ' : c.state.trip === 'th' ? 'ОТКЛ: перегрузка' : 'ОТКЛ'], ['Ток', fmt(c.state.on ? c.state.i : 0) + 'А'], ['Нагрев биметалла', Math.round(c.state.heat * 100) + ' %']],
    how: 'Два расцепителя: <b>тепловой</b> (биметаллическая пластина изгибается от длительной перегрузки) и <b>электромагнитный</b> (катушка мгновенно выбивает защёлку при КЗ). Кликни по рычагу, чтобы включить/отключить.'
  };
}
function rcd(np) {
  const xs = np === 2 ? [-1.5, 1.5] : [-4.5, -1.5, 1.5, 4.5], up = np === 2 ? ['1', 'N1'] : ['1', '3', '5', 'N1'], dn = np === 2 ? ['2', 'N2'] : ['2', '4', '6', 'N2'];
  return {
    name: `УЗО ${np}P`, mark: 'QD', cat: 'Защита', w: np * 3, h: 9, d: 6.5, art: 'rcd',
    terms: [...tt(up, xs, 9, 1), ...tt(dn, xs, 9, -1)],
    params: { Id: P('Ток утечки IΔn', [10, 30, 100, 300], 30, 'мА') },
    init: () => ({ on: true, trip: null, d: 0 }),
    stamp(c, net, T) { c._e = up.map((u, i) => closeIf(net, c.state.on, T(u), T(dn[i]))); },
    step(c, net, dt, emit) {
      const s = c.state; if (!s.on) { s.d = 0; return; }
      let r = 0, im = 0; for (const e of c._e) { r += e.i[0]; im += e.i[1]; }
      s.d = Math.hypot(r, im);
      if (s.d > c.p.Id / 1000) { s.on = false; s.trip = 'd'; emit('good', `🛡 ${c.label}: ток «туда» ≠ току «обратно», разница ${fmt(s.d)}А > ${c.p.Id} мА — утечка! УЗО отключило цепь`); }
    },
    click(c, act) { if (act === 'test') { if (c.state.on) { c.state.on = false; c.state.trip = 'd'; } } else toggle(c); },
    read: c => [['Состояние', c.state.on ? 'ВКЛ' : c.state.trip ? 'ОТКЛ: утечка' : 'ОТКЛ'], ['Дифф. ток', fmt(c.state.d) + 'А']],
    how: 'Все рабочие проводники проходят через кольцевой сердечник. Пока сумма токов равна нулю (1-й закон Кирхгофа) — магнитного потока нет. Утечка на землю нарушает баланс → в обмотке управления появляется ток → реле отключает контакты. <b>От КЗ и перегрузки УЗО не защищает!</b>'
  };
}
export function coilDev(extra) {
  return {
    init: () => ({ on: false, burned: false, uc: 0 }),
    coil(c, net, T) { if (!c.state.burned) net.R(T('A1'), T('A2'), c.p.Uc * c.p.Uc / 8); },
    step(c, net, dt, emit, T) {
      const s = c.state, u = s.burned ? 0 : U(net, T, 'A1', 'A2'); s.uc = u;
      if (u > 1.6 * c.p.Uc) { s.burned = true; s.on = false; emit('bad', `🔥 ${c.label}: на катушку ${c.p.Uc} В подано ${fmt(u)}В — катушка сгорела`, 'burn'); return; }
      if (!s.on && u > 0.8 * c.p.Uc) s.on = true; else if (s.on && u < 0.5 * c.p.Uc) s.on = false;
    },
    click(c) { if (c.state.burned) c.state.burned = false; },
    ...extra
  };
}
function button(nc) {
  const a = nc ? '11' : '13', b = nc ? '12' : '14';
  return {
    name: nc ? 'Кнопка «Стоп» (НЗ)' : 'Кнопка «Пуск» (НО)', mark: 'SB', cat: 'Коммутация', w: 4.5, h: 8, d: 5, art: 'sb', momentary: true, nc,
    terms: [...tt([a], [0], 8, 1), ...tt([b], [0], 8, -1)], params: {},
    init: () => ({ pressed: false }),
    stamp(c, net, T) { closeIf(net, c.state.pressed !== nc, T(a), T(b)); },
    read: c => [['Контакт', (c.state.pressed !== nc) ? 'замкнут' : 'разомкнут']],
    how: nc ? 'Нормально замкнутый контакт: цепь замкнута, пока кнопку не нажали. Нажми и держи — цепь разорвётся.' : 'Нормально открытый контакт: цепь замыкается только пока кнопка нажата. Нажми и держи мышью.'
  };
}
function meter(kind) {
  const v = kind === 'pv';
  return {
    name: v ? 'Вольтметр' : 'Амперметр', mark: v ? 'PV' : 'PA', cat: 'Измерения', w: 7, h: 8, d: 4, art: 'meas',
    terms: [...tt(['1'], [0], 8, 1), ...tt(['2'], [0], 8, -1)], params: {},
    init: () => ({ val: 0 }),
    stamp(c, net, T) { c._e = net.R(T('1'), T('2'), v ? 1e6 : 0.001); },
    step(c, net, dt, emit, T) { c.state.val = v ? U(net, T, '1', '2') : I(c._e); },
    disp: c => fmt(c.state.val) + (v ? 'В' : 'А'),
    read: c => [[v ? 'Напряжение' : 'Ток', fmt(c.state.val) + (v ? 'В' : 'А')]],
    how: v ? 'Включается <b>параллельно</b> участку. Сопротивление огромное (1 МОм), чтобы не влиять на цепь.' : 'Включается <b>последовательно</b> — в разрыв цепи. Сопротивление почти нулевое. Подключишь параллельно источнику — устроишь КЗ!'
  };
}
function load(kind) {
  const lamp = kind === 'el';
  return {
    name: lamp ? 'Лампа' : kind === 'eh' ? 'ТЭН (нагреватель)' : 'Резистор', mark: lamp ? 'EL' : kind === 'eh' ? 'EK' : 'R', cat: 'Нагрузка', w: lamp ? 6 : 4.5, h: 9, d: 4, art: lamp ? 'el' : 'ohm',
    terms: lamp ? tt(['1', '2'], [-1.5, 1.5], 9, -1) : [...tt(['1'], [0], 9, 1), ...tt(['2'], [0], 9, -1)],
    params: kind === 'r' ? { R: P('Сопротивление', [1, 4.7, 10, 15, 22, 33, 47, 68, 82, 100, 150, 220, 330, 470, 680, 1000, 10000], 100, 'Ом') }
      : { Un: P('Ном. напряжение', [12, 24, 230, 400], 230, 'В'), Pn: P('Мощность', lamp ? [5, 25, 60, 100] : [500, 1000, 2000, 3500, 6000], lamp ? 60 : 2000, 'Вт') },
    init: () => ({ burned: false, u: 0, i: 0, bright: 0 }),
    res: c => kind === 'r' ? c.p.R : c.p.Un * c.p.Un / c.p.Pn,
    stamp(c, net, T) { c._e = c.state.burned ? null : net.R(T('1'), T('2'), this.res(c)); },
    step(c, net, dt, emit, T) {
      const s = c.state; s.u = U(net, T, '1', '2'); s.i = I(c._e);
      if (kind === 'r') { s.bright = Math.min(1, s.u * s.i / 50); return; }
      s.bright = Math.min(1.6, (s.u / c.p.Un) ** 2);
      if (!s.burned && s.u > 1.3 * c.p.Un) { s.burned = true; s.bright = 0; emit('bad', `💥 ${c.label}: рассчитана на ${c.p.Un} В, а подано ${fmt(s.u)}В — перегорела`, 'burn'); }
    },
    click(c) { if (c.state.burned) c.state.burned = false; },
    read(c) { const s = c.state; return [['Напряжение U', fmt(s.u) + 'В'], ['Ток I', fmt(s.i) + 'А'], ['Сопротивление R', fmt(this.res(c)) + 'Ом'], ['Мощность P=U·I', fmt(s.u * s.i) + 'Вт'], ...(s.burned ? [['Состояние', 'СГОРЕЛА (клик — заменить)']] : [])]; },
    how: lamp ? 'Ток нагревает нить (или питает драйвер) — лампа светит. Яркость зависит от мощности P = U²/R. Подашь больше номинала — сгорит, меньше — будет тускло.' : 'Закон Ома: I = U / R. Вся мощность P = I²·R превращается в тепло.'
  };
}

export const DEFS = {
  srcdc: {
    name: 'Источник = тока', mark: 'G', cat: 'Питание', w: 8, h: 8, d: 5, art: 'ohm', src: 'dc',
    terms: tt(['+', '-'], [-2, 2], 8, -1), params: { U: P('Напряжение', [5, 12, 24, 36, 48, 110], 12, 'В'), Rin: P('Внутр. сопротивление', [0.1, 0.5, 1, 2, 4], 0.1, 'Ом') },
    init: () => ({ i: 0 }),
    stamp(c, net, T) { c._e = net.V(T('+'), T('-'), c.p.U, 0, c.p.Rin || 0.1); net.R(T('-'), 0, 1e6); },
    step(c) { c.state.i = I(c._e); },
    read: c => [['ЭДС', c.p.U + ' В'], ['Ток', fmt(c.state.i) + 'А'], ['Отдаваемая мощность', fmt(c.p.U * c.state.i) + 'Вт']],
    how: 'Источник постоянного тока (аккумулятор или блок питания). Электроны текут в одну сторону: условно от «+» к «−».'
  },
  src1: {
    name: 'Сеть 230 В (1 фаза)', mark: 'G', cat: 'Питание', w: 10, h: 8, d: 5, art: 'net', src: 'ac',
    terms: tt(['L', 'N', 'PE'], [-3, 0, 3], 8, -1), params: { net: P('Сеть', ['обычная', 'мощная (рядом ТП)'], 'обычная') },
    init: () => ({ i: 0 }),
    stamp(c, net, T) { c._e = net.V(T('L'), T('N'), 230, 0, c.p.net === 'обычная' ? 0.3 : 0.012); net.R(T('N'), 0, 0.01); net.R(T('PE'), 0, 0.01); },
    step(c) { c.state.i = I(c._e); },
    read: c => [['Напряжение L–N', '230 В ~50 Гц'], ['Ток фазы', fmt(c.state.i) + 'А'], ['Мощность', fmt(230 * c.state.i) + 'ВА']],
    how: 'Однофазный ввод: фаза L (230 В относительно земли), рабочий ноль N и защитный проводник PE. N и PE соединены с землёй на подстанции (система TN-S).'
  },
  src3: {
    name: 'Сеть 0,4 кВ (3 фазы)', mark: 'G', cat: 'Питание', w: 16, h: 8, d: 5, art: 'net', src: 'ac',
    terms: tt(['L1', 'L2', 'L3', 'N', 'PE'], [-6, -3, 0, 3, 6], 8, -1), params: { net: P('Сеть', ['обычная', 'мощная (рядом ТП)'], 'обычная') },
    init: () => ({ i: [0, 0, 0] }),
    stamp(c, net, T) { c._e = ['L1', 'L2', 'L3'].map((l, k) => net.V(T(l), T('N'), 230 * A120[k][0], 230 * A120[k][1], c.p.net === 'обычная' ? 0.05 : 0.012)); net.R(T('N'), 0, 0.01); net.R(T('PE'), 0, 0.01); },
    step(c) { c.state.i = c._e.map(I); },
    read: c => [['Фазное (L–N)', '230 В'], ['Линейное (L–L)', '400 В'], ...c.state.i.map((x, k) => ['Ток L' + (k + 1), fmt(x) + 'А'])],
    how: 'Три фазы сдвинуты на 120°. Между любой фазой и нулём — 230 В (фазное), между двумя фазами — 400 В (линейное = 230·√3). Цвета: L1 жёлтый, L2 зелёный, L3 красный, N синий, PE жёлто-зелёный.'
  },
  src10: {
    name: 'Сеть 10 кВ', mark: 'G', cat: 'Питание', w: 12, h: 8, d: 5, art: 'hv', src: 'ac',
    terms: tt(['A', 'B', 'C'], [-3, 0, 3], 8, -1), params: { U: P('Напряжение', [6, 10], 10, 'кВ') },
    init: () => ({ i: [0, 0, 0] }),
    stamp(c, net, T) { const u = c.p.U * 1000 / Math.sqrt(3); c._e = ['A', 'B', 'C'].map((l, k) => net.V(T(l), 0, u * A120[k][0], u * A120[k][1], 2)); },
    step(c) { c.state.i = c._e.map(I); },
    read: c => [['Линейное', c.p.U + ' кВ'], ...c.state.i.map((x, k) => ['Ток ' + 'ABC'[k], fmt(x) + 'А'])],
    how: 'Высоковольтная распределительная сеть. Чем выше напряжение, тем меньше ток при той же мощности и тем меньше потери в линии. До потребителя напряжение понижает трансформатор 10/0,4 кВ.'
  },
  qf1: breaker(1), qf3: breaker(3), rcd2: rcd(2), rcd4: rcd(4),
  fu: {
    name: 'Предохранитель', mark: 'FU', cat: 'Защита', w: 3, h: 9, d: 5, art: 'fu',
    terms: [...tt(['1'], [0], 9, 1), ...tt(['2'], [0], 9, -1)], params: { In: P('Номинал', [1, 2, 6, 10, 16, 25, 63], 10, 'А') },
    init: () => ({ blown: false, heat: 0, i: 0 }),
    stamp(c, net, T) { c._e = closeIf(net, !c.state.blown, T('1'), T('2')); },
    step(c, net, dt, emit) {
      const s = c.state; if (s.blown) return; s.i = I(c._e); const k = s.i / c.p.In;
      s.heat = Math.max(0, s.heat + (k > 1.3 ? Math.min((k * k - 1) / 20 * dt * 5, 1) : -dt * 0.3));
      if (s.heat >= 1) { s.blown = true; emit('warn', `💨 ${c.label}: плавкая вставка ${c.p.In} А перегорела при токе ${fmt(s.i)}А (клик — заменить)`); }
    },
    click(c) { c.state.blown = false; c.state.heat = 0; },
    read: c => [['Состояние', c.state.blown ? 'ПЕРЕГОРЕЛ' : 'цел'], ['Ток', fmt(c.state.blown ? 0 : c.state.i) + 'А']],
    how: 'Тонкая калиброванная проволочка (плавкая вставка) плавится, когда ток превышает номинал, и разрывает цепь. Одноразовый: после срабатывания вставку меняют.'
  },
  qs3: {
    name: 'Рубильник 3P', mark: 'QS', cat: 'Коммутация', w: 11, h: 12, d: 5, art: 'qs',
    terms: [...tt(['1', '3', '5'], [-3, 0, 3], 12, 1), ...tt(['2', '4', '6'], [-3, 0, 3], 12, -1)], params: {},
    init: () => ({ on: false }),
    stamp(c, net, T) { [['1', '2'], ['3', '4'], ['5', '6']].forEach(([a, b]) => closeIf(net, c.state.on, T(a), T(b))); },
    click: toggle, read: c => [['Положение', c.state.on ? 'ВКЛ' : 'ОТКЛ (видимый разрыв)']],
    how: 'Ножи одновременно замыкают или размыкают все три фазы. Главное назначение — создать <b>видимый разрыв</b> цепи для безопасной работы. Защиты не имеет; отключать под большой нагрузкой нельзя — возникает дуга.'
  },
  sa: {
    name: 'Выключатель', mark: 'SA', cat: 'Коммутация', w: 4.5, h: 8, d: 4, art: 'sb',
    terms: [...tt(['1'], [0], 8, 1), ...tt(['2'], [0], 8, -1)], params: {},
    init: () => ({ on: false }),
    stamp(c, net, T) { closeIf(net, c.state.on, T('1'), T('2')); },
    click: toggle, read: c => [['Положение', c.state.on ? 'ВКЛ' : 'ОТКЛ']],
    how: 'Простейший коммутационный аппарат: контакт замыкает или разрывает один провод. Выключатель всегда ставят в <b>фазу</b>, а не в ноль — иначе на отключённой лампе останется опасный потенциал.'
  },
  sb_no: button(false), sb_nc: button(true),
  km: coilDev({
    name: 'Контактор', mark: 'KM', cat: 'Коммутация', w: 18, h: 10, d: 8, art: 'km',
    terms: [...tt(['A1', '1', '3', '5', '13', '21'], [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5], 10, 1), ...tt(['A2', '2', '4', '6', '14', '22'], [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5], 10, -1)],
    params: { Uc: P('Катушка', [24, 230, 400], 230, 'В') },
    stamp(c, net, T) {
      this.coil(c, net, T); const on = c.state.on;
      c._e = [['1', '2'], ['3', '4'], ['5', '6']].map(([a, b]) => closeIf(net, on, T(a), T(b)));
      closeIf(net, on, T('13'), T('14')); closeIf(net, !on, T('21'), T('22'));
    },
    read: c => [['Катушка A1–A2', fmt(c.state.uc) + 'В'], ['Якорь', c.state.burned ? 'КАТУШКА СГОРЕЛА (клик)' : c.state.on ? 'притянут — контакты замкнуты' : 'отпущен'], ['13–14 (НО)', c.state.on ? 'замкнут' : 'разомкнут'], ['21–22 (НЗ)', c.state.on ? 'разомкнут' : 'замкнут']],
    how: 'Электромагнит: подали напряжение на катушку A1–A2 — якорь притянулся и замкнул три силовых контакта (1-2, 3-4, 5-6). Сняли — пружина разомкнула. Маленький ток кнопки управляет большим током двигателя. Блок-контакты 13-14 (НО) и 21-22 (НЗ) — для самоподхвата и блокировок.'
  }),
  kl: coilDev({
    name: 'Реле промежуточное', mark: 'KL', cat: 'Коммутация', w: 9, h: 9, d: 6, art: 'km',
    terms: [...tt(['A1', '11'], [-3, 1.5], 9, 1), ...tt(['A2', '12', '14'], [-3, 0, 3], 9, -1)],
    params: { Uc: P('Катушка', [12, 24, 230], 24, 'В') },
    stamp(c, net, T) { this.coil(c, net, T); closeIf(net, !c.state.on, T('11'), T('12')); closeIf(net, c.state.on, T('11'), T('14')); },
    read: c => [['Катушка', fmt(c.state.uc) + 'В'], ['Контакт 11', c.state.on ? '→ 14 (сработало)' : '→ 12 (покой)']],
    how: 'Маломощный «младший брат» контактора. Перекидной контакт: общий 11 в покое соединён с 12 (НЗ), при срабатывании — с 14 (НО). Позволяет слабой цепью (например 24 В) управлять другой цепью и развязывать их.'
  }),
  tv: {
    name: 'Трансформатор 1ф', mark: 'TV', cat: 'Преобразование', w: 12, h: 11, d: 8, art: 'tv',
    terms: [...tt(['1', '2'], [-3, 3], 11, 1), ...tt(['3', '4'], [-3, 3], 11, -1)],
    params: { U1: P('Первичная', [230, 400], 230, 'В'), U2: P('Вторичная', [12, 24, 36, 110, 230], 24, 'В'), S: P('Мощность', [60, 250, 1000], 250, 'ВА') },
    init: () => ({ u1: 0, u2: 0, i1: 0, i2: 0, heat: 0, burned: false }),
    stamp(c, net, T) {
      c._e = null; if (c.state.burned) return; const n = c.p.U1 / c.p.U2, a = net.newNode(), b = net.newNode();
      if (c._kind === 'dc') { c._dc = net.R(T('1'), T('2'), 0.02 * c.p.U1 * c.p.U1 / c.p.S); return; } c._dc = null;
      net.R(T('1'), a, 0.02 * c.p.U1 * c.p.U1 / c.p.S); net.R(a, T('2'), 3000, 30000);
      c._e = net.X(a, T('2'), b, T('4'), n); net.R(b, T('3'), 0.02 * c.p.U2 * c.p.U2 / c.p.S);
    },
    step(c, net, dt, emit, T) {
      const s = c.state; if (s.burned) { s.u1 = s.u2 = s.i1 = s.i2 = 0; return; }
      s.u1 = U(net, T, '1', '2'); s.u2 = U(net, T, '3', '4'); s.i1 = I(c._e || c._dc); s.i2 = s.i1 * c.p.U1 / c.p.U2; s.dc = !!c._dc;
      const k = s.i2 / (c.p.S / c.p.U2); s.heat = Math.max(0, s.heat + (k > 1.2 ? Math.min((k * k - 1) / 30, 6) * dt : -dt * 0.1));
      if (s.heat >= 1 || s.u1 > 1.5 * c.p.U1) { s.burned = true; emit('bad', `🔥 ${c.label}: обмотки перегрелись и сгорели (${s.heat >= 1 ? 'перегрузка' : 'перенапряжение'})`, 'burn'); }
    },
    click(c) { if (c.state.burned) { c.state.burned = false; c.state.heat = 0; } },
    read: c => [['U₁', fmt(c.state.u1) + 'В'], ['U₂', fmt(c.state.u2) + 'В'], ['I₁', fmt(c.state.i1) + 'А'], ['I₂', fmt(c.state.i2) + 'А'], ['k = U₁/U₂', (c.p.U1 / c.p.U2).toFixed(2)], ...(c.state.dc ? [['Внимание', 'постоянный ток: потока нет, U₂ = 0']] : []), ...(c.state.burned ? [['Состояние', 'СГОРЕЛ (клик)']] : [])],
    how: 'Две обмотки на общем стальном сердечнике. Переменный ток первичной создаёт переменный магнитный поток, он наводит ЭДС во вторичной. U₁/U₂ = w₁/w₂, а токи — наоборот: I₁/I₂ = w₂/w₁. <b>На постоянном токе не работает</b> — попробуй!'
  },
  tv3: {
    name: 'Трансформатор 10/0,4 кВ', mark: 'T', cat: 'Преобразование', w: 20, h: 14, d: 10, art: 'hv',
    terms: [...tt(['A', 'B', 'C'], [-5, 0, 5], 14, 1), ...tt(['a', 'b', 'c', 'n'], [-6, -2, 2, 6], 14, -1)],
    params: { U1: P('ВН', [6, 10], 10, 'кВ') },
    init: () => ({ u1: 0, u2: 0, i2: 0 }),
    stamp(c, net, T) {
      const n = c.p.U1 * 1000 / 231; c._e = [];
      [['A', 'B', 'a'], ['B', 'C', 'b'], ['C', 'A', 'c']].forEach(([p, q, s]) => { const m = net.newNode(); c._e.push(net.X(T(p), T(q), m, T('n'), n)); net.R(m, T(s), 0.01); net.R(T(p), T(q), 5e5, 5e6); });
    },
    step(c, net, dt, emit, T) { c.state.u1 = U(net, T, 'A', 'B'); c.state.u2 = U(net, T, 'a', 'b'); c.state.i2 = Math.max(...c._e.map(I)) * c.p.U1 * 1000 / 231; },
    read: c => [['ВН (линейное)', fmt(c.state.u1) + 'В'], ['НН (линейное)', fmt(c.state.u2) + 'В'], ['Ток НН', fmt(c.state.i2) + 'А'], ['Схема', 'Δ / Yн']],
    how: 'Силовой трансформатор подстанции. Обмотка ВН соединена треугольником, НН — звездой с выведенной нейтралью n. Нейтраль <b>заземляют</b> — так получается знакомая сеть 0,4 кВ с нулём (TN). Без заземления нейтрали сеть «плавает».'
  },
  vd: {
    name: 'Выпрямитель (мост)', mark: 'VD', cat: 'Преобразование', w: 9, h: 9, d: 5, art: 'vd',
    terms: [...tt(['~1', '~2'], [-2, 2], 9, 1), ...tt(['+', '-'], [-2, 2], 9, -1)],
    params: { sch: P('Схема', ['мост (2 полупериода)', 'один диод (1 полупериод)'], 'мост (2 полупериода)'), C: P('Конденсатор-фильтр', ['нет', 'есть'], 'нет') },
    init: () => ({ vdc: 0, rac: 1e9, uac: 0, idc: 0 }),
    groups: c => [{ t: ['~1', '~2'] }, { t: ['+', '-'], src: 'dc', shape: c.p.C === 'есть' ? 'flt' : c.p.sch[0] === 'м' ? 'full' : 'half' }],
    stamp(c, net, T) { net.R(T('~1'), T('~2'), c.state.rac); c._e = net.V(T('+'), T('-'), c.state.vdc, 0, 0.3); net.R(T('-'), 0, 1e7); },
    step(c, net, dt, emit, T) {
      const s = c.state; s.uac = U(net, T, '~1', '~2'); s.idc = Math.max(0, c._e.i[0]);
      const tgt = Math.max(0, (c.p.C === 'есть' ? 1.41 : c.p.sch[0] === 'м' ? 0.9 : 0.45) * s.uac - (c.p.sch[0] === 'м' ? 1.4 : 0.7));
      s.vdc += (tgt - s.vdc) * 0.5; const p = s.vdc * s.idc + 0.01;
      s.rac = s.uac > 0.1 ? Math.min(1e9, s.uac * s.uac / p) : 1e9;
    },
    read: c => [['Вход ~', fmt(c.state.uac) + 'В'], ['Выход =', fmt(c.state.vdc) + 'В'], ['Ток =', fmt(c.state.idc) + 'А']],
    how: 'Четыре диода пропускают ток только в одну сторону и «переворачивают» отрицательную полуволну. На выходе — пульсирующее постоянное напряжение ≈ 0,9·U~. С конденсатором пульсации сглаживаются и напряжение растёт до ≈ 1,41·U~.'
  },
  el: load('el'), r: load('r'), eh: load('eh'),
  m3: {
    name: 'Электродвигатель 3ф', mark: 'M', cat: 'Нагрузка', w: 18, h: 15, d: 12, art: 'm3',
    terms: tt(['U', 'V', 'W', 'PE'], [-4.5, -1.5, 1.5, 6], 15, 1),
    params: { Pn: P('Мощность', [0.75, 1.5, 4, 7.5, 15], 1.5, 'кВт'), load: P('Нагрузка на валу', ['номинальная', 'перегруз ×1,5', 'заклинен'], 'номинальная'), fault: P('Пробой на корпус', ['нет', 'есть'], 'нет') },
    init: () => ({ speed: 0, heat: 0, burned: false, i: [0, 0, 0], ang: 0 }),
    In: c => c.p.Pn * 1000 / (0.8 * 0.85) / (Math.sqrt(3) * 400),
    stamp(c, net, T) {
      const z = 230 / this.In(c) / (1 + 5 * (1 - Math.min(1, Math.abs(c.state.speed)))) / (c.p.load === 'перегруз ×1,5' ? 1.5 : 1), st = net.newNode();
      c._e = c.state.burned ? [] : ['U', 'V', 'W'].map(t => net.R(T(t), st, z * 0.8, z * 0.6));
      if (c.p.fault === 'есть') net.R(T('U'), T('PE'), 20);
    },
    step(c, net, dt, emit, T) {
      const s = c.state, v = ['U', 'V', 'W'].map(t => net.v(T(t)));
      const mr = (v[0][0] + v[1][0] + v[2][0]) / 3, mi = (v[0][1] + v[1][1] + v[2][1]) / 3;
      let pr = 0, pi = 0, nr = 0, ni = 0;
      v.forEach((x, k) => { const r = x[0] - mr, i = x[1] - mi, a = A120[(3 - k) % 3], b = A120[k];
        pr += r * a[0] - i * a[1]; pi += r * a[1] + i * a[0]; nr += r * b[0] - i * b[1]; ni += r * b[1] + i * b[0]; });
      let tgt = s.burned ? 0 : (Math.hypot(pr, pi) - Math.hypot(nr, ni)) / 3 / 230;
      if (Math.abs(tgt) < 0.4 || c.p.load === 'заклинен' || (Math.abs(s.speed) < 0.5 && Math.abs(tgt) < 0.7)) tgt = 0; tgt = Math.max(-1.05, Math.min(1.05, tgt));
      s.speed += (tgt - s.speed) * Math.min(1, dt / 0.7); if (Math.abs(s.speed) < 0.01) s.speed = 0;
      s.i = c._e.map(I); const im = Math.max(0, ...s.i), k = im / this.In(c);
      s.stall = !s.burned && im > 0.2 && Math.abs(s.speed) < 0.2 && tgt === 0;
      s.heat = Math.max(0, s.heat + (k > 1.15 ? (k * k - 1.2) / 150 : -0.03) * dt);
      if (s.heat >= 1 && !s.burned) { s.burned = true; emit('bad', `🔥 ${c.label}: обмотки сгорели — ${c.p.load === 'заклинен' ? 'вал заклинен, двигатель стоял под током' : s.stall ? 'двигатель стоял под током (нет фазы?)' : 'длительная перегрузка'}. Ток был ${fmt(im)}А при номинале ${fmt(this.In(c))}А`, 'burn'); }
    },
    click(c) { if (c.state.burned) { c.state.burned = false; c.state.heat = 0; } },
    read(c) { const s = c.state; return [['Обороты', Math.round(s.speed * 1450) + ' об/мин'], ['Вращение', s.speed > 0.05 ? 'по часовой ↻' : s.speed < -0.05 ? 'против часовой ↺' : s.stall ? 'СТОИТ и гудит!' : 'стоит'], ...s.i.map((x, k) => ['Ток ' + 'UVW'[k], fmt(x) + 'А']), ['Номинальный ток', fmt(this.In(c)) + 'А'], ['Нагрев обмоток', Math.round(s.heat * 100) + ' %'], ...(s.burned ? [['Состояние', 'СГОРЕЛ (клик — починить)']] : [])]; },
    how: 'Три обмотки статора, питаемые тремя фазами со сдвигом 120°, создают <b>вращающееся магнитное поле</b>. Оно увлекает за собой ротор. Поменяешь местами любые две фазы — поле и ротор закрутятся в обратную сторону. Пусковой ток в 5–7 раз больше номинального. Пропала фаза — мотор гудит и горит.'
  },
  pa: meter('pa'), pv: meter('pv'),
  mm: {
    name: 'Мультиметр', mark: 'P', cat: 'Измерения', w: 8, h: 13, d: 3.5, art: 'meas',
    terms: tt(['COM', 'VΩ'], [-2, 2], 13, -1), params: { mode: P('Режим', ['V', 'A'], 'V') },
    init: () => ({ val: 0, blown: false }),
    stamp(c, net, T) { c._e = (c.p.mode === 'A' && c.state.blown) ? null : net.R(T('COM'), T('VΩ'), c.p.mode === 'V' ? 1e7 : 0.01); },
    step(c, net, dt, emit, T) {
      const s = c.state; s.val = c.p.mode === 'V' ? U(net, T, 'COM', 'VΩ') : I(c._e);
      if (c.p.mode === 'A' && s.val > 10 && !s.blown) { s.blown = true; emit('bad', `💥 ${c.label}: в режиме амперметра прибор — почти перемычка. Через него пошло ${fmt(s.val)}А, предохранитель прибора сгорел. Ток меряют ТОЛЬКО в разрыв цепи!`, 'short'); }
    },
    click(c, act) { if (c.state.blown) c.state.blown = false; else c.p.mode = c.p.mode === 'V' ? 'A' : 'V'; },
    disp: c => c.state.blown ? 'FUSE' : fmt(c.state.val) + (c.p.mode === 'V' ? 'В' : 'А'),
    read: c => [['Режим', c.p.mode === 'V' ? 'вольтметр' : 'амперметр'], ['Показание', fmt(c.state.val) + (c.p.mode === 'V' ? 'В' : 'А')]],
    how: 'Универсальный прибор. Режим <b>V</b>: щупы параллельно участку, сопротивление 10 МОм. Режим <b>A</b>: щупы в разрыв цепи, сопротивление почти ноль. Клик по прибору переключает режим.'
  },
  pi: {
    name: 'Счётчик 1ф', mark: 'PI', cat: 'Измерения', w: 12, h: 13, d: 6, art: 'pi',
    terms: tt(['1', '2', '3', '4'], [-4.5, -1.5, 1.5, 4.5], 13, -1), params: {},
    init: () => ({ p: 0, kwh: 0 }),
    stamp(c, net, T) { c._e = net.R(T('1'), T('2'), 0.002); net.R(T('3'), T('4'), 0.002); },
    step(c, net, dt, emit, T) { const u = net.u(T('1'), T('3')), i = c._e.i; c.state.p = u[0] * i[0] + u[1] * i[1]; c.state.kwh += Math.abs(c.state.p) * dt / 3600 / 1000 * 600; },
    disp: c => c.state.kwh.toFixed(2) + ' кВт·ч',
    read: c => [['Активная мощность', fmt(c.state.p) + 'Вт'], ['Энергия', c.state.kwh.toFixed(3) + ' кВт·ч'], ['Ускорение времени', '1 с = 10 мин']],
    how: 'Выводы: 1 — фаза вход, 2 — фаза выход, 3 — ноль вход, 4 — ноль выход. Внутри измеряется ток (последовательно) и напряжение (параллельно), перемножается — получается мощность P = U·I·cosφ, она накапливается во времени: энергия W = P·t.'
  },
  pe: {
    name: 'Заземление', mark: 'PE', cat: 'Защита', w: 6, h: 6, d: 3, art: 'net',
    terms: tt(['1'], [0], 6, 1), params: {}, init: () => ({ i: 0 }),
    stamp(c, net, T) { c._e = net.R(T('1'), 0, 0.5); }, step(c) { c.state.i = I(c._e); },
    read: c => [['Ток в землю', fmt(c.state.i) + 'А']],
    how: 'Соединение с землёй (заземлитель). Потенциал земли принят за ноль. Корпуса оборудования заземляют, чтобы при пробое изоляции ток ушёл в землю и защита отключила питание.'
  },
  hum: {
    name: 'Человек', mark: 'Чел', cat: 'Защита', w: 7, h: 16, d: 4, art: 'rcd',
    terms: tt(['рука'], [0], 16, 1), params: {}, init: () => ({ touch: false, i: 0, t: 0 }),
    stamp(c, net, T) { c._e = c.state.touch ? net.R(T('рука'), 0, 1000) : null; },
    step(c, net, dt, emit) {
      const s = c.state, was = s.i; s.i = I(c._e);
      if (s.i > 0.005 && was <= 0.005) emit('bad', `☠ Человек под напряжением! Через тело идёт ${fmt(s.i)}А (опасно уже от 30 мА)`);
      s.t = s.i > 0.03 ? s.t + dt : 0; if (s.t > 1.5 && !s.dead) { s.dead = true; emit('bad', '☠ Ток через человека держится дольше секунды — фибрилляция сердца. Нужно УЗО!', 'fail'); }
    },
    click(c) { c.state.touch = !c.state.touch; if (!c.state.touch) c.state.dead = false; },
    read: c => [['Касание', c.state.touch ? 'КАСАЕТСЯ провода' : 'не касается (клик)'], ['Ток через тело', fmt(c.state.i) + 'А']],
    how: 'Тело человека ≈ 1 кОм, он стоит на земле. Коснётся фазы 230 В — пойдёт ток I = 230/1000 = 0,23 А, это смертельно. Автомат на 16 А такой ток не заметит. Спасает только УЗО. Кликни по человеку, чтобы он коснулся провода.'
  },
};

export const CATS = ['Питание', 'Коммутация', 'Защита', 'Нагрузка', 'Преобразование', 'Измерения'];
export function termPos(c, tn) { const t = DEFS[c.type].terms.find(t => t.n === tn); return t ? { x: c.x + t.x, y: c.y + t.y, s: t.s } : { x: c.x, y: c.y, s: 1 }; }
export function newComp(type, id, x, y, p = {}) {
  const d = DEFS[type], pp = {}; for (const k in d.params) pp[k] = d.params[k].def;
  return { id, type, x, y, p: { ...pp, ...p }, state: d.init(), label: d.mark + id.replace(/\D/g, '') };
}
