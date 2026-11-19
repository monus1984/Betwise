/**
 * Betster animé, étape 1 (19/11) : le portrait validé, sans aucune retouche de son apparence, animé par le cadre.
 * Au repos il respire, quand il consulte les données un anneau tourne, quand il parle un halo bat au rythme de la voix.
 * Tout s'arrête si l'utilisateur a demandé moins d'animations.
 */
export type EtatBetster = "repos" | "pense" | "parle";
const LIBELLE: Record<EtatBetster, string> = { repos: "Betster", pense: "Betster consulte tes données", parle: "Betster parle" };

export function BetsterAnime({ etat, taille = 64 }: { etat: EtatBetster; taille?: number }) {
  return (
    <span className={`betster-anime relative inline-flex shrink-0 rounded-full`} data-etat={etat} role="img" aria-label={LIBELLE[etat]} style={{ width: taille, height: taille }}>
      <span aria-hidden className="betster-anneau absolute -inset-[5px] rounded-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/betster/betster-112.webp" alt="" width={taille} height={taille} className="betster-portrait relative rounded-full ring-2 ring-brand/70" style={{ width: taille, height: taille }} />
    </span>
  );
}
