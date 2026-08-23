"use client";

import { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastEventDetail = {
  message: string;
  variant?: ToastVariant;
};

const TOAST_EVENT = "ransay:toast";

export function showToast(message: string, variant: ToastVariant = "info") {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
      detail: { message, variant },
    })
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const { message, variant = "info" } = (
        event as CustomEvent<ToastEventDetail>
      ).detail;
      const id = Date.now() + Math.random();

      setToasts((current) => [...current, { id, message, variant }]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg ${
            toast.variant === "success"
              ? "border-emerald-200 text-emerald-800"
              : toast.variant === "error"
              ? "border-red-200 text-red-800"
              : "border-stone-200 text-stone-800"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
