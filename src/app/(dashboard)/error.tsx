"use client";

import Link from "next/link";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="p-6 font-sans text-black">
      <section className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-500">
          The dashboard could not load this page.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
          >
            Try again
          </button>
          <Link
            href="/analytics"
            className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
          >
            Back to Analytics
          </Link>
        </div>
      </section>
    </main>
  );
}
