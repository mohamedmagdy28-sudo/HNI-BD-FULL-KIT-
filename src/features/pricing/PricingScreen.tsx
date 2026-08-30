import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Copy, Download, Eye, FilePlus2, Files, ImagePlus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { calc } from "./calc";
import { ClientView } from "./ClientView";
import { CostTable } from "./CostTable";
import { DocumentsList } from "./DocumentsList";
import { SummaryPanel } from "./SummaryPanel";
import { fileToLogoDataUrl } from "./logo";
import { debounce, LocalStoragePricingStore, type PricingStore } from "./store";
import {
  newId,
  newProposal,
  SECTION_KINDS,
  sectionKindLabel,
  sectionKindLabels,
  type ProjectType,
  type Proposal,
  type Settings,
} from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function PricingScreen({ store }: { store?: PricingStore }) {
  const { t, locale } = useI18n();
  const p = t.pricing;
  const { toast } = useToast();

  // Lazy initializers: the store loads synchronously once, before first paint,
  // so there is no loading state and no setState-in-effect cascade.
  const [pricingStore] = useState<PricingStore>(() => store ?? new LocalStoragePricingStore());
  const [initialLoad] = useState(() => pricingStore.loadAll());
  const [mountedAt] = useState(() => Date.now());
  const [proposals, setProposals] = useState<Proposal[]>(initialLoad.proposals);
  const [settings, setSettings] = useState<Settings>(initialLoad.settings);
  const [currentId, setCurrentId] = useState<string | null>(initialLoad.proposals[0]?.id ?? null);
  const [mode, setMode] = useState<"edit" | "client" | "documents">("edit");
  /** Where the client view's Back button returns to. */
  const [clientViewOrigin, setClientViewOrigin] = useState<"edit" | "documents">("edit");
  const [storageError, setStorageError] = useState(false);
  const [hadCorruptData, setHadCorruptData] = useState(initialLoad.corruptIds.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const save = useMemo(
    () =>
      debounce((proposal: Proposal, order: string[]) => {
        setStorageError(!pricingStore.saveProposal(proposal, order));
      }, 300),
    [pricingStore],
  );
  // Pending autosave writes must land before the tab closes or the component unmounts.
  useEffect(() => {
    const flush = () => save.flush();
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [save]);

  const current = proposals.find((x) => x.id === currentId) ?? null;
  const locked = current?.sentAt != null;
  const result = useMemo(() => (current ? calc(current) : null), [current]);

  const updateCurrent = (patch: Partial<Proposal>) => {
    if (!current || locked) return;
    const updated = { ...current, ...patch };
    const next = proposals.map((x) => (x.id === updated.id ? updated : x));
    setProposals(next);
    save(updated, next.map((x) => x.id));
  };

  const addProposal = (proposal: Proposal) => {
    const next = [proposal, ...proposals];
    setProposals(next);
    setCurrentId(proposal.id);
    setMode("edit");
    save.flush();
    setStorageError(!pricingStore.saveProposal(proposal, next.map((x) => x.id)));
  };

  const createProposal = () => {
    // First use starts the weekly backup clock; the reminder should mean
    // "a week without a backup", not "you just started".
    if (!settings.lastExportAt) {
      const nextSettings = { ...settings, lastExportAt: new Date().toISOString() };
      setSettings(nextSettings);
      pricingStore.saveSettings(nextSettings);
    }
    addProposal(newProposal(p.untitled, p.firstInstallment));
  };

  const duplicateProposal = () => {
    if (!current) return;
    addProposal({
      ...structuredClone(current),
      id: newId(),
      title: `${current.title} ${p.copySuffix}`,
      date: new Date().toISOString().slice(0, 10),
      sentAt: null,
    });
    toast({ title: p.duplicate });
  };

  const markSent = () => {
    if (!current || locked) return;
    const updated = { ...current, sentAt: new Date().toISOString() };
    const next = proposals.map((x) => (x.id === updated.id ? updated : x));
    setProposals(next);
    save.flush();
    setStorageError(!pricingStore.saveProposal(updated, next.map((x) => x.id)));
    toast({ title: p.sent, description: p.sentLocked });
  };

  const deleteProposal = () => {
    if (!current) return;
    const next = proposals.filter((x) => x.id !== current.id);
    setProposals(next);
    setCurrentId(next[0]?.id ?? null);
    setMode("edit");
    pricingStore.deleteProposal(current.id, next.map((x) => x.id));
  };

  const exportBackup = () => {
    const json = pricingStore.exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hni-pricing-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const nextSettings = { ...settings, lastExportAt: new Date().toISOString() };
    setSettings(nextSettings);
    pricingStore.saveSettings(nextSettings);
  };

  const importBackup = async (file: File) => {
    try {
      const loaded = pricingStore.importAll(await file.text());
      setProposals(loaded.proposals);
      setSettings(loaded.settings);
      setCurrentId(loaded.proposals[0]?.id ?? null);
      setHadCorruptData(false);
      setStorageError(false);
    } catch {
      toast({ title: p.importError, variant: "destructive" });
    }
  };

  const showExportReminder =
    proposals.length > 0 &&
    (!settings.lastExportAt || mountedAt - new Date(settings.lastExportAt).getTime() > WEEK_MS);

  const dateLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${iso}T00:00:00`));

  if (mode === "client" && current && result) {
    return <ClientView proposal={current} result={result} onBack={() => setMode(clientViewOrigin)} />;
  }

  const sentDocuments = proposals.filter((x) => x.sentAt != null);

  return (
    <div>
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        controls={
          proposals.length > 0 ? (
            <>
              <Select value={currentId ?? undefined} onValueChange={(id) => { setCurrentId(id); setMode("edit"); }}>
                <SelectTrigger className="h-8 w-52" aria-label={p.switcher} data-testid="proposal-switcher">
                  <SelectValue placeholder={p.switcher} />
                </SelectTrigger>
                <SelectContent>
                  {proposals.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.title || p.untitled} · {dateLabel(x.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" data-testid="export-backup" onClick={exportBackup}>
                <Download className="size-4" aria-hidden />
                {p.export}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" aria-hidden />
                {p.import}
              </Button>
              <Button
                variant={mode === "documents" ? "secondary" : "outline"}
                size="sm"
                aria-pressed={mode === "documents"}
                data-testid="documents-toggle"
                onClick={() => setMode(mode === "documents" ? "edit" : "documents")}
              >
                <Files className="size-4" aria-hidden />
                {p.documents}
                {sentDocuments.length > 0 && (
                  <span className="tabular rounded bg-surface-2 px-1 text-[11px] text-hni-grey-dark">{sentDocuments.length}</span>
                )}
              </Button>
            </>
          ) : undefined
        }
        primary={
          <Button size="sm" data-testid="new-proposal" onClick={createProposal}>
            <FilePlus2 className="size-4" aria-hidden />
            {p.newProposal}
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importBackup(file);
          e.target.value = "";
        }}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        data-testid="client-logo-upload"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void fileToLogoDataUrl(file)
            .then((dataUrl) => updateCurrent({ clientLogo: dataUrl }))
            .catch(() => toast({ title: p.clientLogoError, variant: "destructive" }));
        }}
      />

      {storageError && (
        <p role="alert" data-testid="storage-error" className="mb-3 rounded-md bg-[color:var(--status-danger-bg)] px-3 py-2 text-[13px] text-[color:var(--status-danger-fg)]">
          {p.storageError}
        </p>
      )}
      {hadCorruptData && (
        <p role="alert" className="mb-3 rounded-md bg-[color:var(--status-warning-bg)] px-3 py-2 text-[13px] text-[color:var(--status-warning-fg)]">
          {p.corruptData}
        </p>
      )}
      {showExportReminder && !storageError && (
        <div data-testid="export-reminder" className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-[color:var(--status-info-bg)] px-3 py-2 text-[13px] text-[color:var(--status-info-fg)]">
          <span className="min-w-0 flex-1">{p.exportReminder}</span>
          <Button variant="outline" size="sm" className="h-7" onClick={exportBackup}>
            {p.export}
          </Button>
        </div>
      )}

      {mode === "documents" && (
        <DocumentsList
          documents={sentDocuments}
          onOpenDocument={(id) => {
            setCurrentId(id);
            setClientViewOrigin("documents");
            setMode("client");
          }}
          onOpenCosting={(id) => {
            setCurrentId(id);
            setMode("edit");
          }}
        />
      )}

      {mode === "edit" && !current && (
        <EmptyState title={p.empty.title} body={p.empty.body} cta={p.newProposal} onCta={createProposal} />
      )}

      {mode === "edit" && current && result && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-line-1 bg-surface-0 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 basis-44">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.client}</span>
                  <Input
                    value={current.clientName}
                    disabled={locked}
                    data-testid="client-name"
                    onChange={(e) => updateCurrent({ clientName: e.target.value })}
                    className="mt-1 h-8"
                  />
                </label>
                <label className="min-w-0 flex-1 basis-56">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.proposalTitle}</span>
                  <Input
                    value={current.title}
                    disabled={locked}
                    data-testid="proposal-title"
                    onChange={(e) => updateCurrent({ title: e.target.value })}
                    className="mt-1 h-8"
                  />
                </label>
                <label className="w-40">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.date}</span>
                  <Input
                    type="date"
                    value={current.date}
                    disabled={locked}
                    onChange={(e) => updateCurrent({ date: e.target.value })}
                    className="tabular mt-1 h-8"
                  />
                </label>
                <div className="w-36">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.sectionLabel}</span>
                  <Select
                    value={current.sectionLabel || "program"}
                    disabled={locked}
                    onValueChange={(v) => updateCurrent({ sectionLabel: v === "program" ? "" : v })}
                  >
                    <SelectTrigger className="mt-1 h-8" aria-label={p.sectionLabel} data-testid="section-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {sectionKindLabels(p)[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.projectType}</span>
                  <Select
                    value={current.projectType}
                    disabled={locked}
                    onValueChange={(v) => updateCurrent({ projectType: v as ProjectType })}
                  >
                    <SelectTrigger className="mt-1 h-8" aria-label={p.projectType} data-testid="project-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workshop">{p.projectTypes.workshop}</SelectItem>
                      <SelectItem value="custom">{p.projectTypes.custom}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mb-0.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.clientLogo}</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {current.clientLogo ? (
                      <>
                        <img
                          src={current.clientLogo}
                          alt={p.clientLogo}
                          data-testid="client-logo-preview"
                          className="h-8 w-auto max-w-28 rounded border border-line-1 bg-surface-0 object-contain px-1"
                        />
                        {!locked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                            aria-label={p.clientLogoRemove}
                            data-testid="client-logo-remove"
                            onClick={() => updateCurrent({ clientLogo: null })}
                          >
                            <X className="size-3.5" aria-hidden />
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={locked}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <ImagePlus className="size-4" aria-hidden />
                        {p.clientLogo}
                      </Button>
                    )}
                  </div>
                </div>
                <span data-testid="sent-badge" className="mb-1.5">
                  <StatusBadge tone={locked ? "success" : "neutral"}>{locked ? p.sent : p.draft}</StatusBadge>
                </span>
              </div>
              {locked && <p className="mt-2 text-[12.5px] text-hni-grey-dark" data-testid="locked-hint">{p.sentLocked}</p>}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line-1 pt-3">
                <Button variant="outline" size="sm" data-testid="duplicate" onClick={duplicateProposal}>
                  <Copy className="size-4" aria-hidden />
                  {p.duplicate}
                </Button>
                {!locked && (
                  <Button variant="outline" size="sm" data-testid="mark-sent" onClick={markSent}>
                    <CheckCheck className="size-4" aria-hidden />
                    {p.markSent}
                  </Button>
                )}
                <Button
                  size="sm"
                  data-testid="open-client-view"
                  disabled={!result.scheduleValid}
                  onClick={() => {
                    setClientViewOrigin("edit");
                    setMode("client");
                  }}
                >
                  <Eye className="size-4" aria-hidden />
                  {p.clientView}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="delete-proposal"
                  className="ms-auto text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                  onClick={deleteProposal}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {p.deleteProposal}
                </Button>
              </div>
            </section>

            <CostTable
              programs={current.programs}
              locked={locked}
              seedLabels={current.projectType === "workshop" ? p.workshopLines : []}
              groupLabel={sectionKindLabel(current.sectionLabel, p)}
              onChange={(programs) => updateCurrent({ programs })}
            />
          </div>

          <div className="lg:sticky lg:top-4">
            <SummaryPanel
              proposal={current}
              result={result}
              marginFloorPct={settings.marginFloorPct}
              locked={locked}
              onChange={updateCurrent}
            />
          </div>
        </div>
      )}
    </div>
  );
}
