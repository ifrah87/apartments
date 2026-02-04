"use client";

import { useEffect } from "react";

const RECENTS_KEY = "reports.recents";

type Props = {
  id: string;
  title: string;
  href: string;
};

export default function ReportOpenTracker({ id, title, href }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = window.localStorage.getItem(RECENTS_KEY);
      const parsed = existing ? (JSON.parse(existing) as { id: string; title: string; href: string; lastOpened: string }[]) : [];
      const next = parsed.filter((item) => item.id !== id);
      next.unshift({ id, title, href, lastOpened: new Date().toISOString() });
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next.slice(0, 10)));
    } catch {
      window.localStorage.setItem(
        RECENTS_KEY,
        JSON.stringify([{ id, title, href, lastOpened: new Date().toISOString() }]),
      );
    }
  }, [href, id, title]);

  return null;
}
