import Link from "next/link";
import type { ElementType } from "react";

type ReportListItem = {
  title: string;
  description: string;
  href: string;
  Icon?: ElementType;
};

type Props = {
  items: ReportListItem[];
  actionLabel?: string;
};

export default function ReportList({ items, actionLabel = "Open" }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50"
        >
          <div className="flex items-start gap-3">
            {item.Icon ? (
              <span className="mt-0.5 grid h-6 w-6 place-items-center text-slate-400">
                <item.Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-indigo-600">{actionLabel}</span>
        </Link>
      ))}
    </div>
  );
}
