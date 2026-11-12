"use client";

import { useEffect } from "react";

/** Enregistre le service worker qui reçoit les partages Android (captures, vidéos). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
