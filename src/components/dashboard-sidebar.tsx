"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileInput,
  LineChart,
  PackageSearch,
  PlusCircle,
  ReceiptText,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

const baseNavItems = [
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "All Orders", href: "/all-orders", icon: Star },
  { label: "Create Order", href: "/create-order", icon: PlusCircle },
  { label: "Stocks", href: "/stocks", icon: Boxes },
  { label: "Customers", href: "/customers/search", icon: Users },
  { label: "Products", href: "/products/search", icon: PackageSearch },
  { label: "Total Sales", href: "/analytics/total-sales", icon: TrendingUp },
  { label: "Customer Sales", href: "/analytics/customer-sales", icon: BarChart3 },
  { label: "Product Sales", href: "/analytics/product-sales", icon: LineChart },
  { label: "Expenses", href: "/finance/expenses", icon: ReceiptText },
  { label: "Investments", href: "/finance/investments", icon: WalletCards },
  { label: "Profit & Loss", href: "/finance/profit-loss", icon: ClipboardList },
  { label: "Import", href: "/import", icon: FileInput },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/orders") {
    return pathname === "/orders" || pathname.startsWith("/orders/");
  }

  if (href === "/all-orders") {
    return pathname === "/all-orders";
  }

  return pathname === href;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();

        if (isMounted && response.ok && result.success) {
          setCurrentUser(result.data as CurrentUser);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const isSuperadmin = currentUser?.role === "SUPERADMIN";
  const navItems = baseNavItems
    .filter((item) => isSuperadmin || item.label !== "All Orders");
  const homeHref = "/orders";

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 border-r border-stone-200 bg-white lg:fixed lg:left-0 lg:top-0 lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b border-stone-200 px-5">
        <Link href={homeHref} className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFBF01] text-base font-black text-black shadow-sm">
            R
          </span>
          <span>
            <span className="block text-base font-black leading-tight text-black">
              Ransay System
            </span>
            <span className="block text-xs font-medium text-stone-500">
              Operations
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              isActivePath(pathname, item.href) ||
              (item.label === "Orders" && pathname.startsWith("/orders/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[#FFBF01] text-black shadow-sm"
                    : "text-stone-600 hover:bg-stone-100 hover:text-black"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
