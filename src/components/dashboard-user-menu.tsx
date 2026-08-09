"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

export function DashboardUserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load current user.");
        }

        if (isMounted) {
          setUser(result.data as CurrentUser);
        }
      } catch {
        router.replace("/login");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);

      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-bold text-black">
          {isLoading ? "Loading..." : user?.name ?? "User"}
        </p>
        <div className="mt-1 flex justify-end">
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-stone-700">
            {user?.role ?? "ADMIN"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingOut ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
