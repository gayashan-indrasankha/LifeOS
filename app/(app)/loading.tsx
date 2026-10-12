export default function Loading() {
  return (
    <div aria-label="Loading page" className="space-y-6" role="status">
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl border bg-card" />
        <div className="h-48 animate-pulse rounded-2xl border bg-card" />
      </div>
    </div>
  );
}
