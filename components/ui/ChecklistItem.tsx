import type { ReactNode } from "react";
import { Check } from "lucide-react";

export default function ChecklistItem({
  title,
  description,
  status,
  action,
  onToggle,
}: {
  title: string;
  description?: string;
  status: "done" | "pending";
  action?: ReactNode;
  onToggle?: () => void;
}) {
  const done = status === "done";

  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm ${
        onToggle ? "cursor-pointer" : ""
      }`}
      onClick={onToggle}
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onToggle) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="flex items-start gap-3">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={done}
            className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
              done
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 text-transparent hover:border-emerald-300"
            }`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Check className="h-4 w-4" />
          </button>
        ) : (
          <span
            className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border ${
              done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"
            }`}
            aria-hidden="true"
          >
            <Check className="h-4 w-4" />
          </span>
        )}
        <div>
          <p className={`text-base font-semibold ${done ? "text-slate-900" : "text-slate-800"}`}>{title}</p>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
