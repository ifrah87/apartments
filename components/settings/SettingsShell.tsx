"use client";

import type { ReactNode } from "react";

type Toast = { type: "success" | "error"; message: string } | null;

type Props = {
  title: string;
  description: string;
  onSave: () => void;
  onReset?: () => void;
  saving?: boolean;
  toast?: Toast;
  onDismissToast?: () => void;
  children: ReactNode;
};

export default function SettingsShell({
  title,
  description,
  onSave,
  onReset,
  saving,
  toast,
  onDismissToast,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Settings / {title}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
            >
              Reset to defaults
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-rose-400/30 bg-rose-400/10 text-rose-200"
          }`}
        >
          <span>{toast.message}</span>
          {onDismissToast ? (
            <button type="button" onClick={onDismissToast} className="text-xs uppercase tracking-widest">
              Close
            </button>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
