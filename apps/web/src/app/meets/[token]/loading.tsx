export default function LoadingInvitation() {
  return (
    <main className="mx-auto min-h-svh max-w-6xl px-5 py-20" role="status">
      <div className="h-6 w-28 animate-pulse rounded bg-white/5" />
      <div className="mt-5 h-12 max-w-2xl animate-pulse rounded bg-white/5" />
      <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white/[0.035]" />
      <span className="sr-only">Loading invitation…</span>
    </main>
  );
}
