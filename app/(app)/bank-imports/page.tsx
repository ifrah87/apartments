"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type UploadResult  = { ok: true; key: string; size: number; batchId?: string } | { ok: false; error: string };
type ProcessSuccess = {
  ok: true;
  batchId?: string;
  status?: string;
  row_count?: number;
  processed_count?: number;
  error_count?: number;
  inserted: number;
  skipped_duplicates: number;
  skipped_parse: number;
};
type ProcessFailure = { ok: false; error: string; batchId?: string };
type ProcessResult = ProcessSuccess | ProcessFailure;

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;

export default function BankImportsPage() {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [period,     setPeriod]     = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [propertyId, setPropertyId] = useState("default");

  const [uploading,   setUploading]   = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [uploadResult,  setUploadResult]  = useState<UploadResult | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryBatchId, setRetryBatchId] = useState<string | null>(null);

  // ── Upload ──────────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a CSV file first."); return; }

    setError(null);
    setUploadResult(null);
    setProcessResult(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const params = new URLSearchParams({ propertyId, period });
      const res    = await fetch(`/api/bank-imports/upload?${params}`, { method: "POST", body: fd });
      const data: UploadResult = await res.json();
      setUploadResult(data);
      if (!data.ok) setError(data.error);
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  // ── Process ──────────────────────────────────────────────────────────────
  async function handleProcess() {
    if (!uploadResult?.ok) return;

    setError(null);
    setProcessResult(null);
    setProcessing(true);

    try {
      const res  = await fetch("/api/bank-imports/process", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: uploadResult.key, batchId: uploadResult.batchId }),
      });
      const data: ProcessResult = await res.json();
      setProcessResult(data);
      if (!data.ok) {
        setError(data.error);
        setRetryBatchId(data.batchId ?? uploadResult.batchId ?? null);
      } else {
        setRetryBatchId(null);
      }
    } catch {
      setError("Network error during processing.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleRetry() {
    if (!retryBatchId) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/bank-imports/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: retryBatchId, retry: true }),
      });
      const data: ProcessResult = await res.json();
      setProcessResult(data);
      if (!data.ok) {
        setError(data.error);
      } else {
        setRetryBatchId(null);
      }
    } catch {
      setError("Network error during retry.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">Reports</Link> / Bank Imports
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Import Bank Statement</h1>
        <p className="text-sm text-slate-500">
          Upload a CSV → stored in DigitalOcean Spaces → parsed and inserted into the bank transactions table.
        </p>
      </header>

      {/* Upload form */}
      <form onSubmit={handleUpload} className="max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Step 1 — Upload CSV</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Period</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Property ID</label>
            <input
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="default"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">CSV file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload to Spaces"}
        </button>
      </form>

      {/* Upload result */}
      {uploadResult?.ok && (
        <div className="max-w-lg space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-800">Uploaded successfully</p>
          <p className="break-all font-mono text-xs text-emerald-700">{uploadResult.key}</p>
          <p className="text-xs text-emerald-600">{fmtBytes(uploadResult.size)}</p>
          {uploadResult.batchId && <p className="text-xs text-slate-500">Batch: {uploadResult.batchId}</p>}

          {/* Step 2 */}
          <div className="border-t border-emerald-200 pt-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Step 2 — Process &amp; insert into database</p>
            <button
              onClick={handleProcess}
              disabled={processing}
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {processing ? "Processing…" : "Parse + Insert rows"}
            </button>
          </div>
        </div>
      )}

      {/* Process result */}
      {processResult?.ok && (
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">Import complete</p>
          <div className="mb-3 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <Stat value={processResult.row_count ?? 0} label="Rows in file" color="text-slate-700" />
            <Stat value={processResult.processed_count ?? 0} label="Rows processed" color="text-indigo-700" />
            <Stat value={processResult.error_count ?? 0} label="Error rows" color="text-rose-600" />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat value={processResult.inserted}           label="Inserted"          color="text-emerald-700" />
            <Stat value={processResult.skipped_duplicates} label="Duplicates skipped" color="text-amber-600" />
            <Stat value={processResult.skipped_parse}      label="Parse errors"       color="text-rose-600" />
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Review and code transactions in{" "}
            <Link href="/reports/bank-imports" className="text-indigo-600 hover:underline">
              Bank Imports
            </Link>
            .
          </p>
        </div>
      )}

      {error && (
        <div className="max-w-lg rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          {retryBatchId && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={processing}
                className="rounded-full border border-rose-300 bg-white px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                {processing ? "Retrying…" : "Retry failed batch"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
