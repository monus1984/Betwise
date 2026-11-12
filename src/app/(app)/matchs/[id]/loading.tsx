export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement du match">
      <div className="skeleton mb-3 h-4 w-20" />
      <div className="mb-3 h-52 rounded-3xl bg-pitch/90" />
      <div className="skeleton mb-3 h-10 w-full" />
      <div className="skeleton h-48 w-full" />
    </div>
  );
}
