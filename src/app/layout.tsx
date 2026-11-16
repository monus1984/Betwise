import { APP_NAME } from "@/lib/app-name";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Comprends, mesure et maîtrise tes décisions de pari.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0B2B4C" }, { media: "(prefers-color-scheme: dark)", color: "#0E2638" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">
        {/* Thème choisi dans Réglages, appliqué avant le premier affichage pour éviter un éclair de l'autre thème */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('bw-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" }} />
        {/* La proposition d'installation du navigateur peut arriver avant le chargement de la page : on la garde */}
        <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bwInstall=e});if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}" }} />
        {children}
      </body>
    </html>
  );
}
