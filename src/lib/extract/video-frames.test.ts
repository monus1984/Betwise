import { describe, expect, it } from "vitest";
import { choisir } from "./video-frames";

describe("choix des images d'une vidéo trop riche", () => {
  // Vidéo d'analyse de tipster (4 matchs) : 79 candidates, 9 fins de plan dont 4 fiches avec le prono
  const times = Array.from({ length: 79 }, (_, i) => +(i * 1.2).toFixed(1));
  const fins = [
    { t: 4.8, agitation: 4.2 }, { t: 23.3, agitation: 0.6 }, { t: 25.3, agitation: 4.8 }, { t: 47.9, agitation: 0.5 }, { t: 50.3, agitation: 5.1 },
    { t: 74.7, agitation: 0.7 }, { t: 77.8, agitation: 4.4 }, { t: 91.8, agitation: 0.8 }, { t: 95.2, agitation: 3.9 },
  ];
  it("garde toutes les fins de plan quand elles tiennent, et jamais plus que le maximum", () => {
    const out = choisir(times, fins, 12);
    expect(out).toHaveLength(12);
    for (const f of fins) expect(out).toContain(f.t);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });
  it("s'il y a trop de fins de plan, garde les plus calmes (les fiches)", () => {
    const out = choisir(times, fins, 6);
    for (const t of [23.3, 47.9, 74.7, 91.8]) expect(out).toContain(t);
    expect(out.length).toBeLessThanOrEqual(6);
  });
  it("sans fin de plan (défilement d'un coupon), répartit dans le temps comme avant", () => {
    const out = choisir(times, [], 12);
    expect(out).toHaveLength(12);
    expect(out[0]).toBe(times[0]); expect(out[11]).toBe(times[78]);
  });
});
