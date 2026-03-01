"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

const DEFAULT_STATE: ConfirmState = {
  open: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "default",
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmState>(DEFAULT_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeDialog = useCallback((confirmed: boolean) => {
    setDialog(DEFAULT_STATE);
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        open: true,
        title: options.title || "Confirm Action",
        message: options.message,
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
      });
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const confirmButtonClass =
    dialog.tone === "danger"
      ? "rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400"
      : "rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-accent-strong";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog.open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">{dialog.title}</h2>
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="rounded-full border border-white/10 p-2 text-slate-200 hover:border-white/20"
                aria-label="Close confirmation dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-400">{dialog.message}</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  {dialog.cancelLabel}
                </button>
                <button type="button" onClick={() => closeDialog(true)} className={confirmButtonClass}>
                  {dialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
