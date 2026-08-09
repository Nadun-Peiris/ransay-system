"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function redirectIfLoggedIn() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();

        if (isMounted && response.ok && result.success) {
          router.replace("/analytics");
        }
      } catch {
        // Keep the login form visible for unauthenticated users.
      }
    }

    void redirectIfLoggedIn();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Login failed.");
      }

      router.replace("/analytics");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login failed."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FDFCF9] px-4 py-10 text-black">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFBF01] font-bold text-black shadow-sm">
            R
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Ransay Admin</h1>
          <p className="mt-2 text-sm font-medium text-stone-500">
            Sign in to manage orders and operations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-stone-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:bg-white focus:ring-1 focus:ring-[#FFBF01]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-stone-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:bg-white focus:ring-1 focus:ring-[#FFBF01]"
            />
          </div>

          {errorMessage && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#FFBF01] px-5 py-3.5 text-sm font-bold text-black shadow-sm transition-colors hover:bg-[#e5ab00] focus:outline-none focus:ring-4 focus:ring-[#FFBF01]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
