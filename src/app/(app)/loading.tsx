/** Squelette affiché pendant le chargement d'un écran : la navigation répond tout de suite. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="skeleton mb-2 h-8 w-40" />
      <div className="skeleton mb-5 h-4 w-64" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
      </div>
    </div>
  );
}
