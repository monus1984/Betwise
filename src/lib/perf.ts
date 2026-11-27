/** Mesure du temps serveur par étape (27/11) : une ligne « [perf] » par page dans les journaux Vercel. Sans donnée personnelle. */
export function chrono(page: string) {
  const t0 = Date.now(); const etapes: string[] = [];
  return {
    async e<T>(nom: string, p: Promise<T>): Promise<T> { const t = Date.now(); try { return await p; } finally { etapes.push(`${nom}=${Date.now() - t}`); } },
    fin() { console.log(`[perf] ${page} total=${Date.now() - t0} ${etapes.join(" ")}`); },
  };
}
