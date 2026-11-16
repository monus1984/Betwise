import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** L'appli rapporte des probabilités : elle ne promet rien et ne donne pas d'avis. Ces mots ne doivent plus s'afficher. */
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) && !/database\.types/.test(f) ? [p] : [];
});
const INTERDIT = /(?<![\p{L}])(?:sûre?s?|mon avis|garantie?s?|sans risque)(?![\p{L}])/iu;

describe("vocabulaire", () => {
  it("aucun « sûr », « mon avis », « garanti » ni « sans risque » dans les textes affichés ou envoyés au Coach", () => {
    const fautes: string[] = [];
    for (const f of files("src")) {
      let bloc = false;
      readFileSync(f, "utf8").split("\n").forEach((ligne, i) => {
        const t = ligne.trim();
        if (bloc) { if (t.includes("*/")) bloc = false; return; }
        if (t.startsWith("/*")) { if (!t.includes("*/")) bloc = true; return; }
        if (t.startsWith("//") || t.startsWith("*")) return;
        const code = ligne.replace(/\s\/\/ .*$/, "");          // commentaire en fin de ligne
        if (code.includes("N’écris jamais")) return;           // la consigne du Coach cite les mots qu'elle interdit
        if (INTERDIT.test(code)) fautes.push(`${f}:${i + 1} ${t.slice(0, 90)}`);
      });
    }
    expect(fautes).toEqual([]);
  });
});
