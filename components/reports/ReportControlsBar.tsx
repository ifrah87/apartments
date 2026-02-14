import Link from "next/link";

type PropertyOption = { id: string; name?: string };

type PresetOption = { value: string; label: string };

type Props = {
  action: string;
  start: string;
  end: string;
  property?: string;
  properties?: PropertyOption[];
  presets?: PresetOption[];
  presetName?: string;
  presetValue?: string;
  exportCsvHref?: string;
  exportPdfHref?: string;
  extraControls?: React.ReactNode;
  extraActions?: React.ReactNode;
};

export default function ReportControlsBar({
  action,
  start,
  end,
  property,
  properties = [],
  presets = [],
  presetName = "preset",
  presetValue,
  exportCsvHref,
  exportPdfHref,
  extraControls,
  extraActions,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <form className="flex flex-wrap items-end gap-3" action={action}>
        <div className="min-w-[180px]">
          <label className="text-xs uppercase tracking-wide text-slate-500">Property</label>
          <select
            name="propertyId"
            defaultValue={property || "all"}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All properties</option>
            {properties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name || option.id}
              </option>
            ))}
          </select>
        </div>

        {presets.length > 0 && (
          <div className="min-w-[160px]">
            <label className="text-xs uppercase tracking-wide text-slate-500">Date preset</label>
            <select
              name={presetName}
              defaultValue={presetValue}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {presets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={start}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={end}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {extraControls}

        <button
          type="submit"
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Update
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">Basis</span>
            <div className="flex rounded-full border border-slate-200 bg-white">
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Cash
              </button>
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-xs text-slate-400"
                aria-disabled="true"
              >
                Accrual
              </button>
            </div>
            <span className="text-[11px] text-slate-400">Coming soon</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wide text-slate-400">Export</span>
            {exportCsvHref ? (
              <Link href={exportCsvHref} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                CSV
              </Link>
            ) : (
              <span className="text-xs text-slate-400">CSV</span>
            )}
            {exportPdfHref ? (
              <Link href={exportPdfHref} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                PDF
              </Link>
            ) : (
              <span className="text-xs text-slate-400">PDF</span>
            )}
            {extraActions}
          </div>
        </div>
      </form>
    </div>
  );
}
