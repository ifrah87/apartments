import React from "react";

type Variant = "success" | "warning" | "danger" | "info";

const VARIANTS: Record<Variant, string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  danger: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  info: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
};

type Props = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

export function Badge({ variant = "info", className = "", children }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
