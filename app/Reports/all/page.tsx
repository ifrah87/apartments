"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "@/components/LanguageProvider";
import { REPORT_GROUPS } from "@/app/reports/reportCatalog";
import ReportList from "@/components/reports/ReportList";

export default function ReportsAllPage() {
  const { t } = useTranslations();
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const groupedReports = useMemo(() => {
    return REPORT_GROUPS.map((group) => {
      const items = group.items
        .map((item) => {
          const title = t(`reports.groups.${group.key}.items.${item.key}.name`);
          const description = t(`reports.groups.${group.key}.items.${item.key}.desc`);
          return {
            title,
            description,
            href: item.href,
            Icon: item.Icon,
          };
        })
        .filter((item) => {
          if (!normalizedQuery) return true;
          return (
            item.title.toLowerCase().includes(normalizedQuery) ||
            item.description.toLowerCase().includes(normalizedQuery)
          );
        });

      return { key: group.key, title: t(`reports.groups.${group.key}.title`), items };
    }).filter((group) => group.items.length > 0);
  }, [normalizedQuery, t]);

  return (
    <div className="w-full max-w-7xl space-y-6 px-2 sm:px-3 lg:px-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("reports.title")}</h1>
          <p className="text-sm text-slate-500">{t("reports.subtitle")}</p>
        </div>
        <Link href="/reports" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          {t("reports.backToSummary")}
        </Link>
      </header>

      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("reports.searchPlaceholder")}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300 sm:max-w-sm"
        />
      </div>

      <div className="space-y-6">
        {groupedReports.map((group) => (
          <section key={group.key} id={group.key} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">{group.title}</h2>
            <ReportList items={group.items} actionLabel={t("common.open")} />
          </section>
        ))}
      </div>
    </div>
  );
}
