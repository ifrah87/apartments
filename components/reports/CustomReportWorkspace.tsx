'use client';

import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Filter,
  Layers,
  ListChecks,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { CustomBlueprint, CustomDatasetId, FilterCondition, FilterOperator } from "@/lib/constants/customReports";
import type { HydratedDataset } from "@/lib/reports/customReports";

type CustomReportWorkspaceProps = {
  datasets: HydratedDataset[];
  blueprints: CustomBlueprint[];
};

type UserFilter = FilterCondition & { id: string };

const PREVIEW_LIMIT = 150;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export default function CustomReportWorkspace({ datasets, blueprints }: CustomReportWorkspaceProps) {
  const datasetMap = useMemo(() => {
    const map = new Map<CustomDatasetId, HydratedDataset>();
    datasets.forEach((dataset) => map.set(dataset.id, dataset));
    return map;
  }, [datasets]);

  const initialId = datasets[0]?.id;
  const [datasetId, setDatasetId] = useState<CustomDatasetId | undefined>(initialId);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(datasets[0]?.defaultVisible ?? []);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilterIds, setQuickFilterIds] = useState<string[]>([]);
  const [userFilters, setUserFilters] = useState<UserFilter[]>([]);
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);

  const activeDataset = datasetId ? datasetMap.get(datasetId) : undefined;

  const defaultColumns = activeDataset?.defaultVisible ?? [];

  const handleDatasetChange = (id: CustomDatasetId) => {
    setDatasetId(id);
    setVisibleColumns(datasetMap.get(id)?.defaultVisible ?? []);
    setQuickFilterIds([]);
    setUserFilters([]);
    setSearchTerm("");
    setSort(null);
  };

  const toggleQuickFilter = (id: string) => {
    setQuickFilterIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        return prev.filter((col) => col !== key);
      }
      const orderedKeys = activeDataset?.columns.map((column) => column.key) ?? [];
      const next = new Set(prev);
      next.add(key);
      return orderedKeys.filter((columnKey) => next.has(columnKey));
    });
  };

  const addFilterRow = () => {
    if (!activeDataset?.columns.length) return;
    const firstColumn = activeDataset.columns[0];
    setUserFilters((prev) => [
      ...prev,
      {
        id: generateId(),
        column: firstColumn.key,
        operator: firstColumn.valueType === "number" || firstColumn.valueType === "currency" || firstColumn.valueType === "percent" ? "gte" : "contains",
        value: "",
      },
    ]);
  };

  const updateFilterRow = (id: string, changes: Partial<UserFilter>) => {
    setUserFilters((prev) => prev.map((filter) => (filter.id === id ? { ...filter, ...changes } : filter)));
  };

  const removeFilterRow = (id: string) => {
    setUserFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const resetView = () => {
    if (!activeDataset) return;
    setVisibleColumns(activeDataset.defaultVisible);
    setQuickFilterIds([]);
    setUserFilters([]);
    setSearchTerm("");
    setSort(null);
  };

  const applyBlueprint = (blueprint: CustomBlueprint) => {
    setDatasetId(blueprint.datasetId);
    const dataset = datasetMap.get(blueprint.datasetId);
    if (dataset) {
      setVisibleColumns(blueprint.columns?.length ? blueprint.columns : dataset.defaultVisible);
      setQuickFilterIds(blueprint.quickFilterIds ?? []);
      setSort(blueprint.sort ?? null);
      if (blueprint.searchTerm) {
        setSearchTerm(blueprint.searchTerm);
      } else {
        setSearchTerm("");
      }
      setUserFilters([]);
    }
  };

  const buildConditions = (): FilterCondition[] => {
    if (!activeDataset) return [];
    const quickConditions = (activeDataset.quickFilters ?? [])
      .filter((filter) => quickFilterIds.includes(filter.id))
      .flatMap((filter) => filter.conditions);

    const manualConditions = userFilters
      .map((filter) => {
        const columnMeta = activeDataset.columns.find((col) => col.key === filter.column);
        if (!columnMeta) return null;
        if (filter.operator === "isEmpty" || filter.operator === "isNotEmpty") {
          return { column: filter.column, operator: filter.operator } as FilterCondition;
        }
        if (filter.value === undefined || filter.value === "") return null;
        const needsNumber = ["number", "currency", "percent"].includes(columnMeta.valueType ?? "string");
        const value = needsNumber ? Number(filter.value) : filter.value;
        if (needsNumber && Number.isNaN(value)) {
          return null;
        }
        return { column: filter.column, operator: filter.operator, value };
      })
      .filter(Boolean) as FilterCondition[];

    return [...quickConditions, ...manualConditions];
  };

  const conditions = buildConditions();

  const filteredRows = useMemo(() => {
    if (!activeDataset) return [];
    const search = searchTerm.trim().toLowerCase();
    const columnMap = new Map(activeDataset.columns.map((column) => [column.key, column]));
    return activeDataset.rows.filter((row) => {
      if (search) {
        const hit = activeDataset.searchKeys.some((key) => {
          const value = row[key];
          if (value === undefined || value === null) return false;
          return String(value).toLowerCase().includes(search);
        });
        if (!hit) return false;
      }
      return conditions.every((condition) => evaluateCondition(row[condition.column], condition, columnMap.get(condition.column)));
    });
  }, [activeDataset, conditions, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!activeDataset) return [];
    if (!sort) return filteredRows;
    const columnMeta = activeDataset.columns.find((column) => column.key === sort.column);
    const rowsCopy = [...filteredRows];
    rowsCopy.sort((a, b) => compareValues(a[sort.column], b[sort.column], columnMeta?.valueType, sort.direction));
    return rowsCopy;
  }, [activeDataset, filteredRows, sort]);

  const previewRows = useMemo(() => sortedRows.slice(0, PREVIEW_LIMIT), [sortedRows]);

  const visibleColumnDefs = useMemo(() => {
    if (!activeDataset) return [];
    return activeDataset.columns.filter((column) => visibleColumns.includes(column.key));
  }, [activeDataset, visibleColumns]);

  const metricCards = useMemo(() => {
    if (!activeDataset?.metrics) return [];
    return activeDataset.metrics.map((metric) => {
      const scopedRows = metric.filter
        ? sortedRows.filter((row) => {
            const columnMap = new Map(activeDataset.columns.map((column) => [column.key, column]));
            return metric.filter!.every((condition) => evaluateCondition(row[condition.column], condition, columnMap.get(condition.column)));
          })
        : sortedRows;
      let value = 0;
      switch (metric.aggregate) {
        case "count":
          value = scopedRows.length;
          break;
        case "sum":
          value = scopedRows.reduce((acc, row) => acc + toNumber(row[metric.column ?? ""]), 0);
          break;
        case "avg":
          value = scopedRows.length ? scopedRows.reduce((acc, row) => acc + toNumber(row[metric.column ?? ""]), 0) / scopedRows.length : 0;
          break;
        case "max":
          value = scopedRows.reduce((acc, row) => Math.max(acc, toNumber(row[metric.column ?? ""])), Number.NEGATIVE_INFINITY);
          if (!scopedRows.length) value = 0;
          break;
        case "min":
          value = scopedRows.reduce((acc, row) => Math.min(acc, toNumber(row[metric.column ?? ""])), Number.POSITIVE_INFINITY);
          if (!scopedRows.length) value = 0;
          break;
        default:
          value = 0;
      }
      return {
        id: metric.id,
        label: metric.label,
        displayValue: formatMetricValue(value, metric.format, metric.decimals),
      };
    });
  }, [activeDataset, sortedRows]);

  const downloadCsv = useCallback(() => {
    if (!activeDataset || !visibleColumnDefs.length) return;
    const headers = visibleColumnDefs.map((column) => column.label);
    const rows = sortedRows.map((row) =>
      visibleColumnDefs.map((column) => {
        const value = formatCellValue(row[column.key], column.valueType);
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
      }),
    );
    const lines = [headers.join(","), ...rows.map((cells) => cells.join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDataset.id}-custom-report.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, [activeDataset, sortedRows, visibleColumnDefs]);

  if (!activeDataset) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
        No datasets available. Ensure the API endpoints are reachable.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Dataset</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={datasetId}
                  onChange={(event) => handleDatasetChange(event.target.value as CustomDatasetId)}
                  className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
                >
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.label}
                    </option>
                  ))}
                </select>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{activeDataset.rows.length} rows</span>
                {activeDataset.error && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">{activeDataset.error}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetView}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
              >
                <Sparkles className="h-4 w-4" />
                Reset view
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
              <div className="flex items-center rounded-xl border border-slate-200 px-3 py-2">
                <Search className="mr-2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none"
                  placeholder={`Search ${activeDataset.searchKeys.length} fields`}
                />
              </div>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sort
              <div className="flex gap-2">
                <select
                  value={sort?.column ?? ""}
                  onChange={(event) => {
                    const column = event.target.value;
                    if (!column) {
                      setSort(null);
                      return;
                    }
                    setSort((prev) => ({ column, direction: prev?.direction ?? "desc" }));
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">No sort</option>
                  {activeDataset.columns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
                {sort && (
                  <select
                    value={sort.direction}
                    onChange={(event) => setSort((prev) => (prev ? { ...prev, direction: event.target.value as "asc" | "desc" } : prev))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                )}
              </div>
            </label>
          </div>

          {!!(activeDataset.quickFilters?.length ?? 0) && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick filters</p>
              <div className="flex flex-wrap gap-2">
                {activeDataset.quickFilters!.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => toggleQuickFilter(filter.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                      quickFilterIds.includes(filter.id)
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                    title={filter.description}
                  >
                    {quickFilterIds.includes(filter.id) ? <Check className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
              <button
                type="button"
                onClick={addFilterRow}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Add filter
              </button>
            </div>
            {!userFilters.length && <p className="text-sm text-slate-500">No advanced filters applied.</p>}
            <div className="space-y-3">
              {userFilters.map((filter) => {
                const columnMeta = activeDataset.columns.find((column) => column.key === filter.column) ?? activeDataset.columns[0];
                const operatorOptions = buildOperatorOptions(columnMeta?.valueType);
                const showValueInput = !["isEmpty", "isNotEmpty"].includes(filter.operator);
                const inputType = determineInputType(columnMeta?.valueType);
                return (
                  <div key={filter.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <select
                      value={filter.column}
                      onChange={(event) => updateFilterRow(filter.id, { column: event.target.value })}
                      className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
                    >
                      {activeDataset.columns.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(event) => updateFilterRow(filter.id, { operator: event.target.value as FilterOperator })}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
                    >
                      {operatorOptions.map((operator) => (
                        <option key={operator} value={operator}>
                          {operatorLabel(operator)}
                        </option>
                      ))}
                    </select>
                    {showValueInput && (
                      <input
                        type={inputType}
                        value={filter.value ?? ""}
                        onChange={(event) => updateFilterRow(filter.id, { value: event.target.value })}
                        className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    )}
                    <button type="button" onClick={() => removeFilterRow(filter.id)} className="text-slate-400 hover:text-rose-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ListChecks className="h-4 w-4" />
              Columns
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {activeDataset.columns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">Default columns: {defaultColumns.join(", ")}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
              <p className="text-sm text-slate-600">
                Showing {previewRows.length} of {sortedRows.length} rows (filtered from {activeDataset.rows.length})
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 uppercase tracking-wide">
              {visibleColumnDefs.length} columns
            </span>
          </div>
          {!!metricCards.length && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {metricCards.map((metric) => (
                <div key={metric.id} className="rounded-2xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{metric.displayValue}</p>
                </div>
              ))}
            </div>
          )}
          {!visibleColumnDefs.length ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No columns selected. Toggle columns above to see data.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {visibleColumnDefs.map((column) => (
                      <th key={column.key} className="px-3 py-2">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      {visibleColumnDefs.map((column) => (
                        <td key={column.key} className="px-3 py-2 text-slate-900">
                          {formatCellValue(row[column.key], column.valueType)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!previewRows.length && (
                    <tr>
                      <td colSpan={visibleColumnDefs.length} className="px-3 py-6 text-center text-slate-500">
                        No rows match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Dataset guide</p>
              <p className="text-sm font-semibold text-slate-900">{activeDataset.label}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">{activeDataset.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeDataset.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {tag}
              </span>
            ))}
          </div>
          {!!(activeDataset.sampleInsights?.length ?? 0) && (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {activeDataset.sampleInsights!.map((insight) => (
                <li key={insight} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 text-slate-400" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Saved blueprints</p>
              <p className="text-sm font-semibold text-slate-900">Jump-start a view</p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {blueprints.map((blueprint) => (
              <button
                key={blueprint.id}
                type="button"
                onClick={() => applyBlueprint(blueprint)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-indigo-200"
              >
                <p className="text-sm font-semibold text-slate-900">{blueprint.name}</p>
                <p className="text-xs text-slate-500">{blueprint.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Uses <span className="font-mono text-slate-700">{datasetMap.get(blueprint.datasetId)?.label ?? blueprint.datasetId}</span>
                </p>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function evaluateCondition(value: unknown, condition: FilterCondition, column?: { valueType?: string }) {
  switch (condition.operator) {
    case "equals":
      return normalizeValue(value, column?.valueType) === normalizeValue(condition.value, column?.valueType);
    case "notEquals":
      return normalizeValue(value, column?.valueType) !== normalizeValue(condition.value, column?.valueType);
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    case "notContains":
      return !String(value ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    case "startsWith":
      return String(value ?? "").toLowerCase().startsWith(String(condition.value ?? "").toLowerCase());
    case "endsWith":
      return String(value ?? "").toLowerCase().endsWith(String(condition.value ?? "").toLowerCase());
    case "gte":
      return toNumber(value) >= toNumber(condition.value);
    case "lte":
      return toNumber(value) <= toNumber(condition.value);
    case "gt":
      return toNumber(value) > toNumber(condition.value);
    case "lt":
      return toNumber(value) < toNumber(condition.value);
    case "isEmpty":
      return value === undefined || value === null || value === "";
    case "isNotEmpty":
      return !(value === undefined || value === null || value === "");
    default:
      return true;
  }
}

function compareValues(a: unknown, b: unknown, valueType: string | undefined, direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  if (["number", "currency", "percent"].includes(valueType ?? "")) {
    return (toNumber(a) - toNumber(b)) * multiplier;
  }
  const stringA = String(a ?? "").toLowerCase();
  const stringB = String(b ?? "").toLowerCase();
  if (stringA < stringB) return -1 * multiplier;
  if (stringA > stringB) return 1 * multiplier;
  return 0;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCellValue(value: unknown, valueType?: string) {
  if (value === null || value === undefined || value === "") return "—";
  switch (valueType) {
    case "currency":
      return currency.format(toNumber(value));
    case "number":
      return numberFormat.format(toNumber(value));
    case "percent":
      return `${percentFormat.format(toNumber(value))}%`;
    case "date":
      return new Date(value as string).toLocaleDateString();
    default:
      return String(value);
  }
}

function formatMetricValue(value: number, format: string | undefined, decimals = 0) {
  switch (format) {
    case "currency":
      return currency.format(value);
    case "percent":
      return `${value.toFixed(decimals || 1)}%`;
    default:
      return numberFormat.format(value);
  }
}

function buildOperatorOptions(valueType?: string): FilterOperator[] {
  if (valueType === "number" || valueType === "currency" || valueType === "percent") {
    return ["gte", "lte", "gt", "lt", "equals", "isEmpty", "isNotEmpty"];
  }
  if (valueType === "date") {
    return ["gte", "lte", "equals", "isEmpty", "isNotEmpty"];
  }
  return ["contains", "equals", "notEquals", "startsWith", "endsWith", "isEmpty", "isNotEmpty"];
}

function determineInputType(valueType?: string) {
  if (valueType === "number" || valueType === "currency" || valueType === "percent") return "number";
  if (valueType === "date") return "date";
  return "text";
}

function normalizeValue(value: unknown, valueType?: string) {
  if (["number", "currency", "percent"].includes(valueType ?? "")) {
    return toNumber(value);
  }
  return String(value ?? "").toLowerCase();
}

function operatorLabel(operator: FilterOperator) {
  switch (operator) {
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "isEmpty":
      return "Is empty";
    case "isNotEmpty":
      return "Is not empty";
    case "notEquals":
      return "≠";
    default:
      return operator.charAt(0).toUpperCase() + operator.slice(1);
  }
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
}
