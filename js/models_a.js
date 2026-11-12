// 3D-модели: защита и коммутация. Каждая функция строит модель и возвращает update(c, t, dt).
import * as THREE from 'three';
import { mat, COL, MET, box, cyl, torus, coil, plate, display } from './m3d.js';

const lerp = (a, b, k) => a + (b - a) * k;
const hot = new THREE.Color(0xff3300), cold = new THREE.Color(COL.steel);

export function lever(k, x, w = 1.2) {
  const p = new THREE.Group(); p.position.set(x, 0, k.d);
  const lb = box(w, 0.9, 1.8, mat(COL.dark), 0, 0, 0.7); lb.userData.shell = true; k.shells.push(lb); p.add(lb);   // рычаг тоже становится прозрачным в разрезе
  const ind = box(Math.min(w, 1.2), 0.5, 0.05, mat(COL.green), x, -1.5, k.d + 0.03); k.g.add(ind);
  k.add(p, 'toggle');
  return on => { p.rotation.x = lerp(p.rotation.x, on ? -0.6 : 0.6, 0.35); ind.material.color.set(on ? COL.red : COL.green); };
}

function breaker(np) {
  return (k, c) => {
    k.modular().terms().label(2.1, k.d + 0.03);
    k.g.add(plate(c.p.curve + c.p.In, 2.2, 0.9, 0, -2.3, k.d + 0.03, { fg: '#111' }));
    const xs = np === 1 ? [0] : [-3, 0, 3], lv = lever(k, 0, np * 3 - 1.6), poles = [];
    for (const x of xs) {
      const z = k.d * 0.45;
      const co = k.in(coil(0.5, 0.13, 7, mat(COL.copper, { emissive: 0 }), x, 2.2, z));           // эл.магнитный расцепитель
      k.in(cyl(0.22, 2.2, MET.steel, x, 2.2, z, 'y'));                                           // сердечник-боёк
      for (let i = 0; i < 6; i++) k.in(box(1.7, 0.07, 1.6, MET.steel, x, -0.2 - i * 0.28, z - 0.6)); // дугогасительная решётка
      const mv = new THREE.Group(); mv.position.set(x, -0.2, z + 1.4); mv.add(box(0.3, 1.9, 0.3, MET.copper, 0, 0.9, 0)); k.in(mv); // подвижный контакт
      k.in(box(0.5, 0.3, 0.5, MET.brass, x, 1.75, z + 1.4));                                      // неподвижный контакт
      const bm = new THREE.Group(); bm.position.set(x, -3.6, z); const strip = box(0.5, 2.2, 0.12, mat(COL.steel), 0, 1.1, 0); bm.add(strip); k.in(bm); // биметалл
      k.in(box(0.6, 0.5, 0.6, MET.brass, x, k.h / 2 - 1, z)); k.in(box(0.6, 0.5, 0.6, MET.brass, x, -k.h / 2 + 1, z));
      const pm = mat(COL.copper, { emissive: 0xffcc33, emissiveIntensity: 0 });   // путь тока внутри полюса
      k.in(box(0.22, 0.7, 0.22, pm, x, 3.2, z)); k.in(box(0.22, 0.22, 1.5, pm, x, 1.2, z + 0.7)); k.in(box(0.22, 1.3, 0.22, pm, x, -0.8, z + 0.75)); k.in(box(0.22, 0.22, 0.8, pm, x, -1.4, z + 0.4));
      poles.push({ co, mv, bm, strip, pm });
    }
    return (c, t) => {
      const s = c.state; lv(s.on);
      for (const p of poles) {
        p.mv.rotation.x = lerp(p.mv.rotation.x, s.on ? 0 : 0.7, 0.4);
        p.bm.rotation.x = s.heat * 0.45; p.strip.material.color.copy(cold).lerp(hot, Math.min(1, s.heat));
        p.strip.material.emissive.copy(hot).multiplyScalar(Math.min(1, s.heat) * 0.6);
        p.co.children.forEach(m => m.material.emissive.setHex(s.trip === 'em' ? 0xff8800 : 0)); p.pm.emissiveIntensity = s.on && s.i > 0.01 ? 0.35 + 0.6 * Math.min(1, s.i / c.p.In) : 0;
      }
    };
  };
}

function rcd(np) {
  return (k, c) => {
    k.modular().terms().label(2.1);
    const lv = lever(k, -k.w / 2 + 1.8, 2);
    k.add(box(1.3, 1, 0.5, mat(COL.yellow), k.w / 2 - 1.5, 0.3, k.d + 0.2), 'test');
    k.g.add(plate('T', 0.8, 0.7, k.w / 2 - 1.5, 0.3, k.d + 0.47, { fg: '#000' }));
    k.g.add(plate(c.p.Id + 'мА', 2.6, 0.8, k.w / 2 - 1.8, -1.9, k.d + 0.03, { fg: '#111' }));
    const z = k.d * 0.45, xs = k.def.terms.filter(t => t.s > 0).map(t => t.x), cx = 0;
    const ring = k.in(torus(1.6, 0.5, mat(COL.core, { emissive: 0 }), cx, -1.3, z)); ring.rotation.x = Math.PI / 2;   // дифф. трансформатор
    xs.forEach((x, i) => {                                                                    // проводники сквозь сердечник
      const m = i === xs.length - 1 ? mat(COL.blue) : MET.copper, px = cx + (i - (xs.length - 1) / 2) * 0.5;
      k.in(cyl(0.16, 3.4, m, px, -1.3, z, 'y'));
      k.in(box(0.25, 0.25, 0.25, m, x, 2.2, z)); const a = box(Math.abs(x - px) + 0.25, 0.2, 0.2, m, (x + px) / 2, 0.5, z); k.in(a);
      k.in(cyl(0.1, 1.8, m, x, 1.4, z, 'y'));
    });
    const sense = k.in(coil(0.62, 0.1, 5, mat(0xd04040, { emissive: 0 }), cx + 1.6, -1.3, z, 'z'));  // обмотка управления
    const relay = k.in(box(1.3, 1, 1, mat(0x3355aa, { emissive: 0 }), cx + 2.2, 1.6, z));          // поляризованное реле
    return (c, t) => {
      const s = c.state; lv(s.on);
      const a = Math.min(1, s.d / (c.p.Id / 1000)) || (s.trip ? 1 : 0);
      ring.material.emissive.setRGB(a * 0.9, a * 0.3, 0); sense.children.forEach(m => m.material.emissive.setRGB(a, 0, 0));
      relay.material.emissive.setRGB(s.trip ? 0.8 : 0, 0, 0);
    };
  };
}

export const MODELS_A = {
  qf1: breaker(1), qf3: breaker(3), rcd2: rcd(2), rcd4: rcd(4),
  fu(k, c) {
    k.modular(0xd9d2c0).terms().label(2.1);
    k.add(cyl(0.9, 4.2, mat(0xf5f0e0), 0, -0.4, k.d + 0.6, 'y')); k.add(cyl(0.95, 0.7, MET.steel, 0, 1.6, k.d + 0.6, 'y')); k.add(cyl(0.95, 0.7, MET.steel, 0, -2.4, k.d + 0.6, 'y'));
    const wire = k.in(cyl(0.07, 5, mat(COL.steel, { emissive: 0 }), 0, -0.4, k.d * 0.5, 'y'));
    const win = k.add(box(0.5, 0.5, 0.1, mat(COL.green), 0, -0.4, k.d + 1.5), 'toggle');
    return c => { const s = c.state; wire.visible = !s.blown; wire.material.emissive.setRGB(s.heat, s.heat * 0.3, 0); win.material.color.set(s.blown ? COL.red : COL.green); };
  },
  qs3(k, c) {
    k.zt = 1.2; k.shell(box(k.w, k.h, 1, mat(0x3c444d), 0, 0, 0.5)); k.terms(1.05).label(0, 1.05);
    const piv = new THREE.Group(); piv.position.set(0, -k.h / 2 + 2.6, 1.6);
    for (const x of [-3, 0, 3]) {
      piv.add(box(0.7, 6.6, 0.3, MET.copper, x, 3.2, 0));
      k.g.add(box(1.3, 1, 1.2, MET.brass, x, k.h / 2 - 2.6, 1.6)); k.g.add(box(1.3, 1, 1.2, MET.brass, x, -k.h / 2 + 2.6, 1.6));
    }
    piv.add(box(8, 0.7, 0.7, mat(COL.dark), 0, 4.2, 0.4)); piv.add(cyl(0.45, 3.5, mat(COL.red), 0, 4.2, 2.2, 'z'));
    k.add(piv, 'toggle');
    return c => { piv.rotation.x = lerp(piv.rotation.x, c.state.on ? 0 : 0.95, 0.25); };
  },
  sa(k, c) {
    k.modular().terms().label(2.3);
    const r = k.add(box(2.6, 2.6, 0.8, mat(0xf8f8f8), 0, -0.3, k.d + 0.3), 'toggle');
    const mv = k.in(box(0.3, 2.6, 0.3, MET.copper, 0, 0, k.d * 0.5)); k.in(box(0.5, 0.4, 0.5, MET.brass, 0, 1.6, k.d * 0.5)); k.in(box(0.5, 0.4, 0.5, MET.brass, 0, -1.6, k.d * 0.5));
    return c => { r.rotation.x = lerp(r.rotation.x, c.state.on ? -0.25 : 0.25, 0.4); mv.rotation.z = lerp(mv.rotation.z, c.state.on ? 0 : 0.6, 0.4); };
  },
  sb_no: button(false), sb_nc: button(true),
  km(k, c) {
    k.modular(0xdfe3e7).terms().label(2.3);
    k.g.add(plate('~' + c.p.Uc + 'В', 2.6, 0.9, -6, -2.3, k.d + 0.03, { fg: '#111' }));
    const z0 = 1.6, core = mat(COL.core);
    k.in(box(7, 1, 2, core, -1.5, 0, z0)); [-4.5, -1.5, 1.5].forEach(x => k.in(box(1, 1, 2.4, core, x, 0, z0 + 1.6)));   // Ш-образный сердечник
    const cm = mat(COL.copper, { emissive: 0 }); const co = k.in(coil(1.1, 0.2, 5, cm, -1.5, 0, z0 + 1.7, 'z'));          // катушка
    const arm = new THREE.Group(); k.in(arm);
    arm.add(box(7, 1, 0.9, core, -1.5, 0, 0));                                                                           // якорь
    const xs = [-4.5, -1.5, 1.5, 4.5, 7.5];
    xs.forEach((x, i) => { arm.add(box(0.5, i < 3 ? 5.6 : 5.6, 0.3, i < 3 ? MET.copper : MET.brass, x, 0, 0.9)); });      // контактные мостики
    arm.add(box(13.5, 0.6, 0.5, mat(0x222a33), 1.5, 0, 0.5));                                                            // траверса
    xs.forEach(x => [1, -1].forEach(s => k.in(box(0.7, 0.5, 0.5, MET.brass, x, s * 2.7, 5.2))));                          // неподвижные контакты
    const nc = k.in(box(0.5, 5.6, 0.3, MET.brass, 7.5, 0, 5.2));
    const ind = k.add(box(2.2, 1.2, 0.5, mat(0x2a66d6), -1.5, 0, k.d + 0.1));
    return (c, t) => {
      const s = c.state, tz = s.on ? 4.2 : 6.2; arm.position.z = lerp(arm.position.z || 6.2, tz, 0.45);
      arm.children[5].visible = false; nc.visible = !s.on;   // 21-22 замкнут в покое
      cm.emissive.setRGB(s.burned ? 0 : Math.min(1, s.uc / c.p.Uc) * 0.9, s.burned ? 0 : Math.min(1, s.uc / c.p.Uc) * 0.35, 0); cm.color.set(s.burned ? 0x111111 : COL.copper);
      ind.position.z = k.d + (s.on ? -0.15 : 0.15);
    };
  },
  kl(k, c) {
    k.modular(0x9fc4e8).terms().label(2.2);
    k.g.add(plate(c.p.Uc + 'В', 2, 0.8, 0, -2, k.d + 0.03, { fg: '#111' }));
    const z = k.d * 0.5, cm = mat(COL.copper, { emissive: 0 });
    k.in(coil(0.9, 0.16, 8, cm, -3, 0, z)); k.in(cyl(0.4, 3.4, MET.steel, -3, 0, z, 'y'));
    const arm = new THREE.Group(); arm.position.set(1.5, 2.6, z); arm.add(box(0.3, 4.6, 0.5, MET.copper, 0, -2.3, 0)); k.in(arm);
    k.in(box(0.6, 0.5, 0.6, MET.brass, 0.4, -2.4, z)); k.in(box(0.6, 0.5, 0.6, MET.brass, 2.6, -2.4, z));
    return c => { const s = c.state; arm.rotation.z = lerp(arm.rotation.z, s.on ? 0.22 : -0.22, 0.4); const a = s.burned ? 0 : Math.min(1, s.uc / c.p.Uc); cm.emissive.setRGB(a * 0.9, a * 0.35, 0); cm.color.set(s.burned ? 0x111111 : COL.copper); };
  },
};

function button(nc) {
  return (k, c) => {
    k.modular(0x2b3138).terms(k.d + 0.03);
    k.g.add(plate(c.label, 2.6, 0.9, 0, 2, k.d + 0.03, { fg: '#fff' }));
    const b = k.add(cyl(1.5, 1.4, mat(nc ? COL.red : COL.green), 0, -0.3, k.d + 0.7), 'press');
    k.add(cyl(1.8, 0.5, MET.steel, 0, -0.3, k.d + 0.25));
    const br = k.in(box(0.3, 3, 0.3, MET.copper, 0, 0, 0)); k.in(box(0.5, 0.4, 0.5, MET.brass, 0, 1.4, k.d * 0.45)); k.in(box(0.5, 0.4, 0.5, MET.brass, 0, -1.4, k.d * 0.45));
    return c => {
      const p = c.state.pressed; b.position.z = lerp(b.position.z, k.d + (p ? 0.2 : 0.7), 0.5);
      br.position.z = lerp(br.position.z, k.d * 0.45 + ((p !== nc) ? 0 : (nc ? -0.8 : 0.8)), 0.5);
    };
  };
}
