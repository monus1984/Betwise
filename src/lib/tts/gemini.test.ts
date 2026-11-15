import { describe, expect, it } from "vitest";
import { asWav, audioFromGenerate, audioFromInteraction, pcmToWav } from "./gemini";

describe("voix Gemini", () => {
  it("enveloppe du PCM brut dans un WAV 24 kHz mono 16 bits", () => {
    const wav = pcmToWav(Buffer.alloc(48000));
    expect(wav.length).toBe(48044);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF"); expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24000); expect(wav.readUInt16LE(22)).toBe(1); expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(48000);
  });
  it("ne ré-enveloppe pas un WAV", () => {
    const wav = pcmToWav(Buffer.alloc(10));
    expect(asWav(wav)).toBe(wav);
    expect(asWav(Buffer.alloc(10)).length).toBe(54);
  });
  it("trouve le son dans les deux formes de réponse", () => {
    expect(audioFromInteraction({ steps: [{ type: "thought" }, { type: "model_output", content: [{ type: "text", text: "x" }, { type: "audio", data: "QUJD" }] }] })).toBe("QUJD");
    expect(audioFromInteraction({ steps: [] })).toBeNull();
    expect(audioFromGenerate({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: "QUJD" } }] } }] })).toBe("QUJD");
    expect(audioFromGenerate({ error: { message: "x" } })).toBeNull();
  });
});
