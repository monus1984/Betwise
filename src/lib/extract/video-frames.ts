/**
 * Extraction d'images d'une vidéo d'écran, dans le navigateur (la vidéo ne quitte pas le téléphone).
 * Cas visé : l'utilisateur filme son écran en faisant défiler un long coupon, ou enregistre la story d'un tipster.
 * Règle simple, indépendante du contenu (un coupon a des lignes qui se ressemblent : mesurer le défilement
 * par comparaison d'images se trompe d'une ligne à l'autre) :
 *  - une image au début ;
 *  - pendant que l'écran bouge, une image toutes les MOTION_EVERY secondes de mouvement ;
 *  - une image à chaque arrêt après un mouvement (pause, story suivante, ticket déplié) ;
 *  - une image à la fin si l'écran a bougé depuis la dernière.
 * Une vidéo d'écran n'a pas de flou de bougé : une image prise en plein défilement reste lisible.
 * Au-delà de `max`, on garde `max` images réparties sur les candidates (denses là où ça défile) et on le signale.
 */
const SIG_W = 48;
const MOVE = 2;        // écart moyen (0–255) entre deux échantillons au-delà duquel l'écran bouge
const CHANGED = 10;    // écart avec la dernière image retenue au-delà duquel un arrêt mérite une image
const MOTION_EVERY = 0.3;

export type VideoFrames = { files: File[]; duree: number; retenues: number; candidates: number };

export async function framesFromVideo(file: File, { max = 8, step = 0.1, maxDuree = 180 } = {}): Promise<VideoFrames> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto"; video.src = url;
  try {
    await once(video, "loadedmetadata", 15000);
    let duree = video.duration;
    if (!Number.isFinite(duree)) { video.currentTime = 1e7; await once(video, "seeked", 8000).catch(() => {}); duree = video.duration; }
    if (!Number.isFinite(duree) || duree <= 0) throw new Error("Vidéo illisible sur ce téléphone.");
    if (duree > maxDuree) throw new Error(`Vidéo trop longue (${Math.round(duree)} s). ${maxDuree / 60} minutes au plus : filme seulement le coupon.`);
    await video.play().catch(() => {}); video.pause(); // débloque le décodage sur iOS

    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) throw new Error("Vidéo illisible sur ce téléphone.");
    const sigH = Math.max(8, Math.round((SIG_W * h) / w));
    const small = document.createElement("canvas"); small.width = SIG_W; small.height = sigH;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;

    // 1er passage : signatures basse résolution, choix des instants
    const pas = Math.max(step, duree / 600);
    const times: number[] = [];
    let prev: Uint8Array | null = null, kept: Uint8Array | null = null, moving = 0, wasMoving = false, last = 0;
    for (let t = Math.min(0.05, duree / 2); t <= duree; t += pas) {
      await seek(video, t);
      sctx.drawImage(video, 0, 0, SIG_W, sigH);
      const sig = gray(sctx.getImageData(0, 0, SIG_W, sigH).data);
      last = t;
      if (prev === null || kept === null) { times.push(t); kept = sig; prev = sig; continue; }
      if (diff(sig, prev) > MOVE) {
        moving += pas; wasMoving = true;
        if (moving >= MOTION_EVERY) { times.push(t); kept = sig; moving = 0; }
      } else {
        if (wasMoving && diff(sig, kept) > CHANGED) { times.push(t); kept = sig; }
        wasMoving = false; moving = 0;
      }
      prev = sig;
    }
    if (prev && kept && times[times.length - 1] !== last && diff(prev, kept) > CHANGED) times.push(last); // bas du ticket
    if (!times.length) times.push(duree / 2); // vidéo sans arrêt : une image au milieu
    const candidates = times.length;
    const choisis = candidates <= max ? times : Array.from({ length: max }, (_, i) => times[Math.round((i * (candidates - 1)) / (max - 1))]);

    // 2e passage : images nettes, 1080 px de large au plus
    const outW = Math.min(1080, w), outH = Math.round((h * outW) / w);
    const big = document.createElement("canvas"); big.width = outW; big.height = outH;
    const bctx = big.getContext("2d")!;
    const files: File[] = [];
    for (const [i, t] of choisis.entries()) {
      await seek(video, t);
      bctx.drawImage(video, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((r) => big.toBlob(r, "image/jpeg", 0.8));
      if (blob) files.push(new File([blob], `video-${i + 1}.jpg`, { type: "image/jpeg" }));
    }
    return { files, duree, retenues: files.length, candidates };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src"); video.load();
  }
}

function gray(px: Uint8ClampedArray) {
  const out = new Uint8Array(px.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
  return out;
}
function diff(a: Uint8Array, b: Uint8Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
function once(el: HTMLVideoElement, ev: string, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Vidéo illisible sur ce téléphone.")), ms);
    el.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
    el.addEventListener("error", () => { clearTimeout(t); reject(new Error("Format vidéo non pris en charge.")); }, { once: true });
  });
}
async function seek(v: HTMLVideoElement, t: number) {
  if (Math.abs(v.currentTime - t) < 0.01) return;
  v.currentTime = t;
  await once(v, "seeked", 5000);
}
