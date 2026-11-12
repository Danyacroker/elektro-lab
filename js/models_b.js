// 3D-модели: источники, преобразователи, нагрузки, приборы
import * as THREE from 'three';
import { mat, COL, MET, box, cyl, torus, sphere, coil, plate, display } from './m3d.js';

const lerp = (a, b, k) => a + (b - a) * k;
const PH = [COL.yellow, COL.green, COL.red];

function source(color, title, stripes) {
  return (k, c) => {
    k.plain(color, k.d).terms(k.d + 0.03);
    k.g.add(plate(title(c), k.w - 1.5, 1.6, 0, 1.9, k.d + 0.03, { fg: '#fff', font: 'bold 34px Arial' }));
    k.def.terms.forEach((t, i) => k.g.add(box(2, 0.5, 0.1, mat(stripes[i]), t.x, t.y + 2.1, k.d + 0.05)));
    const led = k.add(sphere(0.4, mat(0x33ff66, { emissive: 0x33ff66 }), k.w / 2 - 1, k.h / 2 - 0.9, k.d));
    return (c, t) => { led.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 4); };
  };
}
function panelMeter(k, c) {
  k.plain(0x23282e, k.d).terms(k.d + 0.03);
  const d = k.add(display(k.w - 1.2, 2.6, 0, 0.2, k.d + 0.04));
  k.g.add(plate(c.label, 3, 0.9, 0, 2.3, k.d + 0.03, { fg: '#ddd' }));
  return c => d.userData.draw(k.def.disp(c));
}
function resistive(kind) {
  return (k, c) => {
    k.plain(0xe4e6e8, 1.5).terms(1.53).label(kind === 'el' ? -2.2 : 0, 1.53);
    if (kind === 'el') {
      k.g.add(cyl(1.2, 2, MET.steel, 0, -0.6, 3, 'y'));
      const glass = k.add(sphere(2.3, mat(0xfff6d0, { transparent: true, opacity: 0.55, emissive: 0xffc860, emissiveIntensity: 0, roughness: 0.1 }), 0, 2, 3), 'toggle');
      const fil = k.add(torus(0.6, 0.07, mat(0x554433, { emissive: 0xffaa33, emissiveIntensity: 0 }), 0, 2, 3));
      const halo = k.add(sphere(4.2, new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 2, 3));
      halo.raycast = () => { };
      return c => { const b = c.state.burned ? 0 : c.state.bright; glass.material.emissiveIntensity = b * 1.6; fil.material.emissiveIntensity = b * 4; halo.material.opacity = Math.min(0.5, b * 0.3); glass.material.color.set(c.state.burned ? 0x333333 : 0xfff6d0); };
    }
    const m = mat(kind === 'r' ? 0xd9c7a0 : 0x777f88, { emissive: 0xff3a00, emissiveIntensity: 0 });
    if (kind === 'r') { k.add(cyl(1.1, 4.6, m, 0, 0, 2.6, 'y')); [0x8b4513, 0x111111, 0xd03030].forEach((b, i) => k.g.add(cyl(1.13, 0.35, mat(b), 0, 1.2 - i * 0.9, 2.6, 'y'))); k.g.add(cyl(0.12, 7, MET.steel, 0, 0, 2.6, 'y')); }
    else { [-0.9, 0.9].forEach(x => k.add(cyl(0.35, 4.6, m, x, 0.3, 2.6, 'y'))); const a = k.add(torus(0.9, 0.35, m, 0, -2, 2.6, Math.PI)); a.rotation.z = Math.PI; }
    return c => { m.emissiveIntensity = c.state.burned ? 0 : Math.min(1.5, c.state.bright * (kind === 'r' ? 1 : 1.2)); };
  };
}

export const MODELS_B = {
  srcdc: source(0x1f4d2e, c => c.secret ? '= ? В' : '= ' + c.p.U + ' В', [COL.red, COL.blue]),
  src1: source(0x2d3e55, () => '~230 В', [0x8b5a2b, COL.blue, 0x9acd32]),
  src3: source(0x2d3e55, () => '3~ 400/230 В', [...PH, COL.blue, 0x9acd32]),
  src10: source(0x5a2d55, c => '3~ ' + c.p.U + ' кВ ⚠', PH),
  tv(k, c) {
    k.zt = 1; k.shell(box(k.w, k.h, 1, mat(0x3c444d), 0, 0, 0.5)); k.terms(1.05).label(0, 7.3);
    const core = mat(COL.core, { emissive: 0x3aa0ff, emissiveIntensity: 0 }), z = 4.2;
    [2.2, -2.2].forEach(y => k.g.add(box(9, 1.4, 2.6, core, 0, y, z))); [-3.8, 3.8].forEach(x => k.g.add(box(1.4, 5.8, 2.6, core, x, 0, z)));
    const m1 = mat(0xb5522a, { emissive: 0xff5500, emissiveIntensity: 0 }), m2 = mat(0xd98a3a, { emissive: 0xff5500, emissiveIntensity: 0 });
    const n = c.p.U1 / c.p.U2, n1 = n >= 1 ? 13 : 6, n2 = n >= 1 ? 6 : 13;
    k.g.add(coil(1.55, n >= 1 ? 0.13 : 0.26, n1, m1, 0, 2.2, z, 'x')); k.g.add(coil(1.55, n >= 1 ? 0.26 : 0.13, n2, m2, 0, -2.2, z, 'x'));
    k.g.add(plate(c.p.U1 + ' В', 2.6, 0.8, 0, 3.6, z + 1.5, { fg: '#ffd' })); k.g.add(plate(c.p.U2 + ' В', 2.6, 0.8, 0, -3.6, z + 1.5, { fg: '#ffd' }));
    return (c, t) => {
      const s = c.state, on = s.u1 > 1 && !s.burned;
      core.emissiveIntensity = on && !s.dc ? 0.25 + 0.25 * Math.sin(t * 9) : 0;
      m1.emissiveIntensity = Math.min(1, s.heat + (s.dc && on ? 0.5 : 0)); m2.emissiveIntensity = s.heat; m1.color.set(s.burned ? 0x111111 : 0xb5522a);
    };
  },
  tv3(k, c) {
    k.zt = k.d * 0.5; const z = k.zt;
    k.shell(box(k.w - 3, 7.6, k.d - 1, mat(0x6d7a86), 0, -0.4, k.d / 2));
    for (let i = 0; i < 9; i++) { k.g.add(box(0.15, 6.4, 1.2, mat(0x5d6a76), -7 + i * 1.75, -0.4, k.d + 0.1)); }
    k.def.terms.forEach(t => { const hv = t.s > 0; k.g.add(cyl(hv ? 0.9 : 0.5, hv ? 3 : 2.4, mat(hv ? 0x7a3b1d : 0xdddddd), t.x, t.s * (hv ? 4.6 : 5), z, 'y', hv ? 0.5 : 0.4)); });
    k.terms(k.d + 0.75).label(0, k.d + 0.75);
    const core = mat(COL.core, { emissive: 0x3aa0ff, emissiveIntensity: 0 }), ms = [];
    [-5, 0, 5].forEach((x, i) => {
      k.in(box(1.4, 6.6, 1.6, core, x, -0.4, z));
      const m = mat(PH[i], { emissive: PH[i], emissiveIntensity: 0 }); ms.push(m);
      k.in(coil(1.9, 0.16, 12, m, x, -0.4, z)); k.in(coil(1.3, 0.3, 6, mat(COL.copper), x, -0.4, z));
    });
    [2.9, -3.7].forEach(y => k.in(box(11.4, 1.2, 1.6, core, 0, y, z)));
    return (c, t) => { const on = c.state.u1 > 100; core.emissiveIntensity = on ? 0.3 + 0.2 * Math.sin(t * 9) : 0; ms.forEach((m, i) => m.emissiveIntensity = on ? 0.25 + 0.25 * Math.sin(t * 6 - i * 2.094) : 0); };
  },
  vd(k, c) {
    k.modular(0x2b3138).terms(k.d + 0.03);
    k.g.add(plate(c.label, 2.6, 0.9, 0, 1.9, k.d + 0.03, { fg: '#fff' })); k.g.add(plate('~ ⟶ =', 3.4, 1, 0, 0.4, k.d + 0.03, { fg: '#ffd23f' }));
    const z = k.d * 0.5, dm = [];
    [[-1.2, 1.2, 0.78], [1.2, 1.2, -0.78], [-1.2, -1.2, -0.78], [1.2, -1.2, 0.78]].forEach(([x, y, r]) => {
      const m = mat(0x15181c, { emissive: 0xff2200, emissiveIntensity: 0 }); dm.push(m);
      const d = k.in(cyl(0.45, 1.7, m, x, y, z, 'y')); d.rotation.z = r; const b = cyl(0.47, 0.25, MET.steel, 0, 0.55, 0, 'y'); d.add(b);
    });
    const cap = k.add(cyl(1, 2.4, mat(0x2244aa), 0, -1.3, k.d + 1, 'x'));
    return (c, t) => { cap.visible = c.p.C === 'есть'; const on = c.state.idc > 0.001, ph = Math.sin(t * 5) > 0; dm.forEach((m, i) => m.emissiveIntensity = on && ((i === 0 || i === 3) === ph) ? 0.9 : 0); };
  },
  el: resistive('el'), r: resistive('r'), eh: resistive('eh'),
  m3(k, c) {
    k.zt = 4; const cy = -1.8, sm = mat(0x3d6fa5);
    k.shell(cyl(5.3, 9, sm, 0, cy, 5)); k.shell(box(k.w - 6.5, 3, 4, mat(0x34495e), 0.75, 6, 2));
    for (let i = 0; i < 7; i++) k.g.add(torus(5.35, 0.14, mat(0x34608f), 0, cy, 1.2 + i * 1.25));
    k.g.add(box(11, 0.8, 8, mat(0x2a3138), 0, cy - 5.5, 5));
    k.terms(4.03).label(cy + 3.8, 9.55);
    const rot = new THREE.Group(); rot.position.set(0, cy, 0); k.g.add(rot);
    rot.add(cyl(0.6, 12, MET.steel, 0, 0, 6)); rot.add(cyl(2.1, 0.8, mat(0x22262b), 0, 0, 11.4)); rot.add(box(0.5, 3.8, 0.1, mat(0xffffff), 0, 0, 11.85));
    const rin = new THREE.Group(); k.inner.add(rin); rin.position.set(0, cy, 0);
    rin.add(cyl(2.9, 7, mat(0x8a929a), 0, 0, 5)); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; rin.add(box(0.3, 0.3, 7.1, MET.copper, Math.cos(a) * 2.85, Math.sin(a) * 2.85, 5)); }
    const cm = [];
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 2, m = mat(PH[i % 3], { emissive: PH[i % 3], emissiveIntensity: 0 }); cm.push(m); const b = k.in(box(1.9, 1.1, 7.4, m, Math.cos(a) * 4.2, cy + Math.sin(a) * 4.2, 5)); b.rotation.z = a + Math.PI / 2; }
    const fld = new THREE.Group(); fld.position.set(0, cy, 9.9); k.in(fld);
    const fm = new THREE.MeshBasicMaterial({ color: 0x40e0ff }); fld.add(box(0.35, 7, 0.2, fm)); const tip = cyl(0.01, 1.4, fm, 0, 4, 0, 'y', 0.8); fld.add(tip);
    return (c, t, dt) => {
      const s = c.state, on = Math.max(...s.i, 0) > 0.05;
      rot.rotation.z -= s.speed * dt * 14 - (s.stall ? Math.sin(t * 70) * 0.015 : 0); rin.rotation.z = rot.rotation.z;
      fld.visible = on; if (on) { if (s.stall) { fld.scale.setScalar(0.5 + 0.5 * Math.abs(Math.sin(t * 8))); } else { fld.scale.setScalar(1); fld.rotation.z -= Math.sign(s.speed || 1) * dt * 16; } }
      cm.forEach((m, i) => m.emissiveIntensity = on ? Math.max(0, Math.sin(t * 8 - (i % 3) * 2.094)) * (i < 3 ? 1 : 0.6) : 0);
      sm.color.set(s.burned ? 0x1a1a1a : 0x3d6fa5); sm.emissive.setRGB(s.heat * 0.7, 0, 0);
    };
  },
  pa: panelMeter, pv: panelMeter,
  mm(k, c) {
    k.plain(0xe0a800, k.d).terms(k.d + 0.03);
    const d = k.add(display(k.w - 1.4, 2.6, 0, 3.9, k.d + 0.04, { fg: '#111', bg: '#b9c7a8' }), 'toggle');
    k.add(cyl(2.3, 0.6, mat(0x2a2e33), 0, -0.4, k.d + 0.3), 'toggle');
    const kn = new THREE.Group(); kn.position.set(0, -0.4, k.d + 0.75); kn.add(box(0.7, 3.6, 0.5, mat(0x111111))); kn.add(box(0.2, 1, 0.52, mat(0xffffff), 0, 1.2, 0)); k.add(kn, 'toggle');
    k.g.add(plate('V', 0.9, 0.9, -2.9, 1.7, k.d + 0.03, { fg: '#000' })); k.g.add(plate('A', 0.9, 0.9, 2.9, 1.7, k.d + 0.03, { fg: '#a00' }));
    return c => { d.userData.draw(k.def.disp(c)); kn.rotation.z = lerp(kn.rotation.z, c.p.mode === 'V' ? 0.9 : -0.9, 0.3); };
  },
  pi(k, c) {
    k.plain(0xd5d9dd, k.d).terms(k.d + 0.03).label(4.9, k.d + 0.03);
    const d = k.add(display(k.w - 2, 2.4, 0, 2.6, k.d + 0.04, { fg: '#111', bg: '#c5d1b5' }));
    const led = k.add(sphere(0.35, mat(0x550000, { emissive: 0xff0000, emissiveIntensity: 0 }), 4, 0.4, k.d));
    const disk = k.add(cyl(2.4, 0.15, MET.steel, 0, 0.3, k.d - 0.6, 'y')); disk.add(box(0.5, 0.17, 0.5, mat(COL.red), 2.2, 0, 0));
    k.g.add(box(k.w - 0.4, 0.5, 0.2, mat(0x8a9097), 0, -1.4, k.d + 0.1));
    let ph = 0;
    return (c, t, dt) => { d.userData.draw(k.def.disp(c)); ph += Math.abs(c.state.p) / 1000 * dt * 4; led.material.emissiveIntensity = (ph % 1) < 0.25 && Math.abs(c.state.p) > 1 ? 1 : 0; disk.rotation.y = ph * 2; };
  },
  pe(k, c) {
    k.plain(0x6a5a3a, 1.5).terms(1.53);
    k.g.add(box(4.6, 1, 0.6, MET.copper, 0, -0.6, 1.8)); k.g.add(plate('⏚', 1.6, 1.6, 0, -0.9, 2.15, { fg: '#fff', font: 'bold 54px Arial' }));
    [-1.4, 0, 1.4].forEach((x, i) => k.g.add(box(0.5, 0.5, 0.1, mat(i % 2 ? COL.green : COL.yellow), x, -2.2, 1.55)));
    return () => { };
  },
  hum(k, c) {
    k.zt = 1.5; const m = mat(0x4a7ab8, { emissive: 0xff0000, emissiveIntensity: 0 }), skin = mat(0xf0c8a0, { emissive: 0xff0000, emissiveIntensity: 0 });
    const b = new THREE.Group(); k.add(b, 'toggle');
    b.add(sphere(1.5, skin, 0, 3, 1.5)); b.add(box(3.4, 5, 1.6, m, 0, -1, 1.5)); [-0.9, 0.9].forEach(x => b.add(box(1.3, 4.6, 1.4, mat(0x2b3a55), x, -5.7, 1.5)));
    b.add(box(1, 4, 1, m, -2.2, -0.6, 1.5));
    const arm = new THREE.Group(); arm.position.set(2, 1, 1.5); arm.add(box(1, 6.4, 1, m, 0, 3, 0)); arm.add(sphere(0.7, skin, 0, 6.2, 0)); b.add(arm);
    k.terms(1.83);
    return (c, t) => {
      const s = c.state; arm.rotation.z = lerp(arm.rotation.z, s.touch ? 0.32 : Math.PI - 0.15, 0.3);
      const z = Math.min(1, s.i / 0.03); m.emissiveIntensity = skin.emissiveIntensity = z * (0.5 + 0.5 * Math.sin(t * 40));
      b.position.x = z > 0.2 ? Math.sin(t * 90) * 0.12 : 0;
    };
  },
};
