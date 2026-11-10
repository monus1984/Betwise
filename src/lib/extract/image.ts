import sharp from "sharp";
import type { LlmImage } from "../llm/provider";

/**
 * Prépare une capture pour le LLM :
 * - largeur ramenée à 1000 px (le texte des apps reste lisible, le poids chute) ;
 * - captures longues découpées en tuiles de 1800 px avec 160 px de chevauchement, pour qu'aucune ligne ne soit coupée ;
 * - JPEG qualité 82.
 * Limite : 8 tuiles (≈ 14 000 px d'origine), au-delà on tronque et on le signale.
 */
export async function prepareTicketImage(buffer: Buffer): Promise<{ images: LlmImage[]; truncated: boolean; width: number; height: number }> {
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0, height = meta.height ?? 0;
  if (!width || !height) throw new Error("Image illisible");

  const targetW = Math.min(1000, width);
  const scale = targetW / width;
  const scaledH = Math.round(height * scale);
  const resized = await base.resize({ width: targetW }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();

  const TILE = 1800, OVERLAP = 160, MAX = 8;
  if (scaledH <= TILE + OVERLAP) {
    return { images: [{ mediaType: "image/jpeg", base64: resized.toString("base64") }], truncated: false, width, height };
  }

  const images: LlmImage[] = [];
  let top = 0, truncated = false;
  while (top < scaledH) {
    if (images.length >= MAX) { truncated = true; break; }
    const h = Math.min(TILE, scaledH - top);
    const tile = await sharp(resized).extract({ left: 0, top, width: targetW, height: h }).jpeg({ quality: 82 }).toBuffer();
    images.push({ mediaType: "image/jpeg", base64: tile.toString("base64") });
    if (top + h >= scaledH) break;
    top += TILE - OVERLAP;
  }
  return { images, truncated, width, height };
}
