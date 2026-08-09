import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F0] px-4 py-10 text-black">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFBF01] text-lg font-black text-black">
          R
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm font-medium text-stone-500">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/analytics"
            className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
          >
            Back to Analytics
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
          >
            Back to Login
          </Link>
        </div>
      </section>
    </main>
  );
}
