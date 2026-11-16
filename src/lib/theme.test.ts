import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "./theme-tokens.json";

/** Garde-fou des deux thèmes : aucun écran n'écrit une couleur en dur, et chaque couple texte/fond reste lisible. */

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) ? [p] : [];
});

// Teintes Tailwind brutes et blanc/noir pleins : interdits, seuls les jetons par rôle changent avec le thème.
const TEINTE = /\b(?:bg|text|border|ring|divide|from|to|via|fill|stroke|outline)-(?:emerald|green|red|rose|amber|yellow|orange|sky|blue|indigo|violet|purple|pink|teal|cyan|lime|gray|zinc|neutral|stone)-\d{2,3}\b/g;
const BLANC = /\b(?:bg-white|bg-black|text-black)\b(?!\/)/g;
const HEX = /#[0-9a-fA-F]{6}\b/g;
// Exceptions assumées : le logo, les pastilles d'équipe (texte blanc sur teinte fixe), les barres posées sur le bandeau.
const PERMIS: Record<string, RegExp> = {
  "src/components/icons.tsx": HEX,
  "src/components/match-ui.tsx": HEX,
  "src/app/layout.tsx": HEX,
  "src/app/(app)/matchs/[id]/page.tsx": BLANC,
};

describe("thèmes", () => {
  it("aucune couleur en dur dans les écrans", () => {
    const fautes: string[] = [];
    for (const f of files("src")) {
      const src = readFileSync(f, "utf8");
      for (const re of [TEINTE, BLANC, HEX]) {
        if (PERMIS[f.replaceAll("\\", "/")] === re) continue;
        for (const m of src.match(re) ?? []) fautes.push(`${f} : ${m}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const COUPLES = [
    ["ink", "canvas"], ["ink", "surface"], ["ink-soft", "surface"], ["ink-muted", "surface"], ["ink-muted", "canvas"], ["ink-muted", "surface2"],
    ["brand", "surface"], ["brand", "canvas"], ["brand", "brand-soft"], ["on-fill", "brand"], ["on-fill", "gain"], ["on-fill", "loss"], ["on-fill", "draw"],
    ["on-inverse", "inverse"], ["gain", "surface"], ["loss", "surface"], ["draw", "surface"], ["gain", "gain-soft"], ["loss", "loss-soft"],
    ["gain-ink", "gain-soft"], ["loss-ink", "loss-soft"], ["draw-ink", "draw-soft"], ["info-ink", "info-soft"], ["s400", "surface"], ["s500", "surface"],
  ] as const;

  for (const mode of ["light", "dark"] as const) {
    it(`contraste d'au moins 4,5 pour 1 en thème ${mode === "light" ? "clair" : "sombre"}`, () => {
      const t = tokens[mode] as Record<string, string>;
      const faibles = COUPLES.map(([a, b]) => [a, b, contraste(t[a], t[b])] as const).filter(([, , r]) => r < 4.5).map(([a, b, r]) => `${a} sur ${b} : ${r.toFixed(2)}`);
      expect(faibles).toEqual([]);
    });
  }

  it("le CSS porte les valeurs du fichier de jetons", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
    for (const mode of ["light", "dark"] as const)
      for (const [k, v] of Object.entries(tokens[mode])) expect(css, `${mode} ${k}`).toContain(`--c-${k.replace("surface2", "surface2")}: ${rgb(v)};`);
  });
});
