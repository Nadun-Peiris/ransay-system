"use client";

import type { ReactNode } from "react";

export function ChartCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-black">{title}</h2>
        {description && (
          <p className="mt-1 text-sm font-medium text-stone-500">
            {description}
          </p>
        )}
      </div>
      {children}
      {footer && <div className="mt-4 text-sm text-stone-500">{footer}</div>}
    </section>
  );
}
