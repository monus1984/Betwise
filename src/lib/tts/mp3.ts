import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Compresse la voix avant de l'envoyer au téléphone. La synthèse rend du WAV non compressé (environ 48 Ko par seconde) ;
 * en MP3 mono à 48 kbit/s, c'est 6 Ko par seconde : une réponse lue coûte huit fois moins de données mobiles.
 * Pas 32 kbit/s : à ce débit, l'encodeur étiquette la voix (24 kHz) en 22,05 kHz et la rend presque inaudible
 * (26 dB plus bas, mesuré le 19/11). Le contrôle de l'en-tête ci-dessous refuse tout MP3 mal étiqueté : le WAV part alors tel quel.
 */
const FREQ: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
/** Fréquence annoncée par la première trame MP3, ou null si ce n'en est pas une. */
export function frequenceMp3(mp3: Uint8Array): number | null {
  if (mp3.length < 4 || mp3[0] !== 0xff || (mp3[1] & 0xe0) !== 0xe0) return null;
  return FREQ[(mp3[1] >> 3) & 3]?.[(mp3[2] >> 2) & 3] ?? null;
}

export function wavToMp3(wav: Buffer, kbps = 48): Buffer | null {
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
  const mp3 = out.length ? Buffer.concat(out) : null;
  return mp3 && frequenceMp3(mp3) === rate ? mp3 : null;
}
