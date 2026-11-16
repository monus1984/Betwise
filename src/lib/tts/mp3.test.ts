import { describe, expect, it } from "vitest";
import { pcmToWav } from "./gemini";
import { wavToMp3 } from "./mp3";

describe("compression de la voix", () => {
  const sec = 3, rate = 24000, pcm = Buffer.alloc(sec * rate * 2);
  for (let i = 0; i < sec * rate; i++) pcm.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * 220 * i) / rate) + 3000 * Math.sin((2 * Math.PI * 660 * i) / rate)), i * 2);
  const wav = pcmToWav(pcm, rate);

  it("rend un MP3 au moins cinq fois plus léger que le WAV", () => {
    const mp3 = wavToMp3(wav)!;
    expect(mp3).not.toBeNull();
    expect(mp3[0]).toBe(0xff);                 // synchronisation d'une trame MPEG
    expect(mp3[1] & 0xe0).toBe(0xe0);
    expect(wav.length / mp3.length).toBeGreaterThan(5);
  });
  it("refuse ce qui n'est pas un WAV 16 bits, sans planter", () => {
    expect(wavToMp3(Buffer.from("pas un wav"))).toBeNull();
    expect(wavToMp3(pcmToWav(pcm, rate, 1, 8))).toBeNull();
  });
});
