import type { Config } from "tailwindcss";

/**
 * Couleurs par rôle, jamais par teinte : chaque jeton pointe sur une variable définie pour le thème clair et le thème
 * sombre dans globals.css. Un écran n'écrit donc aucune couleur en dur (vérifié par src/lib/theme.test.ts).
 * « brand » = action (boutons, liens). « gain / loss / draw » = résultat. « *-soft » = fond teinté, « *-ink » = texte posé dessus.
 * « on-fill » = texte sur un aplat de couleur, « inverse / on-inverse » = élément sélectionné.
 */
const v = (n: string) => `rgb(var(--c-${n}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        // Réservée aux scores de match
        display: ["Barlow Condensed", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), muted: v("ink-muted") },
        line: v("line"),
        canvas: v("canvas"),
        surface: { DEFAULT: v("surface"), 2: v("surface2") },
        pitch: { DEFAULT: v("pitch"), deep: v("pitch-deep"), light: v("pitch-light") },
        brand: { DEFAULT: v("brand"), soft: v("brand-soft") },
        "on-fill": v("on-fill"),
        inverse: v("inverse"),
        "on-inverse": v("on-inverse"),
        gain: { DEFAULT: v("gain"), soft: v("gain-soft"), ink: v("gain-ink") },
        loss: { DEFAULT: v("loss"), soft: v("loss-soft"), ink: v("loss-ink") },
        draw: { DEFAULT: v("draw"), soft: v("draw-soft"), ink: v("draw-ink") },
        info: { DEFAULT: v("info"), soft: v("info-soft"), ink: v("info-ink") },
        // Sur le bandeau bleu nuit, identique dans les deux thèmes
        band: { gain: "#7BE0A0", loss: "#FF9D94", draw: "#F2C14E" },
        prudent: v("gain"),
        moyen: v("draw"),
        risque: v("loss"),
        slate: { 50: v("s50"), 100: v("s100"), 200: v("s200"), 300: v("s300"), 400: v("s400"), 500: v("s500"), 600: v("s600"), 700: v("s700"), 800: v("s800"), 900: v("s900") },
      },
      boxShadow: { card: "0 1px 0 rgb(0 0 0 / .04), 0 6px 16px -10px rgb(0 0 0 / .25)" },
    },
  },
  plugins: [],
} satisfies Config;
