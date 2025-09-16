type KpiCardProps = { title: string; value: string | number };

export default function KpiCard({ title, value }: KpiCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="text-slate-500 text-sm">{title}</div>
      <div className="text-slate-900 font-extrabold text-xl">{value}</div>
    </div>
  );
}
