"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTranslator, type Language } from "@/lib/i18n";

type Translator = ReturnType<typeof createTranslator>;

type LanguageContextValue = {
  language: Language;
  t: Translator;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const DEFAULT_LANGUAGE: Language = "en";

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const translator = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    const stored = window.localStorage.getItem("language");
    if (stored === "en" || stored === "so") {
      setLanguage(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("language", language);
  }, [language]);

  const value = { language, t: translator, setLanguage };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslations() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslations must be used within a LanguageProvider");
  }
  return { t: context.t, language: context.language, setLanguage: context.setLanguage };
}
