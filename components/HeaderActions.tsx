"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTranslations } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";
import { getCurrentPropertyId, resolveCurrentPropertyId, setCurrentPropertyId } from "@/lib/currentProperty";

const LANGUAGE_OPTIONS: { value: Language; labelKey: string }[] = [
  { value: "en", labelKey: "language.english" },
  { value: "so", labelKey: "language.somali" },
];

export default function HeaderActions() {
  const { t, language, setLanguage } = useTranslations();
  const [auth, setAuth] = useState<{ authenticated: boolean; name?: string | null; phone?: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [properties, setProperties] = useState<Array<{ id: string; name: string; status?: string | null }>>([]);
  const [currentProperty, setCurrentProperty] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const showLogin = auth?.authenticated === false && pathname !== "/login";
  const hidePropertySelector = pathname === "/properties";

  const loadSession = () => {
    // Optimistically assume logged in if session cookie is present
    const hasCookie = document.cookie.includes("session=");
    if (hasCookie && auth === null) setAuth({ authenticated: true });

    fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setAuth(data))
      .catch(() => {
        // Keep whatever state we have; don't flip to "logged out" on network error
      });
  };

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
    loadSession();
  }, [pathname]);

  useEffect(() => {
    const handleFocus = () => loadSession();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    fetch("/api/properties?includeArchived=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const data = (payload?.ok ? payload.data : payload) as Array<{ id: string; name: string; status?: string }>;
        if (Array.isArray(data)) {
          setProperties(data);
          const resolved = resolveCurrentPropertyId(data);
          setCurrentProperty(resolved);
        }
      })
      .catch(() => {
        setProperties([]);
        setCurrentProperty(getCurrentPropertyId());
      });
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

  const handlePropertyChange = (id: string) => {
    setCurrentPropertyId(id);
    setCurrentProperty(id);
    const params = new URLSearchParams(searchParams?.toString());
    if (id) {
      params.set("propertyId", id);
    } else {
      params.delete("propertyId");
    }
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next);
    router.refresh();
  };

  const activeProperties = properties.filter((p) => (p.status || "active") === "active");

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
      {!hidePropertySelector && activeProperties.length ? (
        <label className="flex w-full min-w-0 items-center gap-2 rounded-full border border-white/10 bg-surface/60 px-3 py-1 text-sm text-slate-200 sm:w-auto sm:max-w-full">
          <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 sm:inline">Property</span>
          <select
            value={currentProperty || ""}
            onChange={(event) => handlePropertyChange(event.target.value)}
            className="min-w-0 w-full bg-transparent text-sm font-semibold text-slate-100 outline-none sm:w-auto sm:max-w-[14rem]"
          >
            {activeProperties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full border border-white/10 bg-surface/70 text-slate-200 transition hover:border-white/20 hover:text-white sm:self-auto"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <label className="flex w-full min-w-0 items-center gap-2 rounded-full border border-white/10 bg-surface/60 px-3 py-1 text-sm text-slate-200 sm:w-auto">
        <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 sm:inline">{t("language.label")}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          className="min-w-0 w-full bg-transparent text-sm font-semibold text-slate-100 outline-none sm:w-auto"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      {showLogin ? (
        <div ref={menuRef} className="relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 rounded-full border border-white/10 bg-surface/70 px-3 py-1 text-sm font-semibold text-slate-100 hover:border-white/20 sm:w-auto sm:justify-start"
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
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-between gap-2 rounded-full border border-white/10 bg-surface/70 px-3 py-1 text-sm font-semibold text-slate-100 hover:border-white/20 sm:w-auto sm:justify-start"
        >
          Log out
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-surface/80 text-slate-200">
            <LogOut className="h-4 w-4" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
