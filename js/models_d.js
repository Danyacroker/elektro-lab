// 3D-модели бытовой электрики + их условные обозначения на схеме + подписи деталей
import * as THREE from 'three';
import { mat, COL, MET, box, cyl, torus, sphere, coil, plate } from './m3d.js';
import { TAGS } from './models_c.js';
import { SYM, ln, tx, rc, ci, boxSym, T, DASH } from './schematic.js';
import { fmt } from './sim.js';

const lerp = (a, b, k) => a + (b - a) * k;
const glow = (c, e = 0xff5500) => mat(c, { emissive: e, emissiveIntensity: 0 });
// форма сигнала для осциллографа: x — доля экрана (два периода сети), результат −1…1
export const wave = (shape, x) => {
  const th = x * 4 * Math.PI, s = Math.sin(th);
  return shape === 'sine' ? s : shape === 'half' ? Math.max(0, s) : shape === 'full' ? Math.abs(s) : shape === 'flt' ? 1 - 0.13 * ((x * 4) % 1) : shape === 'flat' ? 0.8
    : shape === 'six' ? Math.max(Math.abs(s), Math.abs(Math.sin(th + 1.047)), Math.abs(Math.sin(th + 2.094))) : 0;
};
function spark(k, x, y, z) { const m = sphere(0.7, new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0 }), x, y, z); m.raycast = () => { }; k.g.add(m); return (on, t) => { m.material.opacity = on ? 0.4 + 0.6 * Math.abs(Math.sin(t * 37)) : 0; m.scale.setScalar(on ? 0.7 + Math.abs(Math.sin(t * 53)) : 1); }; }

function appliance(mw) {
  return (k, c) => {
    k.zt = 3; const body = mat(mw ? 0xd8dadd : 0xf4f4f4, { emissive: 0x550000, emissiveIntensity: 0 });
    k.shell(box(k.w - 0.4, 8.6, k.d, body, 0, -1.4, k.d / 2)); k.shell(box(k.w - 3, 2.6, 3, mat(0x2b3138), 0, 5, 1.5));   // корпус и «вилка» сверху
    k.terms(3.03); const zf = k.d + 0.03, kind = mw ? 'СВЧ' : c.p.kind.split(' ')[0];
    k.g.add(plate(c.label + ' ' + kind, k.w - 1.5, 1, 0, 2.1, zf, { fg: '#0a2a66', font: 'bold 30px Arial' }));
    const led = k.add(sphere(0.4, glow(0x224422, 0x33ff66), k.w / 2 - 1.4, -4.6, k.d), 'toggle'); k.add(cyl(0.9, 0.5, mat(0x2a66d6), -k.w / 2 + 1.6, -4.6, k.d + 0.2), 'toggle');
    const sp = spark(k, -3, 1.6, k.d * 0.5); let upd;
    if (mw) {
      const win = k.add(box(7, 4.6, 0.1, glow(0x1a1a1a, 0xffb040), -2, -1.4, zf));
      k.in(box(3, 2.6, 2.6, mat(COL.core), 4, -3.6, 2)); k.in(coil(1.1, 0.14, 6, MET.copper, 3.2, -3.6, 3.6, 'z')); k.in(coil(1.1, 0.07, 12, mat(0xb5522a), 4.8, -3.6, 3.6, 'z'));   // трансформатор
      k.in(cyl(0.9, 2.4, mat(0x8a8f96), 4.6, -0.4, 2.2, 'x')); const dm = glow(0x15181c, 0xff2200); k.in(cyl(0.35, 1.6, dm, 2.6, -0.4, 4.4, 'x'));                     // конденсатор и ВВ-диод
      const mg = glow(0x555b62, 0xff7700); k.in(cyl(1.3, 2.2, mg, 3.6, 2.2, 3, 'y')); for (let i = 0; i < 5; i++) k.in(box(3.4, 0.08, 3, MET.steel, 3.6, 1.4 + i * 0.4, 3));  // магнетрон с рёбрами
      const dish = k.in(cyl(2.6, 0.2, mat(0xcfe6ee, { transparent: true, opacity: 0.7 }), -2, -3.6, 4, 'y'));
      upd = (run, t) => { win.material.emissiveIntensity = run ? 0.8 : 0; mg.emissiveIntensity = run ? 0.6 + 0.3 * Math.sin(t * 9) : 0; dm.emissiveIntensity = run && Math.sin(t * 6) > 0 ? 1 : 0; if (run) dish.rotation.y = t; };
    } else {
      const he = glow(0x777f88, 0xff3a00), rot = new THREE.Group(); rot.position.set(0, -2, k.d * 0.5); k.in(rot);
      if (/чайник|обогрев/.test(c.p.kind)) { k.in(torus(2.4, 0.35, he, 0, -3.6, k.d * 0.5)).rotation.x = Math.PI / 2; }
      else { rot.add(cyl(1.8, 4, mat(0x8a929a), 0, 0, 0)); for (let i = 0; i < 6; i++) rot.add(box(0.3, 0.3, 4.1, MET.copper, Math.cos(i) * 1.8, Math.sin(i) * 1.8, 0)); k.in(torus(2.6, 0.5, mat(COL.copper), 0, -2, k.d * 0.5)); }
      upd = (run, t, dt, s) => { he.emissiveIntensity = run ? 1.1 : 0; if (run) rot.rotation.z -= dt * (s.k > 1 ? 5 : 14); };
    }
    return (c, t, dt) => { const s = c.state, run = s.on && s.u > 100 && !s.burned; led.material.emissiveIntensity = run ? 1.5 : 0; upd(run, t, dt, s); sp(c.p.fault !== 'нет' && s.u > 50, t); body.color.set(s.burned ? 0x2a2a2a : mw ? 0xd8dadd : 0xf4f4f4); body.emissiveIntensity = s.uc > 50 ? 0.5 + 0.5 * Math.sin(t * 8) : 0; };
  };
}

export const MODELS_D = {
  xs(k, c) {
    k.zt = 2.2; const pl = mat(0xf2f2f2, { emissive: 0xff2200, emissiveIntensity: 0 }); k.shell(box(k.w - 0.3, k.h, 2.2, pl, 0, 0, 1.1)); k.terms(2.23);
    k.g.add(cyl(2.7, 0.5, mat(0xe2e2e2), 0, 0.2, 2.3)); k.g.add(cyl(2.3, 0.3, mat(0xbfc5ca), 0, 0.2, 2.5)); [-1, 1].forEach(x => k.g.add(cyl(0.35, 0.4, mat(0x111111), x, 0.2, 2.6)));
    [1, -1].forEach(s => k.g.add(box(0.5, 0.7, 0.3, MET.brass, 0, 0.2 + s * 2.2, 2.6)));                                  // заземляющие скобы
    k.g.add(plate(c.label, 2.4, 0.8, 3, 0.2, 2.23, { fg: '#0a2a66' }));
    const lm = glow(COL.brass, 0xff3300); k.in(box(0.5, 6.4, 0.3, lm, -3, 0, 1)); k.in(box(0.5, 6.4, 0.3, MET.brass, 0, 0, 1)); k.in(box(0.5, 6.4, 0.3, mat(0x9acd32), 3, 0, 1));
    k.in(box(2.4, 0.4, 0.3, lm, -2, 0.2, 1.3)); const sp = spark(k, -3, 3, 2.4);
    return (c, t) => { const s = c.state, h = Math.min(1, s.heat); lm.emissiveIntensity = h * 1.5; pl.emissiveIntensity = h * 0.6; pl.color.set(s.burned ? 0x2b2420 : 0xf2f2f2); sp(c.p.contact !== 'затянуты' && s.i > 1 && !s.burned, t); };
  },
  app: appliance(false), mw: appliance(true),
  psu(k, c) {
    k.zt = k.d * 0.55; k.modular(0x9aa3ab).terms(k.d + 0.03); k.g.add(plate(c.label, 2.4, 0.9, -3, 0, k.d + 0.03, { fg: '#111' })); k.g.add(plate('~230 → =' + c.p.Uo + 'В', 5, 0.9, 1.4, 0, k.d + 0.03, { fg: '#111', font: 'bold 34px Arial' }));
    const led = k.add(sphere(0.3, glow(0x113311, 0x33ff66), 4.2, -2.2, k.d)), z = k.d * 0.45;
    k.in(box(9.6, 6.4, 0.2, mat(0x1c6b3a), 0, 0, 0.6));                                                     // плата
    const br = glow(0x15181c, 0xff2200); k.in(box(1.6, 1.2, 1.2, br, -3.4, 2.2, z));                          // диодный мост
    const cap = glow(0x1d2f66, 0x3aa0ff); k.in(cyl(1, 2.4, cap, -1, 2, z + 0.6));                              // конденсатор 325 В
    const sw = glow(0x111111, 0xff7700); k.in(box(1, 1.6, 0.5, sw, 1.4, 2.2, z)); k.in(box(1.6, 2.2, 1.4, MET.steel, 2.6, 2.2, z));   // ключ на радиаторе
    const tr = glow(0xd9b020, 0xffdd55); k.in(box(2.2, 2.2, 2, tr, 2.2, -0.9, z)); k.in(coil(0.9, 0.12, 5, MET.copper, 2.2, -0.9, z + 1.2, 'z'));  // ВЧ-трансформатор
    const dz = glow(0x15181c, 0xff2200); k.in(cyl(0.4, 1.4, dz, -0.2, -2.2, z, 'x')); k.in(cyl(0.7, 1.8, mat(0x1d2f66), -2.2, -2.2, z + 0.4)); k.in(box(0.9, 0.6, 0.5, mat(0xeeeeee), -3.8, -0.4, z));
    return (c, t) => { const s = c.state, on = s.uac > 90, out = s.vdc > 1; led.material.emissiveIntensity = out ? 1.5 : 0; br.emissiveIntensity = on ? 0.6 : 0; cap.emissiveIntensity = on ? 0.8 : 0; const f = out ? (Math.sin(t * 40) > 0 ? 1 : 0) : 0; sw.emissiveIntensity = f; tr.emissiveIntensity = f * 0.7; dz.emissiveIntensity = out ? 1 - f : 0; };
  },
  vd3(k, c) {
    k.modular(0x2b3138).terms(k.d + 0.03); k.g.add(plate(c.label, 2.6, 0.9, 0, 1.9, k.d + 0.03, { fg: '#fff' })); k.g.add(plate('3~ ⟶ =', 3.8, 1, 0, 0.3, k.d + 0.03, { fg: '#ffd23f' }));
    const z = k.d * 0.5, dm = []; [-3, 0, 3].forEach(x => [1.3, -1.3].forEach(y => { const m = glow(0x15181c, 0xff2200); dm.push(m); const d = k.in(cyl(0.45, 1.6, m, x, y, z, 'y')); d.add(cyl(0.47, 0.25, MET.steel, 0, 0.5, 0, 'y')); }));
    return (c, t) => { const on = c.state.idc > 0.001, ph = Math.floor(t * 6) % 6; dm.forEach((m, i) => m.emissiveIntensity = on && (i === [0, 0, 2, 2, 4, 4][ph] || i === [3, 5, 5, 1, 1, 3][ph]) ? 0.95 : 0); };
  },
  osc(k, c) {
    k.plain(0x2b3138, k.d).terms(k.d + 0.03); k.g.add(plate(c.label, 2.4, 0.8, -5, 5.2, k.d + 0.03, { fg: '#ddd' }));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 150; const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.4), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(-1.2, 1.2, k.d + 0.04); k.g.add(scr);
    [3, 1, -1].forEach(y => k.g.add(cyl(0.6, 0.5, mat(0x555b62), 5.9, y + 1, k.d + 0.2)));
    let last = -1;
    return (c, t) => {
      if (t - last < 0.08) return; last = t; const s = c.state, ac = s.shape === 'sine', y0 = ac ? 75 : 125, amp = ac ? 55 : 95, ph = (t * 0.25) % 1;
      g.fillStyle = '#04140a'; g.fillRect(0, 0, 256, 150); g.strokeStyle = '#124a26'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= 256; x += 32) { g.moveTo(x, 0); g.lineTo(x, 150); } for (let y = 0; y <= 150; y += 25) { g.moveTo(0, y); g.lineTo(256, y); } g.stroke();
      g.strokeStyle = '#2f8a4c'; g.beginPath(); g.moveTo(0, y0); g.lineTo(256, y0); g.stroke();
      g.strokeStyle = '#7dff9b'; g.lineWidth = 2.5; g.beginPath(); for (let x = 0; x <= 256; x += 2) { const y = y0 - amp * wave(s.shape, x / 256 + ph); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.fillStyle = '#7dff9b'; g.font = 'bold 15px Consolas'; g.fillText(s.shape === 'none' ? 'нет сигнала' : fmt(s.u) + 'В', 6, 16); tex.needsUpdate = true;
    };
  },
  kz(k, c) {
    k.plain(0x4a2020, 1.2).terms(1.23); k.g.add(plate('⚡', 1.6, 1.6, 0, 0, 1.23, { fg: '#ffd23f', font: 'bold 54px Arial' }));
    const a = k.add(box(0.5, 2.2, 0.5, MET.copper, 0, 1.3, 1.8), 'toggle'), b = k.add(box(0.5, 2.2, 0.5, MET.copper, 0, -1.3, 1.8), 'toggle'), sp = spark(k, 0, 0, 2);
    return (c, t) => { const on = c.state.on; a.position.y = lerp(a.position.y, on ? 1.05 : 1.6, 0.4); b.position.y = lerp(b.position.y, on ? -1.05 : -1.6, 0.4); sp(on && c.state.i > 0.5, t); };
  },
};

Object.assign(TAGS, {
  xs: [['Клеммы для проводов из стены: L, N, PE', -3, 3.6, 2.6], ['Гнёзда под штыри вилки', 1, 0.2, 2.8], ['Заземляющие скобы: касаются вилки первыми', 0, 2.4, 2.8], ['Шина фазы — здесь греется плохой контакт', -3, -1, 1.2]],
  app: [['Вилка: L, N и заземляющий контакт', 0, 5, 3], ['Нагреватель или двигатель', 0, -3, 4], ['Металлический корпус соединён с PE', 4, -1.4, 8], ['Вывод «корпус» — сюда может коснуться человек', 0, -5.6, 3.3]],
  mw: [['Трансформатор: 230 → 2100 В', 4, -3.6, 3.8], ['Конденсатор: копит заряд, удваивает напряжение', 4.6, -0.4, 3.2], ['Высоковольтный диод: выпрямляет', 2.6, -0.4, 4.6], ['Магнетрон: 4000 В= → СВЧ 2,45 ГГц', 3.6, 2.4, 4.4], ['Камера с поворотным столом', -2, -3.4, 4.2]],
  psu: [['1. Диодный мост: ~230 В → пульсирующее', -3.4, 2.2, 3.4], ['2. Конденсатор: сглаживает до 325 В=', -1, 2, 4.6], ['3. Ключ: «рубит» 65 000 раз в секунду', 1.4, 2.4, 3], ['4. ВЧ-трансформатор: маленький, т.к. частота высокая', 2.2, -0.9, 4.2], ['5. Выходной диод и фильтр', -0.2, -2.2, 3], ['6. Обратная связь (оптрон) держит напряжение', -3.8, -0.4, 3]],
  vd3: [['Шесть диодов: по два на фазу', 0, 1.3, 2.7], ['В каждый момент работает одна пара', 3, -1.3, 2.7]],
  osc: [['Экран: напряжение во времени', -1.2, 1.2, 5.2], ['Щупы', 0, -5.1, 5.3]], kz: [['Место повреждения изоляции', 0, 0, 2.2]],
});

const WTXT = { none: '—', sine: '∿', half: '⌒ ⌒', full: '⌒⌒⌒', flt: '‾‾‾', flat: '——', six: '≈' };
const wpath = (shape, x0, w, h) => { let d = ''; for (let i = 0; i <= 40; i++) d += (i ? 'L' : 'M') + (x0 + w * i / 40).toFixed(2) + ' ' + (-h * wave(shape, i / 40)).toFixed(2) + ' '; return d; };
Object.assign(SYM, {
  xs(c, d) { let s = rc(0, 0, 8, 4.6, `fill="${c.state.burned ? '#5a4a40' : c.state.heat > 0.3 ? 'rgba(255,90,20,' + Math.min(0.8, c.state.heat).toFixed(2) + ')' : '#fffdf5'}"`); for (const t of d.terms) s += ln(t.x, t.y, t.x, t.s * 2.3) + ci(t.x, t.s * 0.9, 0.35, 'fill="#222"') + (t.s > 0 ? ln(t.x, 2.3, t.x, -2.3, DASH) : ''); return s + `<path d="M -1.6 0.2 A 1.6 1.6 0 0 1 1.6 0.2" fill="none" transform="translate(4.6,0)"/>` + (c.state.burned ? tx(0, -3.4, 'оплавилась', 1.1, 'middle', 'fill="#d03030"') : ''); },
  app: (c, d) => { const s = c.state, run = s.on && s.u > 100 && !s.burned; return boxSym(d, c.p.kind.replace(/ \d.*$/, ''), s.burned ? 'СГОРЕЛ' : run ? (s.k > 1 ? 'пуск ×' + s.k : fmt(s.i) + 'А') : s.on ? 'нет питания' : 'выкл') + (s.uc > 50 ? tx(0, -d.h / 2 + 0.4, '⚠ корпус ' + Math.round(s.uc) + ' В', 1.2, 'middle', 'fill="#d03030" font-weight="bold"') : ''); },
  mw: (c, d) => { const s = c.state, run = s.on && s.u > 100 && !s.burned; return boxSym(d, 'СВЧ-печь', s.burned ? 'СГОРЕЛА' : run ? fmt(s.i) + 'А' : s.on ? 'нет питания' : 'выкл') + (s.uc > 50 ? tx(0, -d.h / 2 + 0.4, '⚠ корпус ' + Math.round(s.uc) + ' В', 1.2, 'middle', 'fill="#d03030" font-weight="bold"') : ''); },
  psu: (c, d) => boxSym(d, '~ / =', fmt(c.state.vdc) + 'В') + ln(-4.6, -2.8, 4.6, 2.8, 'stroke-width="0.15"'),
  vd3: (c, d) => boxSym(d, '', '') + `<path d="M -1.2 -1 L 1.2 -1 L 0 1 Z M -1.2 1 L 1.2 1" fill="${c.state.idc > 0.001 ? '#ffb347' : 'none'}"/>` + tx(0, 2, '3~', 1.3) + tx(0, -2.1, '=', 1.4),
  osc: (c, d) => boxSym(d, '', '') + `<path d="${wpath(c.state.shape, -5.5, 11, c.state.shape === 'sine' ? 1.6 : 2.4)}" fill="none" stroke="#1d7a3e" stroke-width="0.3" transform="translate(0,${c.state.shape === 'sine' ? 0 : 1.6})"/>` + tx(0, -3.6, DEFS_NAMES[c.state.shape] || '', 1, 'middle', 'fill="#555"'),
  kz: (c, d) => ln(0, T(d, '1').y, 0, 1.2) + ln(0, -1.2, 0, T(d, '2').y) + (c.state.on ? `<path d="M 0 -1.2 L 0.8 -0.3 L -0.6 0.2 L 0.3 1.2" stroke="#d03030" stroke-width="0.45" fill="none"/>` : '') + tx(1.4, 0, c.state.on ? 'КЗ!' : 'авария', 1.1, 'start', `fill="${c.state.on ? '#d03030' : '#999'}"`),
});
const DEFS_NAMES = { sine: '~ 50 Гц', half: '1 полупериод', full: '2 полупериода', flt: 'сглажено', flat: 'постоянное', six: '3 фазы, 300 Гц', none: '' };
void WTXT;
