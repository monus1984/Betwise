"use client";

import { useState } from "react";

/** Écusson chargé depuis le fournisseur ; s'il ne vient pas, on garde la pastille à l'initiale. */
export function Ecusson({ src, size, repli }: { src: string; size: number; repli: React.ReactNode }) {
  const [ko, setKo] = useState(false);
  if (ko) return <>{repli}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setKo(true)} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}
