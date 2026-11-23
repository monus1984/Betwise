"use client";
import { useEffect, useRef, useState } from "react";
import { Dictee } from "@/components/dictee";
import { speakText, stopSpeaking, unlockAudio } from "@/lib/coach/speak";
import { GROUPES, PROJETS, type ModeleConsole, type PieceJointe } from "@/lib/console/modeles";

type Info = ModeleConsole & { image: boolean; prix: [number, number] | null; disponible: boolean };
type Reponse = { id: string; nom: string; etat: "attente" | "ok" | "erreur"; texte?: string; erreur?: string; cout?: number | null; ms?: number; modele?: string };
type Consultation = { quand: string; projet: string; question: string; reponses: Reponse[]; synthese?: Reponse };

const HISTO = "console-ia-historique";
const lireHisto = (): Consultation[] => { try { return JSON.parse(localStorage.getItem(HISTO) ?? "[]"); } catch { return []; } };
const ecrireHisto = (h: Consultation[]) => { try { localStorage.setItem(HISTO, JSON.stringify(h.slice(0, 20))); } catch { /* stockage plein ou refusé */ } };
const dollars = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x < 0.01 ? `${(x * 100).toFixed(2).replace(".", ",")} ¢` : `${x.toFixed(3).replace(".", ",")} $`);

/** Réduit une photo (1600 px au plus, JPEG) pour rester sous la taille autorisée d'une requête. */
async function reduire(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function ConsoleIA() {
  const [infos, setInfos] = useState<Info[]>([]);
  const [choix, setChoix] = useState<Set<string>>(new Set(["anthropic:claude-sonnet-5-5", "openai/gpt-6.2-sol", "google/gemini-4-carbon", "x-ai/grok-4.7"]));
  const [projet, setProjet] = useState("betwise");
  const [question, setQuestion] = useState("");
  const [pieces, setPieces] = useState<PieceJointe[]>([]);
  const [cours, setCours] = useState<Consultation | null>(null);
  const [histo, setHisto] = useState<Consultation[]>([]);
  const [lecture, setLecture] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => { setHisto(lireHisto()); fetch("/api/console/modeles").then((r) => r.json()).then((x) => Array.isArray(x) && setInfos(x)).catch(() => {}); }, []);

  const basculer = (id: string) => setChoix((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ajouter = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 6)) {
      if (f.type.startsWith("image/")) { const dataUrl = await reduire(f); setPieces((p) => [...p, { type: "image", nom: f.name, dataUrl }]); }
      else if (f.size < 300_000) { const contenu = (await f.text()).slice(0, 40_000); setPieces((p) => [...p, { type: "texte", nom: f.name, contenu }]); }
    }
    if (fichier.current) fichier.current.value = "";
  };
  const images = pieces.some((p) => p.type === "image");

  async function envoyer() {
    const ids = [...choix].filter((id) => infos.find((i) => i.id === id)?.disponible !== false);
    if (!ids.length || (!question.trim() && !pieces.length)) return;
    const c: Consultation = { quand: new Date().toISOString(), projet, question, reponses: ids.map((id) => ({ id, nom: infos.find((i) => i.id === id)?.nom ?? id, etat: "attente" })) };
    setCours(c);
    const maj = (id: string, r: Partial<Reponse>) => setCours((x) => x && ({ ...x, reponses: x.reponses.map((y) => (y.id === id ? { ...y, ...r } : y)) }));
    const finies = await Promise.all(ids.map(async (id) => {
      const res = await fetch("/api/console/demander", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modele: id, question, projet, pieces }) })
        .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({ error: `erreur ${r.status}` })) })).catch((e) => ({ ok: false, j: { error: String(e) } }));
      const r: Reponse = res.ok ? { id, nom: c.reponses.find((y) => y.id === id)!.nom, etat: "ok", texte: res.j.texte, cout: res.j.cout, ms: res.j.ms, modele: res.j.modele }
        : { id, nom: c.reponses.find((y) => y.id === id)!.nom, etat: "erreur", erreur: res.j.error, cout: res.j.cout ?? null };
      maj(id, r); return r;
    }));
    let synthese: Reponse | undefined;
    const ok = finies.filter((r) => r.etat === "ok");
    if (ok.length >= 2) {
      setCours((x) => x && ({ ...x, synthese: { id: "synthese", nom: "Synthèse de Claude", etat: "attente" } }));
      const s = await fetch("/api/console/demander", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, projet, synthese: ok.map((r) => ({ nom: r.nom, texte: r.texte })) }) })
        .then((r) => r.json()).catch(() => null);
      synthese = s?.texte ? { id: "synthese", nom: "Synthèse de Claude", etat: "ok", texte: s.texte, cout: s.cout, ms: s.ms } : { id: "synthese", nom: "Synthèse de Claude", etat: "erreur", erreur: s?.error ?? "échec" };
      setCours((x) => x && ({ ...x, synthese }));
    }
    const fin = { ...c, reponses: finies, synthese };
    const h = [fin, ...lireHisto()]; ecrireHisto(h); setHisto(h.slice(0, 20));
  }

  const ecouter = (id: string, texte?: string) => {
    if (!texte) return;
    if (lecture === id) { stopSpeaking(); setLecture(null); return; }
    unlockAudio(); stopSpeaking(); setLecture(id); speakText(texte.slice(0, 1200), () => setLecture(null));
  };
  const total = cours ? [...cours.reponses, ...(cours.synthese ? [cours.synthese] : [])].reduce((s, r) => s + (r.cout ?? 0), 0) : 0;
  const enCours = !!cours && (cours.reponses.some((r) => r.etat === "attente") || cours.synthese?.etat === "attente");

  const Carte = ({ r, accent }: { r: Reponse; accent?: boolean }) => (
    <article className={`rounded-2xl border p-3 ${accent ? "border-brand bg-surface" : "border-line bg-surface"}`}>
      <header className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{r.nom}</h3>
        <span className="text-[11px] text-ink-muted">{r.etat === "attente" ? "réfléchit…" : r.etat === "erreur" ? "pas de réponse" : `${Math.round((r.ms ?? 0) / 1000)} s · ${dollars(r.cout)}`}</span>
      </header>
      {r.etat === "ok" && <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.texte}</p>}
      {r.etat === "erreur" && <p className="text-sm text-loss-ink">{r.erreur}</p>}
      {r.etat === "ok" && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => ecouter(r.id, r.texte)} className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold">{lecture === r.id ? "Arrêter" : "Écouter"}</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(r.texte ?? "")} className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold">Copier</button>
        </div>
      )}
    </article>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <h1 className="text-xl font-bold">Console IA</h1>
      <p className="mb-4 text-sm text-ink-soft">Pose une question à plusieurs IA en même temps, avec texte, voix, photos ou fichiers. Claude compare ensuite leurs réponses.</p>

      <section className="mb-3">
        <h2 className="mb-1.5 text-xs font-semibold text-ink-soft">Projet</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PROJETS).map(([k, p]) => (
            <button key={k} type="button" onClick={() => setProjet(k)} aria-pressed={projet === k}
              className={`min-h-10 rounded-full border px-3 text-sm ${projet === k ? "border-brand bg-brand text-on-fill" : "border-line bg-surface"}`}>{p.nom}</button>
          ))}
        </div>
      </section>

      <section className="mb-3">
        <h2 className="mb-1.5 text-xs font-semibold text-ink-soft">IA interrogées</h2>
        {(Object.keys(GROUPES) as (keyof typeof GROUPES)[]).map((g) => (
          <div key={g} className="mb-2">
            <p className="mb-1 text-[11px] text-ink-muted">{GROUPES[g]}</p>
            <div className="flex flex-wrap gap-2">
              {infos.filter((i) => i.groupe === g).map((i) => (
                <label key={i.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${choix.has(i.id) ? "border-brand bg-surface-2" : "border-line bg-surface"} ${!i.disponible ? "opacity-50" : ""}`}>
                  <input type="checkbox" className="accent-brand" checked={choix.has(i.id)} disabled={!i.disponible} onChange={() => basculer(i.id)} />
                  <span>{i.nom}{images && !i.image ? " (sans les photos)" : ""}</span>
                  <span className="text-[11px] text-ink-muted">{i.prix ? (i.prix[0] === 0 && i.prix[1] === 0 ? "gratuit" : `${i.prix[0].toFixed(2).replace(".", ",")} / ${i.prix[1].toFixed(2).replace(".", ",")} $`) : ""}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-ink-muted">Prix pour un million de mots-unités lus / écrits. Une question courte coûte en général moins d’un centime par IA.</p>
      </section>

      <section className="mb-3 rounded-2xl border border-line bg-surface p-3">
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={5} placeholder="Ta question…"
          className="w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-base outline-none focus:border-brand" />
        {!!pieces.length && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {pieces.map((p, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1 text-xs">
                {p.type === "image" ? <img src={p.dataUrl} alt="" className="h-8 w-8 rounded object-cover" /> : "📄"} {p.nom}
                <button type="button" aria-label={`Retirer ${p.nom}`} onClick={() => setPieces((x) => x.filter((_, j) => j !== i))} className="min-h-8 px-1 font-bold">×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Dictee onTexte={(t) => setQuestion((q) => (q ? `${q} ${t}` : t))} />
          <button type="button" onClick={() => fichier.current?.click()} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">Photo ou fichier</button>
          <input ref={fichier} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.ts,.tsx,.js,.sql,.html,.css" className="hidden" onChange={(e) => ajouter(e.target.files)} />
          <button type="button" onClick={envoyer} disabled={enCours || !choix.size || (!question.trim() && !pieces.length)}
            className="ml-auto min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-on-fill disabled:opacity-50">{enCours ? "En cours…" : `Demander à ${choix.size} IA`}</button>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">N’envoie ni mot de passe, ni clé, ni donnée personnelle d’un tiers : les questions partent chez les fournisseurs des IA.</p>
      </section>

      {cours && (
        <section className="mb-6 space-y-3" aria-live="polite">
          <p className="text-xs text-ink-muted">{PROJETS[cours.projet]?.nom} · coût de cette question : <b>{dollars(total)}</b></p>
          {cours.synthese && <Carte r={cours.synthese} accent />}
          <div className="grid gap-3 md:grid-cols-2">{cours.reponses.map((r) => <Carte key={r.id} r={r} />)}</div>
        </section>
      )}

      {!!histo.length && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold text-ink-soft">Dernières questions (sur cet appareil)</h2>
          <ul className="space-y-1.5">
            {histo.map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => { setCours(h); setProjet(h.projet); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm">
                  <span className="line-clamp-1">{h.question || "(photo ou fichier)"}</span>
                  <span className="text-[11px] text-ink-muted">{new Date(h.quand).toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" })} · {PROJETS[h.projet]?.nom} · {h.reponses.length} IA</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
