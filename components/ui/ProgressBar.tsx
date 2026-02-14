export default function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className="h-2 rounded-full bg-emerald-500 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
