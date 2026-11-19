import { describe, expect, it } from "vitest";
import { ecartCalibration, logLoss3, rendement, resume, tranches, wilson, type Obs } from "./calibration";

const serie = (p: number, gagnes: number, perdus: number): Obs[] => [...Array(gagnes).fill({ p, y: 1 }), ...Array(perdus).fill({ p, y: 0 })];

describe("mesure des probabilités", () => {
  it("des probabilités justes ont un écart nul et battent la prévision constante", () => {
    const obs = [...serie(0.8, 80, 20), ...serie(0.3, 30, 70)];
    const r = resume(obs)!;
    expect(r.n).toBe(200);
    expect(r.pMoy).toBeCloseTo(0.55, 6); expect(r.freq).toBeCloseTo(0.55, 6);
    expect(ecartCalibration(obs)).toBeCloseTo(0, 6);
    expect(r.brier).toBeLessThan(r.brierRef);
    expect(r.gain).toBeGreaterThan(0.2);
  });
  it("des probabilités trop optimistes se voient dans les tranches", () => {
    const obs = serie(0.85, 60, 40);
    const [t] = tranches(obs);
    expect(t).toMatchObject({ de: 0.8, a: 0.9, n: 100 });
    expect(t.freq).toBeCloseTo(0.6, 6);
    expect(ecartCalibration(obs)).toBeCloseTo(0.25, 6);
    expect(resume(obs)!.gain).toBeLessThan(0);
  });
  it("l'intervalle s'élargit quand il y a peu de matchs", () => {
    const [a, b] = wilson(0.8, 10), [c, d] = wilson(0.8, 1000);
    expect(b - a).toBeGreaterThan(0.4);
    expect(d - c).toBeLessThan(0.06);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
  it("une probabilité de 1 est rangée dans la dernière tranche", () => {
    expect(tranches([{ p: 1, y: 1 }])[0]).toMatchObject({ de: 0.9, a: 1, n: 1 });
  });
  it("log-loss à trois issues : le hasard vaut ln 3", () => {
    expect(logLoss3([{ p: [1 / 3, 1 / 3, 1 / 3], k: 0 }, { p: [1 / 3, 1 / 3, 1 / 3], k: 2 }])).toBeCloseTo(Math.log(3), 6);
    expect(logLoss3([])).toBeNull();
  });
  it("rendement à mise fixe", () => {
    expect(rendement([{ cote: 2, y: 1 }, { cote: 2, y: 0 }])).toBeCloseTo(0, 6);
    expect(rendement([{ cote: 1.5, y: 1 }, { cote: 1.5, y: 1 }, { cote: 1.5, y: 0 }])).toBeCloseTo(0, 6);
  });
});
