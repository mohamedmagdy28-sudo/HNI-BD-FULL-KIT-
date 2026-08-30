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
    pricing: {
      title: "Pricing & Costing",
      subtitle: "Build the financial section of a client proposal",
      newProposal: "New proposal",
      untitled: "Untitled proposal",
      copySuffix: "(copy)",
      firstInstallment: "On signature",
      empty: {
        title: "No proposals yet",
        body: "Create your first proposal, add programs and cost lines, and the price chain computes live.",
      },
      switcher: "Open proposal",
      documents: "Documents",
      docsSentOn: "Sent",
      docsOpenDocument: "Open document",
      docsViewCosting: "View costing",
      docsEmptyTitle: "No sent proposals yet",
      docsEmptyBody: "Mark a proposal as sent and it is filed here as a permanent document you can reopen and re-print anytime.",
      duplicate: "Duplicate",
      markSent: "Mark as sent",
      sent: "Sent",
      draft: "Draft",
      sentLocked: "This proposal is marked as sent and locked. Duplicate it to work on a revision.",
      clientView: "Client view",
      back: "Back to costing",
      print: "Print / Save PDF",
      deleteProposal: "Delete proposal",
      client: "Client",
      proposalTitle: "Proposal title",
      date: "Date",
      projectType: "Project type",
      projectTypes: { workshop: "Stand Alone Workshop", custom: "Custom" },
      sectionLabel: "Label sections as",
      phase: "Phase",
      description: "Description",
      workshopLines: ["Trainer daily rate", "Materials printing", "Air ticket", "Accommodation"],
      program: "Program",
      addProgram: "Add program",
      addLine: "Add cost line",
      removeLine: "Remove line",
      removeProgram: "Remove program",
      lineLabel: "Cost item",
      qty: "Qty",
      unitRate: "Unit rate",
      subtotal: "Subtotal",
      days: "Days",
      participants: "Participants",
      city: "City",
      totalCost: "Total cost",
      markup: "Markup %",
      targetMargin: "Target margin %",
      pricePerDay: "Price / day",
      listPrice: "List price",
      discount: "Discount",
      discountPercent: "%",
      discountAmount: "SAR",
      netPrice: "Net price",
      margin: "Margin",
      belowFloor: "Below the {floor}% margin floor",
      negativeMargin: "Negative margin: this price loses money",
      vat: "VAT",
      totalIncVat: "Total incl. VAT",
      perParticipant: "Per participant",
      schedule: "Payment schedule",
      scheduleLabel: "Milestone",
      schedulePercent: "%",
      addInstallment: "Add installment",
      scheduleError: "Installment percents must be whole numbers and sum to exactly 100.",
      pricingDisabledHint: "Add a cost line with a value to unlock pricing.",
      export: "Export backup",
      import: "Import",
      exportReminder: "No backup for over a week. Export a JSON backup to protect your proposals.",
      storageError: "Saving failed (storage full or blocked). Export a backup now to avoid losing work.",
      corruptData: "Some saved data could not be read. You can restore from a JSON backup.",
      importError: "That file could not be imported. Nothing was changed.",
      docTitle: "Financial Proposal",
      docFor: "Prepared for",
      docDate: "Date",
      docProgram: "Program",
      docDays: "Days",
      docParticipants: "Participants",
      docInvestment: "Investment",
      docSubtotal: "Subtotal",
      docDiscount: "Discount",
      docNet: "Net investment",
      docVat: "VAT",
      docTotal: "Total including VAT",
      docScheduleTitle: "Payment schedule",
      docFooter: "Human Network International",
      docProposedIn: "Proposed in",
      docBreakdown: "Financial Breakdown",
      docTerms1: "Terms and Conditions (1/2)",
      docTerms2: "Terms and Conditions (2/2)",
      docBank: "HNI Bank Details",
      docSignedHni: "Signed on Behalf of HNI by:",
      docSignedClientPre: "Signed on behalf of",
      docSignedClientPost: "by:",
      docThankYou: "THANK YOU",
      docGetInTouch: "Get in Touch with us",
      docCountries: "UAE, KSA, Qatar, Egypt",
      docLegalEnNote: "",
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
    pricing: {
      title: "التسعير والتكاليف",
      subtitle: "إعداد القسم المالي لعرض العميل",
      newProposal: "عرض جديد",
      untitled: "عرض بدون عنوان",
      copySuffix: "(نسخة)",
      firstInstallment: "عند التوقيع",
      empty: {
        title: "لا توجد عروض بعد",
        body: "أنشئ أول عرض، وأضف البرامج وبنود التكلفة، وستُحسب سلسلة التسعير مباشرة.",
      },
      switcher: "فتح عرض",
      documents: "المستندات",
      docsSentOn: "تاريخ الإرسال",
      docsOpenDocument: "فتح المستند",
      docsViewCosting: "عرض التكاليف",
      docsEmptyTitle: "لا توجد عروض مُرسلة بعد",
      docsEmptyBody: "حدد عرضاً كمُرسل ليُحفظ هنا كمستند دائم يمكنك فتحه وطباعته في أي وقت.",
      duplicate: "إنشاء نسخة",
      markSent: "تحديد كمُرسل",
      sent: "مُرسل",
      draft: "مسودة",
      sentLocked: "هذا العرض محدد كمُرسل ومقفل. أنشئ نسخة للعمل على مراجعة جديدة.",
      clientView: "نسخة العميل",
      back: "العودة إلى التكاليف",
      print: "طباعة / حفظ PDF",
      deleteProposal: "حذف العرض",
      client: "العميل",
      proposalTitle: "عنوان العرض",
      date: "التاريخ",
      projectType: "نوع المشروع",
      projectTypes: { workshop: "ورشة عمل مستقلة", custom: "مخصص" },
      sectionLabel: "تسمية الأقسام",
      phase: "المرحلة",
      description: "الوصف",
      workshopLines: ["أجر المدرب اليومي", "طباعة المواد", "تذكرة الطيران", "الإقامة"],
      program: "البرنامج",
      addProgram: "إضافة برنامج",
      addLine: "إضافة بند تكلفة",
      removeLine: "حذف البند",
      removeProgram: "حذف البرنامج",
      lineLabel: "بند التكلفة",
      qty: "الكمية",
      unitRate: "سعر الوحدة",
      subtotal: "المجموع الفرعي",
      days: "الأيام",
      participants: "المشاركون",
      city: "المدينة",
      totalCost: "إجمالي التكلفة",
      markup: "نسبة الزيادة %",
      targetMargin: "هامش الربح المستهدف %",
      pricePerDay: "سعر اليوم",
      listPrice: "السعر قبل الخصم",
      discount: "الخصم",
      discountPercent: "%",
      discountAmount: "ر.س",
      netPrice: "السعر الصافي",
      margin: "هامش الربح",
      belowFloor: "أقل من الحد الأدنى للهامش {floor}%",
      negativeMargin: "هامش سالب: هذا السعر يحقق خسارة",
      vat: "ضريبة القيمة المضافة",
      totalIncVat: "الإجمالي شامل الضريبة",
      perParticipant: "للمشارك الواحد",
      schedule: "جدول الدفعات",
      scheduleLabel: "الدفعة",
      schedulePercent: "%",
      addInstallment: "إضافة دفعة",
      scheduleError: "يجب أن تكون نسب الدفعات أعداداً صحيحة ومجموعها 100 بالضبط.",
      pricingDisabledHint: "أضف بند تكلفة بقيمة لتفعيل التسعير.",
      export: "تصدير نسخة احتياطية",
      import: "استيراد",
      exportReminder: "لم يتم تصدير نسخة احتياطية منذ أكثر من أسبوع. صدّر نسخة JSON لحماية عروضك.",
      storageError: "فشل الحفظ (مساحة التخزين ممتلئة أو محظورة). صدّر نسخة احتياطية الآن لتجنب فقدان العمل.",
      corruptData: "تعذرت قراءة بعض البيانات المحفوظة. يمكنك الاستعادة من نسخة احتياطية JSON.",
      importError: "تعذر استيراد هذا الملف. لم يتغير أي شيء.",
      docTitle: "عرض مالي",
      docFor: "مُعد لصالح",
      docDate: "التاريخ",
      docProgram: "البرنامج",
      docDays: "الأيام",
      docParticipants: "المشاركون",
      docInvestment: "قيمة الاستثمار",
      docSubtotal: "المجموع",
      docDiscount: "الخصم",
      docNet: "صافي الاستثمار",
      docVat: "ضريبة القيمة المضافة",
      docTotal: "الإجمالي شامل الضريبة",
      docScheduleTitle: "جدول الدفعات",
      docFooter: "Human Network International",
      docProposedIn: "مُقدم في",
      docBreakdown: "التفصيل المالي",
      docTerms1: "الشروط والأحكام (1/2)",
      docTerms2: "الشروط والأحكام (2/2)",
      docBank: "البيانات البنكية لـ HNI",
      docSignedHni: "التوقيع نيابة عن HNI:",
      docSignedClientPre: "التوقيع نيابة عن",
      docSignedClientPost: ":",
      docThankYou: "شكراً لكم",
      docGetInTouch: "تواصلوا معنا",
      docCountries: "الإمارات، السعودية، قطر، مصر",
      docLegalEnNote: "الشروط والأحكام واردة باللغة الإنجليزية وهي النسخة المعتمدة.",
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
