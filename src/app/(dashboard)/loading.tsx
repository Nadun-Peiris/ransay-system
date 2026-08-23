export default function DashboardLoading() {
  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-stone-200" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-stone-200" />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
            <div className="mt-4 h-8 w-40 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </section>
    </main>
  );
}
