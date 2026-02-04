import { promises as fs } from "fs";
import path from "path";
import { createTranslator } from "@/lib/i18n";
import { DATA_FILES } from "@/lib/dataFiles";

type FileMeta = {
  filename: string;
  key: string;
  size: number;
  modified: Date | null;
  exists: boolean;
};

const DATA_DIR = path.join(process.cwd(), "data");

export default async function IntegrationsPage() {
  const t = createTranslator("en");
  const files = await loadCsvFiles();
  const checkedAt = new Date();
  const locale = "en-US";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900">{t("integrations.title")}</h1>
        <p className="text-sm text-slate-500">{t("integrations.subtitle")}</p>
      </header>

      {files.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-slate-500">
          {t("integrations.empty")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {files.map((file) => (
            <article
              key={file.filename}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t(`integrations.files.${file.key}.label`) || file.filename}
                </h2>
                <p className="text-sm text-slate-500">{t(`integrations.files.${file.key}.desc`)}</p>
                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <div>
                    {t("integrations.statusLabel")}:{" "}
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        file.exists ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${file.exists ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {file.exists ? t("integrations.statusActive") : t("integrations.statusMissing")}
                    </span>
                  </div>
                  <div>
                    {t("integrations.updatedLabel")}:{" "}
                    {file.modified
                      ? file.modified.toLocaleString(locale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                  <div>
                    {t("integrations.sizeLabel")}: {formatSize(file.size)}
                  </div>
                  <div>
                    {t("integrations.filenameLabel")}: {file.filename}
                  </div>
                  <div>
                    {t("integrations.checkedLabel")}:{" "}
                    {checkedAt.toLocaleString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {file.exists ? (
                  <a
                    href={`/api/integrations/${encodeURIComponent(file.filename)}`}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:border-indigo-300"
                  >
                    {t("integrations.download")}
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-full border border-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
                    {t("integrations.download")}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

async function loadCsvFiles(): Promise<FileMeta[]> {
  const metas = await Promise.all(
    DATA_FILES.map(async ({ filename, key }) => {
      try {
        const stat = await fs.stat(path.join(DATA_DIR, filename));
        return {
          filename,
          key,
          size: stat.size,
          modified: stat.mtime,
          exists: true,
        };
      } catch {
        return {
          filename,
          key,
          size: 0,
          modified: null,
          exists: false,
        };
      }
    }),
  );
  return metas;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
