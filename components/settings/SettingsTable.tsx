"use client";

import type { ReactNode } from "react";
import SectionCard from "@/components/ui/SectionCard";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function SettingsTable({ title, description, action, children }: Props) {
  return (
    <SectionCard className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description ? <p className="text-xs text-slate-400">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </SectionCard>
  );
}
