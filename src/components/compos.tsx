import type { Absent, Lineup } from "@/lib/api-football/extras";
import { coteDe, marquesDe, nomCourt, rangees, type Evenement, type JoueurCompo, type Marques } from "@/lib/matches/compos";
import { motifFr } from "@/lib/matches/motifs";
import { shortName } from "@/components/match-ui";

type Props = { home: string; away: string; lineups: Lineup[] | null; evts: Evenement[]; absents: Absent[] | null; statut: string };

/**
 * Onglet Compos (25/11), sur le modèle de Flashscore : les schémas, le terrain avec les onze de chaque côté
 * (l'équipe qui reçoit en haut), puis « Compositions de départ », « Remplaçants » et « Joueurs absents »
 * sur deux colonnes. Pas de notes ni de photos : on n'affiche que ce que le fournisseur donne.
 */
export function Compos({ home, away, lineups, evts, absents, statut }: Props) {
  const [h, a] = lineups ?? [];
  const mh = h ? marquesDe(h.titulaires.concat(h.remplacants), evts, "1") : new Map<string, Marques>();
  const ma = a ? marquesDe(a.titulaires.concat(a.remplacants), evts, "2") : new Map<string, Marques>();
  const abs = (absents ?? []).map((x) => ({ ...x, cote: coteDe(x.equipe, home, away, [h?.equipe, a?.equipe]) }));
  return (
    <div className="space-y-3">
      {h && a ? (
        <section className="rounded-xl border border-line bg-surface shadow-card" aria-label="Compositions">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5 text-[13px]">
            <span className="font-display text-lg font-bold tabular-nums">{h.schema ?? "–"}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Schéma</span>
            <span className="text-right font-display text-lg font-bold tabular-nums">{a.schema ?? "–"}</span>
            <span className="truncate text-[11px] text-ink-muted">{shortName(home)}{h.entraineur ? ` · ${h.entraineur}` : ""}</span>
            <span />
            <span className="truncate text-right text-[11px] text-ink-muted">{shortName(away)}{a.entraineur ? ` · ${a.entraineur}` : ""}</span>
          </div>
          <Terrain home={h} away={a} mh={mh} ma={ma} />
          <Liste titre="Compositions de départ" gauche={h.titulaires} droite={a.titulaires} mh={mh} ma={ma} />
          {(h.remplacants.length > 0 || a.remplacants.length > 0) && <Liste titre="Remplaçants" gauche={h.remplacants} droite={a.remplacants} mh={mh} ma={ma} />}
        </section>
      ) : (
        <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <h2 className="text-sm font-semibold">Compositions</h2>
          <p className="mt-1 text-sm text-ink-muted">{statut === "programme" ? "Elles sortent environ une heure avant le coup d’envoi et s’affichent ici d’elles-mêmes." : "Compositions non communiquées pour ce match."}</p>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface shadow-card" aria-label="Joueurs absents">
        <h2 className="px-4 pt-3.5 text-[15px] font-bold">Joueurs absents</h2>
        {absents === null ? (
          <p className="px-4 pb-4 pt-1 text-sm text-ink-muted">{statut === "programme" ? "Disponibles dans les 7 jours avant le match." : "Non communiqués pour ce match."}</p>
        ) : abs.length === 0 ? (
          <p className="px-4 pb-4 pt-1 text-sm text-ink-muted">Aucun absent signalé. Cette information n’est pas suivie pour toutes les compétitions (sélections nationales notamment).</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 px-4 pb-3 pt-2">
            {(["1", "2"] as const).map((c) => (
              <ul key={c} className={c === "2" ? "text-right" : ""}>
                {abs.filter((x) => x.cote === c).map((x) => (
                  <li key={x.joueur} className="border-b border-line/60 py-2 last:border-0">
                    <p className="truncate text-[13.5px] font-medium">{x.joueur}</p>
                    <p className="text-[11.5px] leading-snug text-ink-muted">{x.type === "Questionable" ? "incertain" : ""}{x.type === "Questionable" && x.motif ? " · " : ""}{motifFr(x.motif) ?? (x.type === "Questionable" ? "" : "absent")}</p>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Le terrain : 360 × 560, l'équipe qui reçoit attaque vers le bas. Grille API-Football : colonne 1 = côté droit de l'équipe. */
function Terrain({ home, away, mh, ma }: { home: Lineup; away: Lineup; mh: Map<string, Marques>; ma: Map<string, Marques> }) {
  const W = 360, H = 560, demi = H / 2;
  const place = (l: Lineup, haut: boolean) => {
    const rows = rangees(l.titulaires, l.schema);
    const pas = rows.length > 1 ? (demi - 34 - 44) / (rows.length - 1) : 0;
    return rows.flatMap((r, i) => r.map((p, j) => {
      const yDemi = 34 + i * pas;
      const xDemi = ((j + 0.5) * W) / r.length;
      return { p, x: haut ? xDemi : W - xDemi, y: haut ? yDemi : H - yDemi };
    }));
  };
  const joueurs = [...place(home, true).map((x) => ({ ...x, cote: "1" as const })), ...place(away, false).map((x) => ({ ...x, cote: "2" as const }))];
  return (
    <div className="pitch overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Les deux équipes placées sur le terrain">
        <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2">
          <rect x="8" y="8" width={W - 16} height={H - 16} rx="2" />
          <line x1="8" y1={demi} x2={W - 8} y2={demi} />
          <circle cx={W / 2} cy={demi} r="38" />
          <rect x="74" y="8" width={W - 148} height="68" />
          <rect x="126" y="8" width={W - 252} height="26" />
          <path d={`M ${W / 2 - 30} 76 A 34 34 0 0 0 ${W / 2 + 30} 76`} />
          <rect x="74" y={H - 76} width={W - 148} height="68" />
          <rect x="126" y={H - 34} width={W - 252} height="26" />
          <path d={`M ${W / 2 - 30} ${H - 76} A 34 34 0 0 1 ${W / 2 + 30} ${H - 76}`} />
        </g>
        <circle cx={W / 2} cy={demi} r="2" fill="rgba(255,255,255,0.5)" />
        {joueurs.map(({ p, x, y, cote }) => <Pion key={`${cote}-${p.nom}`} p={p} x={x} y={y} maison={cote === "1"} m={(cote === "1" ? mh : ma).get(p.nom)} />)}
      </svg>
    </div>
  );
}

function Pion({ p, x, y, maison, m }: { p: JoueurCompo; x: number; y: number; maison: boolean; m?: Marques }) {
  const nom = nomCourt(p.nom);
  const w = Math.min(104, nom.length * 5.6 + 10);
  return (
    <g>
      <circle cx={x} cy={y} r="13" fill={maison ? "#fff" : "rgb(var(--c-pitch-deep))"} stroke={maison ? "none" : "rgba(255,255,255,0.9)"} strokeWidth="1.5" />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={maison ? "rgb(var(--c-pitch-deep))" : "#fff"} style={{ fontFeatureSettings: "'tnum' 1" }}>{p.numero ?? "·"}</text>
      {m && (m.buts > 0 || m.csc > 0) && (
        <g>
          <circle cx={x - 14} cy={y - 10} r="7" fill="#fff" />
          <text x={x - 14} y={y - 6.5} fontSize="9" textAnchor="middle">{m.csc && !m.buts ? "🥅" : "⚽"}</text>
          {m.buts > 1 && <text x={x - 24} y={y - 7} fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#fff">{m.buts}</text>}
        </g>
      )}
      {m?.rouge || m?.jaune ? <rect x={x + 10} y={y - 17} width="7" height="9.5" rx="1.5" className={m.rouge ? "fill-band-loss" : "fill-band-draw"} /> : null}
      <rect x={x - w / 2} y={y + 16} width={w} height="14" rx="4" fill="rgba(255,255,255,0.94)" />
      <text x={x} y={y + 26.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="rgb(var(--c-pitch-deep))">{nom}</text>
    </g>
  );
}

function Liste({ titre, gauche, droite, mh, ma }: { titre: string; gauche: JoueurCompo[]; droite: JoueurCompo[]; mh: Map<string, Marques>; ma: Map<string, Marques> }) {
  const n = Math.max(gauche.length, droite.length);
  return (
    <div className="border-t border-line px-4 pb-2 pt-3">
      <h2 className="text-[15px] font-bold">{titre}</h2>
      <ol className="mt-1">
        {Array.from({ length: n }, (_, i) => (
          <li key={i} className="grid grid-cols-2 gap-x-3 border-b border-line/60 py-1.5 text-[13.5px] last:border-0">
            {gauche[i] ? <Ligne p={gauche[i]} m={mh.get(gauche[i].nom)} /> : <span />}
            {droite[i] ? <Ligne p={droite[i]} m={ma.get(droite[i].nom)} droite /> : <span />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Ligne({ p, m, droite }: { p: JoueurCompo; m?: Marques; droite?: boolean }) {
  const marques = m ? `${m.buts ? "⚽".repeat(Math.min(m.buts, 3)) : ""}${m.csc ? "🥅" : ""}${m.rouge ? "🟥" : m.jaune ? "🟨" : ""}` : "";
  return (
    <span className={`flex min-w-0 items-center gap-2 ${droite ? "flex-row-reverse text-right" : ""}`}>
      <span className="w-6 shrink-0 text-xs tabular-nums text-ink-muted" style={{ textAlign: droite ? "left" : "right" }}>{p.numero ?? ""}</span>
      <span className="truncate">{p.nom}{p.poste === "G" ? <span className="text-ink-muted"> (G)</span> : null}</span>
      {marques && <span className="shrink-0 text-[11px]" aria-label="buts et cartons">{marques}</span>}
    </span>
  );
}
