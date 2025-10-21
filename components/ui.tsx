// components/ui.tsx
export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      className={`rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
      {...rest}
    />
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-slate-700">{children}</h2>;
}

export const k = {
  kpi: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
};
