import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";
const STORAGE_KEY = "hni.lang";

// One dictionary, one term per concept. Keep terminology consistent across modules.
// This template ships only the shared app-shell strings. Add feature strings under
// a short namespace per screen (see the hni-platform repo for a worked example).
const dict = {
  en: {
    app: "HNI Platform",
    nav: { commandCenter: "Command Center", projects: "Projects", clients: "Clients", programs: "Programs", resources: "Resources", analytics: "Analytics", admin: "Administration", menu: "Menu", soon: "Soon" },
    lang: { switch: "العربية", label: "Switch language" },
    close: "Close",
    units: { points: "pts" },
    home: {
      title: "New screen",
      subtitle: "This is a placeholder. Replace it with the first feature screen.",
      empty: { title: "Nothing here yet", body: "Follow the feature workflow in CLAUDE.md: brief, IA, design, then implementation." },
    },
  },
  ar: {
    app: "منصة HNI",
    nav: { commandCenter: "مركز القيادة", projects: "المشاريع", clients: "العملاء", programs: "البرامج", resources: "الموارد", analytics: "التحليلات", admin: "الإدارة", menu: "القائمة", soon: "قريباً" },
    lang: { switch: "English", label: "تغيير اللغة" },
    close: "إغلاق",
    units: { points: "نقطة" },
    home: {
      title: "شاشة جديدة",
      subtitle: "هذه شاشة مؤقتة. استبدلها بأول شاشة فعلية.",
      empty: { title: "لا يوجد محتوى بعد", body: "اتبع خطوات العمل في CLAUDE.md: الموجز، البنية، التصميم، ثم التنفيذ." },
    },
  },
} as const;

export type Dict = (typeof dict)["en"];

type Ctx = { lang: Lang; dir: "ltr" | "rtl"; t: Dict; setLang: (l: Lang) => void; locale: string };
const I18nContext = createContext<Ctx | null>(null);

function readInitial(): Lang {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return stored === "ar" ? "ar" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitial);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: dict[lang] as unknown as Dict,
      setLang: setLangState,
      // Western Arabic numerals in both languages per HNI rule; locale still drives separators.
      locale: lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function formatCurrency(value: number, locale: string) {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(value));
  const unit = locale.startsWith("ar") ? "ر.س" : "SAR";
  return `${value < 0 ? "−" : ""}${unit} ${n}`;
}
