import type { Config } from "tailwindcss";

/**
 * Identité BETWISE : la pelouse un soir de match. Vert profond pour les bandeaux (terrain), orange vif pour agir
 * (l'orange ivoirien), neutres légèrement verts. Les couleurs de résultat restent à part : vert gagné, rouge perdu, or nul.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Barlow", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Barlow Condensed", "Barlow", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#10201a", soft: "#36433d", muted: "#5f6e66" },
        line: "#dde5e0",
        canvas: "#eef2ef",
        surface: { DEFAULT: "#ffffff", 2: "#ebf0ed" },
        // Terrain : bandeaux, tableau d'affichage
        pitch: { DEFAULT: "#0e3b2e", deep: "#0a2b22", light: "#17513f" },
        // Action (boutons, liens, sélection)
        brand: { DEFAULT: "#d4500c", soft: "#fdeee4" },
        gain: "#17805a",
        loss: "#c2362f",
        draw: "#a8780a",
        prudent: "#17805a",
        moyen: "#b98500",
        risque: "#c2362f",
        // Neutres de l'appli (remplacent le gris-bleu par défaut partout où « slate » est utilisé)
        slate: { 50: "#f4f7f5", 100: "#ebf0ed", 200: "#dde5e0", 300: "#c5d0ca", 400: "#8d9c94", 500: "#5f6e66", 600: "#4c5a53", 700: "#36433d", 800: "#1f2b26", 900: "#10201a" },
      },
      boxShadow: { card: "0 1px 0 rgba(16,32,26,.04), 0 6px 16px -10px rgba(16,32,26,.18)" },
    },
  },
  plugins: [],
} satisfies Config;
