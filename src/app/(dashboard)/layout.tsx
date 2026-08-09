import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardUserMenu } from "@/components/dashboard-user-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F5F0] text-black">
      <DashboardSidebar />

      <div className="min-h-screen lg:pl-[260px]">
        <header className="fixed left-0 right-0 top-0 z-30 h-20 border-b border-stone-200 bg-white/95 backdrop-blur lg:left-[260px]">
          <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFBF01] text-base font-black text-black shadow-sm">
                R
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-black">
                  Ransay System
                </p>
                <p className="text-xs font-medium text-stone-500">
                  Operations
                </p>
              </div>
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-stone-500">
                Dashboard
              </p>
            </div>

            <DashboardUserMenu />
          </div>
        </header>

        <div className="min-h-screen pt-20">{children}</div>
      </div>
    </div>
  );
}
