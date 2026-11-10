import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      colors: {
        // Encre et surfaces
        ink: { DEFAULT: "#0f172a", soft: "#334155", muted: "#64748b" },
        line: "#e2e8f0",
        canvas: "#f4f6f8",
        surface: { DEFAULT: "#ffffff", 2: "#f1f5f9" },
        // Accent interactif (liens, sélection) — distinct des couleurs de résultat
        brand: { DEFAULT: "#3b5bdb", soft: "#edf2ff" },
        // Résultats et risque — une seule palette pour toute l'app
        gain: "#1f8a5b",
        loss: "#c43d3d",
        draw: "#b7791f",
        prudent: "#1f8a5b",
        moyen: "#c98a00",
        risque: "#c43d3d",
      },
      boxShadow: { card: "0 1px 2px rgba(15,23,42,.04), 0 1px 1px rgba(15,23,42,.03)" },
    },
  },
  plugins: [],
} satisfies Config;
