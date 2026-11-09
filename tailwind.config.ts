import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Catégories de risque — une seule palette pour toute l'app
        prudent: "#1f8a5b",
        moyen: "#c98a00",
        risque: "#c43d3d",
      },
    },
  },
  plugins: [],
} satisfies Config;
