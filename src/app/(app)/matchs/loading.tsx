export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement des matchs">
      <div className="skeleton mb-2 h-8 w-32" />
      <div className="skeleton mb-4 h-4 w-72" />
      <div className="mb-4 flex gap-1.5">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-[62px] w-[54px]" />)}</div>
      {[0, 1].map((g) => (
        <div key={g} className="mb-4 overflow-hidden rounded-xl border border-line bg-white">
          <div className="h-8 bg-surface-2" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 border-t border-line px-3 py-3">
              <div className="skeleton h-4 w-10" /><div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-32" /><div className="skeleton h-3.5 w-28" /></div>
              <div className="flex gap-1">{[0, 1, 2].map((k) => <div key={k} className="skeleton h-9 w-[38px] rounded-md" />)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
