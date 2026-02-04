"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTranslations } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";

const LANGUAGE_OPTIONS: { value: Language; labelKey: string }[] = [
  { value: "en", labelKey: "language.english" },
  { value: "so", labelKey: "language.somali" },
];

export default function HeaderActions() {
  const { t, language, setLanguage } = useTranslations();
  const [auth, setAuth] = useState<{ authenticated: boolean; phone?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const showLogin = auth?.authenticated === false && pathname !== "/login";

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const nextTheme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setAuth(data))
      .catch(() => setAuth({ authenticated: false }));
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("theme", next);
  };

  return (
    <div className="flex flex-1 items-center justify-end gap-4">
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface/70 text-slate-200 transition hover:border-white/20 hover:text-white"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <label className="flex items-center gap-2 rounded-full border border-white/10 bg-surface/60 px-3 py-1 text-sm text-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("language.label")}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          className="bg-transparent text-sm font-semibold text-slate-100 outline-none"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      {showLogin ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-surface/70 px-3 py-1 text-sm font-semibold text-slate-100 hover:border-white/20"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            Log in
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-surface/80 text-slate-200">
              <LogOut className="h-4 w-4" />
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-40 rounded-lg border border-white/10 bg-surface/95 py-1 text-sm shadow-lg"
            >
              <Link
                href="/login"
                className="flex items-center justify-between gap-2 px-3 py-2 text-left text-slate-100 hover:bg-white/5"
                role="menuitem"
              >
                Log in
                <LogOut className="h-4 w-4 text-slate-400" />
              </Link>
            </div>
          ) : null}
        </div>
      ) : auth?.authenticated ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-surface/60 px-3 py-1 text-sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="font-semibold text-slate-100">
              {auth.phone ? auth.phone.slice(-2).toUpperCase() : "IA"}
            </span>
            <span className="text-slate-400">{auth.phone || "User"}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-surface/80 text-slate-200">
              <LogOut className="h-4 w-4" />
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-40 rounded-lg border border-white/10 bg-surface/95 py-1 text-sm shadow-lg"
            >
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-slate-100 hover:bg-white/5"
                role="menuitem"
              >
                Log out
                <LogOut className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
