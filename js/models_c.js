// 3D-модели дополнительных устройств + подписи деталей (TAGS) для режима «Как устроено»
import * as THREE from 'three';
import { mat, COL, MET, box, cyl, torus, coil, plate, display } from './m3d.js';
import { lever } from './models_a.js';
import { MODELS_B } from './models_b.js';

const lerp = (a, b, k) => a + (b - a) * k;
const hot = new THREE.Color(0xff3300), cold = new THREE.Color(COL.steel);
const LENS = { 'зелёная': 0x22cc44, 'красная': 0xee2222, 'жёлтая': 0xffcc00 };

export const MODELS_C = {
  m6: MODELS_B.m3,
  hl(k, c) {
    k.modular(0x2b3138).terms(k.d + 0.03); k.g.add(plate(c.label, 2.6, 0.9, 0, 2, k.d + 0.03, { fg: '#fff' }));
    const col = LENS[c.p.color], m = mat(col, { emissive: col, emissiveIntensity: 0, transparent: true, opacity: 0.85 });
    k.add(cyl(1.5, 1.2, m, 0, -0.3, k.d + 0.6), 'toggle'); k.add(cyl(1.75, 0.5, MET.steel, 0, -0.3, k.d + 0.25));
    const halo = k.add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))); halo.position.set(0, -0.3, k.d + 1); halo.raycast = () => { };
    return c => { const b = Math.min(1, c.state.bright); m.emissiveIntensity = b * 2; m.color.set(c.state.burned ? 0x222222 : col); halo.material.opacity = b * 0.35; };
  },
  sa2(k, c) {
    k.modular().terms().label(2.3);
    const r = k.add(box(3, 2.6, 0.8, mat(0xf8f8f8), 0, -0.3, k.d + 0.3), 'toggle');
    const z = k.d * 0.5, arm = new THREE.Group(); arm.position.set(0, 2, z); arm.add(box(0.3, 4, 0.3, MET.copper, 0, -2, 0)); k.in(arm);
    k.in(box(0.6, 0.5, 0.6, MET.brass, 0, 2.2, z)); [-1.5, 1.5].forEach(x => k.in(box(0.6, 0.5, 0.6, MET.brass, x, -2.1, z)));
    return c => { r.rotation.y = lerp(r.rotation.y, c.state.pos ? 0.25 : -0.25, 0.4); arm.rotation.z = lerp(arm.rotation.z, c.state.pos ? 0.36 : -0.36, 0.4); };
  },
  qfd(k, c) {
    k.modular().terms().label(2.1); const lv = lever(k, -1.2, 2.2), z = k.d * 0.45;
    k.add(box(1.2, 0.9, 0.5, mat(COL.yellow), 1.9, 0.3, k.d + 0.2), 'test'); k.g.add(plate('T', 0.7, 0.6, 1.9, 0.3, k.d + 0.47, { fg: '#000' }));
    k.g.add(plate('C' + c.p.In + ' ' + c.p.Id + 'мА', 4.6, 0.8, 0, -2.3, k.d + 0.03, { fg: '#111' }));
    const cm = mat(COL.copper, { emissive: 0 }); k.in(coil(0.5, 0.13, 6, cm, -1.5, 2.3, z));
    const bm = new THREE.Group(); bm.position.set(-1.5, -0.4, z); const strip = box(0.5, 2, 0.12, mat(COL.steel), 0, 1, 0); bm.add(strip); k.in(bm);
    const ring = k.in(torus(1.3, 0.4, mat(COL.core, { emissive: 0 }), 0.6, -2.3, z)); ring.rotation.x = Math.PI / 2;
    k.in(cyl(0.15, 2.6, MET.copper, 0.3, -2.3, z, 'y')); k.in(cyl(0.15, 2.6, mat(COL.blue), 0.9, -2.3, z, 'y'));
    return c => { const s = c.state; lv(s.on); bm.rotation.x = s.heat * 0.45; strip.material.color.copy(cold).lerp(hot, Math.min(1, s.heat)); cm.emissive.setHex(s.trip === 'em' ? 0xff8800 : 0); const a = s.trip === 'd' ? 1 : Math.min(1, s.d / (c.p.Id / 1000)); ring.material.emissive.setRGB(a * 0.9, a * 0.3, 0); };
  },
  kk(k, c) {
    k.modular(0xdfe3e7).terms().label(2.2);
    k.g.add(plate(c.p.Iset + ' А', 2.6, 0.9, -4.5, -2.2, k.d + 0.03, { fg: '#111' }));
    k.add(cyl(1, 0.4, mat(0x2a66d6), -4.5, 0, k.d + 0.15));                                              // регулятор уставки
    const rst = k.add(cyl(0.8, 0.8, mat(0x2a66d6), 3, 0, k.d + 0.35), 'toggle'); const ind = k.add(box(1.4, 0.7, 0.1, mat(COL.green), 6, 0, k.d + 0.05));
    const z = k.d * 0.45, strips = [];
    for (const x of [-6, -3, 0]) {
      const g = new THREE.Group(); g.position.set(x, -2.6, z); const s = box(0.6, 5, 0.14, mat(COL.steel, { emissive: 0xff2200, emissiveIntensity: 0 }), 0, 2.5, 0); g.add(s); k.in(g); strips.push([g, s]);
      k.in(coil(0.5, 0.09, 9, MET.copper, x, 0, z + 0.05));                                               // нагреватель вокруг пластины
    }
    const bar = k.in(box(8.4, 0.5, 0.5, mat(0x222a33), -2.4, 2.2, z + 0.5));                              // общая рейка-толкатель
    const arm = new THREE.Group(); arm.position.set(3, -2.4, z + 0.5); arm.add(box(0.3, 4.6, 0.3, MET.copper, 0, 2.3, 0)); k.in(arm);
    k.in(box(0.6, 0.5, 0.6, MET.brass, 3, 2.2, z + 0.5)); k.in(box(0.6, 0.5, 0.6, MET.brass, 6, 2.2, z + 0.5));
    return c => {
      const s = c.state, h = Math.min(1, s.heat);
      strips.forEach(([g, m]) => { g.rotation.z = -h * 0.16; m.material.color.copy(cold).lerp(hot, h); m.material.emissiveIntensity = h * 0.7; });
      bar.position.x = -2.4 + h * 0.75; arm.rotation.z = lerp(arm.rotation.z, s.trip ? -0.55 : 0, 0.4);
      ind.material.color.set(s.trip ? COL.red : COL.green); rst.position.z = k.d + (s.trip ? 0.7 : 0.35);
    };
  },
  kt(k, c) {
    k.modular(0x8fb8a8).terms().label(2.2);
    const d = k.add(display(4.4, 1.5, 0.8, 0.1, k.d + 0.04, { fg: '#ffb020', bg: '#1a1205' }));
    k.g.add(plate('⏱ ' + c.p.Uc + 'В', 3.4, 0.8, 0, -2, k.d + 0.03, { fg: '#111' }));
    const z = k.d * 0.5, cm = mat(COL.copper, { emissive: 0 });
    k.in(box(3, 2.4, 0.3, mat(0x1c6b3a), -2.6, 1.4, z)); k.in(box(0.9, 0.9, 0.5, mat(0x111111), -2.6, 1.4, z + 0.4));   // плата с таймером
    k.in(coil(0.7, 0.14, 6, cm, -3, -1.6, z)); const arm = new THREE.Group(); arm.position.set(1.5, 2.6, z); arm.add(box(0.3, 4.6, 0.5, MET.copper, 0, -2.3, 0)); k.in(arm);
    k.in(box(0.6, 0.5, 0.6, MET.brass, 0.4, -2.4, z)); k.in(box(0.6, 0.5, 0.6, MET.brass, 2.6, -2.4, z));
    return c => { const s = c.state; d.userData.draw(k.def.disp(c)); arm.rotation.z = lerp(arm.rotation.z, s.on ? 0.22 : -0.22, 0.4); cm.emissive.setRGB(s.on ? 0.9 : 0, s.on ? 0.35 : 0, 0); };
  },
};

// Подписи деталей: [текст, x, y, z] в координатах устройства
const QF = x => [['Катушка: мгновенно отключает при КЗ', x, 2.2, 2.9], ['Биметалл: гнётся от нагрева при перегрузке', x, -2.6, 2.9], ['Дугогасительная решётка', x, -0.9, 2.3], ['Подвижный контакт', x, 0.8, 4.3], ['Рычаг взвода', 0, 0, 8]];
const RCD = w => [['Кольцо: «сравнивает» ток туда и обратно', 0, -1.3, 2.9], ['Обмотка управления', 1.6, -1.3, 3.6], ['Реле-расцепитель', 2.2, 1.6, 2.9], ['Кнопка «Тест»', w / 2 - 1.5, 0.3, 7]];
const MOT = [['Обмотки статора (3 фазы)', 0, 2.4, 5], ['Ротор «беличья клетка»', 0, -1.8, 8.6], ['Вращающееся магнитное поле', 2.5, -4, 9.9], ['Клеммная коробка', 0, 6, 4], ['Вал', 0, -1.8, 12]];
export const TAGS = {
  qf1: QF(0), qf3: QF(-3), rcd2: RCD(6), rcd4: RCD(12),
  qfd: [['Катушка (КЗ)', -1.5, 2.3, 2.9], ['Биметалл (перегрузка)', -1.5, 0.6, 2.9], ['Кольцо (утечка)', 0.6, -2.3, 2.9]],
  fu: [['Плавкая вставка', 0, -0.4, 3.2], ['Индикатор срабатывания', 0, -0.4, 6.5]],
  qs3: [['Нож', -3, 0.5, 1.8], ['Губки (неподвижный контакт)', -3, 3.4, 2.2], ['Рукоятка', 0, 1.6, 4.5], ['Шарнир', 3, -3.4, 2.2]],
  sa: [['Подвижный контакт', 0, 0, 2], ['Клавиша', 0, -0.3, 4.6]], sa2: [['Перекидной контакт', 0, 0, 2], ['Общий вывод L', 0, 2.2, 2], ['Выводы 1 и 2', 1.5, -2.1, 2]],
  sb_no: [['Контактный мостик', 0, 0, 2.3], ['Толкатель с пружиной', 0, -0.3, 5.7]], sb_nc: [['Контактный мостик', 0, 0, 2.3], ['Толкатель с пружиной', 0, -0.3, 5.7]],
  km: [['Катушка A1–A2', -1.5, 0.9, 3.3], ['Неподвижный сердечник', -4.5, 0, 1.6], ['Якорь (притягивается)', -1.5, -0.6, 5.4], ['Силовые контакты', 1.5, 2.7, 5.4], ['Блок-контакт 13–14 (НО)', 4.5, 2.7, 5.4], ['Блок-контакт 21–22 (НЗ)', 7.5, -2.7, 5.4]],
  kl: [['Катушка', -3, 0, 3], ['Перекидной контакт 11', 1.5, 0.5, 3], ['12 (НЗ) и 14 (НО)', 1.5, -2.4, 3]],
  kt: [['Электронный таймер', -2.6, 1.4, 3.5], ['Выходное реле', -3, -1.6, 3], ['Контакт 15–16/18', 1.5, 0, 3]],
  kk: [['Биметаллические пластины (по одной на фазу)', -6, 1.4, 2.9], ['Нагреватель', -3, 0, 3.2], ['Рейка-толкатель', -2.4, 2.2, 3.6], ['Контакт 95–96 (в цепь катушки)', 3, 0, 3.5], ['Кнопка возврата', 3, 0, 7.3], ['Уставка тока', -4.5, 0, 6.8]],
  tv: [['Первичная обмотка', 0, 2.2, 5.9], ['Вторичная обмотка', 0, -2.2, 5.9], ['Сердечник: замыкает магнитный поток', 3.8, 0, 5.6]],
  tv3: [['Обмотка ВН снаружи, НН внутри', -5, -0.4, 6.9], ['Магнитопровод', 0, 2.9, 5.9], ['Ввод 10 кВ', -5, 5, 5], ['Вывод нейтрали n', 6, -5, 5], ['Бак с маслом и радиаторы', 6.5, -0.4, 10]],
  vd: [['Диоды: ток только в одну сторону', -1.2, 1.2, 2.6], ['Конденсатор-фильтр', 0, -1.3, 6.5]],
  el: [['Нить накала', 0, 2, 3], ['Колба', 1.8, 3.2, 3], ['Цоколь', 0, -0.6, 3]], hl: [['Светодиод с резистором', 0, -0.3, 6]],
  r: [['Резистивный слой', 0, 0, 3.7]], eh: [['Спираль в трубке с изолятором', 0.9, 0.3, 3]],
  m3: MOT, m6: [...MOT.slice(0, 3), ['Начала U1 V1 W1', -6, 6, 4], ['Концы W2 U2 V2', 4.5, 6, 4]],
  mm: [['Переключатель режима', 0, -0.4, 4.3], ['Щупы', 0, -5.6, 3.8]], pi: [['Диск: вращается пропорционально мощности', 0, 0.3, 5.4], ['Счётный механизм', 0, 2.6, 6]],
  pe: [['Шина заземления', 0, -0.6, 2.1]], hum: [['Тело ≈ 1000 Ом', 0, -1, 2.4], ['Ноги на земле', 0, -7, 2.2]],
};
