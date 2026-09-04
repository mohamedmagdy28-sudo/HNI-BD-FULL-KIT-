// Static content of the official HNI Financial Proposal template
// ("Blank Financial Proposal - English.pptx", 6 slides, 13.33in x 7.5in).
// The English legal terms are reproduced verbatim. The Arabic versions below
// are a working translation added on user direction (2026-09-04); the Arabic
// document carries a note that the English text prevails on any discrepancy.
// Swap in counsel-approved Arabic wording here when it exists.
//
// The template's embedded signature and company-stamp images are deliberately
// NOT included: this app ships in a public repository and a public URL, and a
// reusable signature/stamp image would be a forgery kit. Signature blocks
// render blank for signing after printing.

export type TermsSection = { heading: string; items: string[] };

export const TERMS_PAGE_1: TermsSection[] = [
  {
    heading: "Project Assumptions, Inclusions & Exclusions:",
    items: [
      "Training material and delivery will be conducted in English.",
      "A full training day consists of 6 hours of training plus 1.5 hours of breaks.",
      "Training delivery dates will be agreed upon after project award.",
      "A minimum of 4 weeks' notice is required from contract signing to commence training delivery.",
      "Subject Matter Experts (SMEs) are subject to availability on agreed dates.",
      "Programme facilitation by a specialist trainer from HNI for up to 20 participants per class. HNI recommends maximum 15-20 participants per training session to retain the highest level of quality.",
      "Participants must attend at least 90% of the program to receive a certificate of completion.",
      "In case of force majeure situations (e.g., pandemic-related restrictions), delivery may shift online without cancellation or delay.",
      "The client will arrange and cover venue and catering costs for in-person sessions.",
    ],
  },
  {
    heading: "Intellectual Property",
    items: [
      "All intellectual property rights in deliverables and training materials remain with the service provider.",
      "Materials may not be reused to conduct independent training or shared with third parties without prior written consent.",
    ],
  },
];

export const TERMS_PAGE_2: TermsSection[] = [
  {
    heading: "Client Responsibilities",
    items: [
      "Assign a dedicated Project Manager as the single point of contact.",
      "Support resolution of project-related issues in a timely manner.",
      "Be responsible for participant selection.",
    ],
  },
  {
    heading: "Force Majeure",
    items: [
      "Neither party shall be liable for delays or failure to perform obligations due to circumstances beyond reasonable control (including natural disasters, pandemics, government restrictions, etc.).",
      "Both parties agree to collaborate on alternative delivery arrangements where necessary.",
    ],
  },
  {
    heading: "Cancellation Terms",
    items: [
      "Cancellation or rescheduling less than 10 business days before training: 25% of total fees + 100% of non-refundable expenses.",
      "Cancellation or rescheduling less than 5 business days before training: 50% of total fees + 100% of non-refundable expenses.",
    ],
  },
  {
    heading: "Payment Terms",
    items: [
      "Invoicing will be issued periodically based on delivery progress.",
      "Standard payment terms: 30 days from invoice date.",
      "Fees may reflect complexity, urgency, risk, expertise level, and resources required.",
    ],
  },
];

export const TERMS_PAGE_1_AR: TermsSection[] = [
  {
    heading: "افتراضات المشروع وما يشمله وما يستثنيه:",
    items: [
      "تُقدَّم المادة التدريبية ويُنفَّذ التدريب باللغة الإنجليزية.",
      "يتكوّن اليوم التدريبي الكامل من 6 ساعات تدريب بالإضافة إلى ساعة ونصف من الاستراحات.",
      "يُتفق على مواعيد تنفيذ التدريب بعد ترسية المشروع.",
      "يلزم إشعار مسبق لا يقل عن 4 أسابيع من تاريخ توقيع العقد لبدء تنفيذ التدريب.",
      "يخضع حضور الخبراء المتخصصين (SMEs) لتوفرهم في المواعيد المتفق عليها.",
      "يتولى تيسير البرنامج مدرب متخصص من HNI لما يصل إلى 20 مشاركاً في القاعة الواحدة، وتوصي HNI بحد أقصى 15-20 مشاركاً في الجلسة التدريبية للحفاظ على أعلى مستوى من الجودة.",
      "يجب أن يحضر المشارك ما لا يقل عن 90% من البرنامج للحصول على شهادة الإتمام.",
      "في حالات القوة القاهرة (مثل القيود المرتبطة بالأوبئة)، يجوز تحويل التنفيذ إلى التدريب عن بُعد دون إلغاء أو تأجيل.",
      "يتولى العميل ترتيب وتغطية تكاليف القاعة والضيافة للجلسات الحضورية.",
    ],
  },
  {
    heading: "الملكية الفكرية",
    items: [
      "تظل جميع حقوق الملكية الفكرية في المخرجات والمواد التدريبية ملكاً لمقدم الخدمة.",
      "لا يجوز إعادة استخدام المواد لتنفيذ تدريب مستقل أو مشاركتها مع أطراف أخرى دون موافقة خطية مسبقة.",
    ],
  },
];

export const TERMS_PAGE_2_AR: TermsSection[] = [
  {
    heading: "مسؤوليات العميل",
    items: [
      "تعيين مدير مشروع مخصص كنقطة تواصل وحيدة.",
      "دعم حل المسائل المتعلقة بالمشروع في الوقت المناسب.",
      "تحمّل مسؤولية اختيار المشاركين.",
    ],
  },
  {
    heading: "القوة القاهرة",
    items: [
      "لا يتحمل أي من الطرفين المسؤولية عن التأخير أو الإخفاق في تنفيذ الالتزامات نتيجة ظروف خارجة عن السيطرة المعقولة (بما في ذلك الكوارث الطبيعية والأوبئة والقيود الحكومية وغيرها).",
      "يتفق الطرفان على التعاون لإيجاد ترتيبات تنفيذ بديلة عند الحاجة.",
    ],
  },
  {
    heading: "شروط الإلغاء",
    items: [
      "الإلغاء أو إعادة الجدولة قبل أقل من 10 أيام عمل من موعد التدريب: 25% من إجمالي الرسوم + 100% من المصروفات غير القابلة للاسترداد.",
      "الإلغاء أو إعادة الجدولة قبل أقل من 5 أيام عمل من موعد التدريب: 50% من إجمالي الرسوم + 100% من المصروفات غير القابلة للاسترداد.",
    ],
  },
  {
    heading: "شروط الدفع",
    items: [
      "تصدر الفواتير دورياً وفقاً لتقدم التنفيذ.",
      "شروط الدفع القياسية: 30 يوماً من تاريخ الفاتورة.",
      "قد تعكس الرسوم درجة التعقيد والاستعجال والمخاطر ومستوى الخبرة والموارد المطلوبة.",
    ],
  },
];

/** Official receiving-account details as printed on the template's bank page. */
export const BANK_DETAILS: Array<{ label: string; value: string }> = [
  { label: "ACCOUNT", value: "HNI International Training" },
  { label: "BANK", value: "Al Rajhi Bank" },
  { label: "BRANCH", value: "Al Muznib Al-Qassim, KSA" },
  { label: "CURRENCY", value: "SAR" },
  { label: "IBAN", value: "SA1080000151608010789276" },
  { label: "ACCOUNT NUMBER", value: "151608010789276" },
  { label: "SWIFT CODE", value: "RJHISARIXXX" },
];
