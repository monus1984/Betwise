import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BETWISE",
    short_name: "BETWISE",
    description: "Comprends, mesure et maîtrise tes décisions de pari.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Cible de partage (Android) : texte partagé depuis une app de paris → /import
    share_target: {
      action: "/import/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "image", accept: ["image/*"] }] },
    },
  } as MetadataRoute.Manifest;
}
