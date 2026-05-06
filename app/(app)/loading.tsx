export default function AppLoading() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-3 pt-2 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
