import { describe, expect, it } from "vitest";
import { enWav, lireFlux } from "./openrouter";

describe("voix OpenRouter", () => {
  it("assemble les morceaux de son du flux", () => {
    const a = Buffer.from([1, 2, 3, 4]).toString("base64"), b = Buffer.from([5, 6]).toString("base64");
    const flux = `data: {"choices":[{"delta":{"audio":{"data":"${a}"}}}]}\n\ndata: {"choices":[{"delta":{"audio":{"transcript":"Salut"}}}]}\ndata: {"choices":[{"delta":{"audio":{"data":"${b}"}}}]}\ndata: [DONE]\n`;
    expect([...lireFlux(flux)]).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("produit un en-tête WAV 24 kHz mono 16 bits", () => {
    const w = enWav(Buffer.alloc(48000));
    expect(w.toString("ascii", 0, 4)).toBe("RIFF");
    expect(w.readUInt32LE(24)).toBe(24000);
    expect(w.length).toBe(48044);
  });
});
