// Трассировка: провода не должны проходить через корпуса устройств. node test/route.test.mjs
import { DEFS, newComp, termPos } from '../js/defs.js';
import '../js/defs2.js'; import '../js/defs3.js'; import '../js/defs4.js';
import { LEVELS } from '../js/levels.js';
import '../js/levels4.js';
import { route, obstacles } from '../js/schematic.js';
let total = 0, bad = 0, worst = [], t0 = Date.now();
for (const L of LEVELS) {
  const s = L.sol; let comps = [...L.comps], wires = [...(L.wires || [])];
  if (Array.isArray(s)) wires = s; else { if (s.comps) comps = [...comps, ...s.comps]; if (s.drop) wires = wires.slice(0, -s.drop); if (s.wires) wires = s.drop ? [...wires, ...s.wires] : s.wires; if (s.add) wires = [...wires, ...s.add]; }
  const cs = comps.map(([id, type, x, y, p]) => newComp(type, id, x, y, p)), obs = obstacles(cs).filter(o => !o.soft); let lb = 0;
  wires.forEach((w, n) => {
    const [a, b] = w.split(' '), ca = cs.find(c => c.id === a.slice(0, a.indexOf('.'))), cb = cs.find(c => c.id === b.slice(0, b.indexOf('.')));
    const pa = termPos(ca, a.slice(a.indexOf('.') + 1)), pb = termPos(cb, b.slice(b.indexOf('.') + 1)), pts = route(pa, pb, n, obstacles(cs)); total++;
    if (Math.abs(pts[0][0] - pa.x) > 0.01 || Math.abs(pts[pts.length - 1][0] - pb.x) > 0.01) { console.log('FAIL концы провода', L.id, w); bad += 100; }
    for (let i = 1; i < pts.length - 2; i++) { const p = pts[i], q = pts[i + 1]; if (Math.abs(p[0] - q[0]) > 0.01 && Math.abs(p[1] - q[1]) > 0.01) { console.log('FAIL косой участок', L.id, w); bad += 100; }
      if (obs.some(o => Math.max(p[0], q[0]) > o.x0 + 0.15 && Math.min(p[0], q[0]) < o.x1 - 0.15 && Math.max(p[1], q[1]) > o.y0 + 0.15 && Math.min(p[1], q[1]) < o.y1 - 0.15)) { lb++; break; } }
  });
  bad += lb; if (lb) worst.push(`${L.id}: ${lb} из ${wires.length}`);
}
console.log(`Проводов: ${total}, проходят через корпус устройства: ${bad} (${(bad / total * 100).toFixed(1)} %), ${Date.now() - t0} мс`); if (worst.length) console.log('  ' + worst.join('; '));
console.log(bad / total < 0.03 ? 'Трассировка в норме' : 'FAILED'); process.exit(bad / total < 0.03 ? 0 : 1);
