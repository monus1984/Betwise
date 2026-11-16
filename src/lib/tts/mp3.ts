import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Compresse la voix avant de l'envoyer au téléphone. La synthèse rend du WAV non compressé (environ 48 Ko par seconde) ;
 * en MP3 mono à 32 kbit/s, c'est 4 Ko par seconde : une réponse lue coûte douze fois moins de données mobiles.
 */
export function wavToMp3(wav: Buffer, kbps = 32): Buffer | null {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") return null;
  let off = 12, rate = 0, canaux = 0, bits = 0, debut = -1, taille = 0;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4), n = wav.readUInt32LE(off + 4);
    if (id === "fmt ") { if (wav.readUInt16LE(off + 8) !== 1) return null; canaux = wav.readUInt16LE(off + 10); rate = wav.readUInt32LE(off + 12); bits = wav.readUInt16LE(off + 22); }
    else if (id === "data") { debut = off + 8; taille = Math.min(n, wav.length - debut); break; }
    off += 8 + n + (n % 2);
  }
  if (debut < 0 || bits !== 16 || canaux < 1 || canaux > 2 || ![16000, 22050, 24000, 32000, 44100, 48000].includes(rate)) return null;
  const total = Math.floor(taille / 2 / canaux);
  const mono = new Int16Array(total);
  for (let i = 0; i < total; i++) {
    const o = debut + i * 2 * canaux;
    mono[i] = canaux === 1 ? wav.readInt16LE(o) : (wav.readInt16LE(o) + wav.readInt16LE(o + 2)) >> 1;
  }
  const enc = new Mp3Encoder(1, rate, kbps), out: Uint8Array[] = [];
  for (let i = 0; i < mono.length; i += 1152) { const b = enc.encodeBuffer(mono.subarray(i, i + 1152)); if (b.length) out.push(new Uint8Array(b)); }
  const fin = enc.flush(); if (fin.length) out.push(new Uint8Array(fin));
  return out.length ? Buffer.concat(out) : null;
}
