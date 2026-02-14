import React from "react";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function DataTable({ className = "", children }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface/70">
      <table className={`w-full text-sm ${className}`}>{children}</table>
    </div>
  );
}
