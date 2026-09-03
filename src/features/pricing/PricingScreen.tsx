import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Copy, Download, Eye, FilePlus2, Files, FileSpreadsheet, ImagePlus, KanbanSquare, Trash2, Upload, Users2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PipelineTab } from "./PipelineTab";
import { SummaryPanel } from "./SummaryPanel";
import { customTermsPageCount, hasCustomTerms, serializeStandardTerms } from "./customTerms";
import { seedContext, seedLines } from "./cloud/boq";
import { BoqView } from "./cloud/BoqView";
import type { SupabaseStore } from "./cloud/supabaseStore";
import { TERMS_PAGE_1, TERMS_PAGE_2 } from "./template";
import { fileToLogoDataUrl } from "./logo";
import { debounce, LocalStoragePricingStore, type PricingStore } from "./store";
import {
  inPipeline,
  newId,
  newProposal,
  nextVersionTitle,
  PIPELINE_STAGES,
  SECTION_KINDS,
  sectionKindLabel,
  sectionKindLabels,
  type ExternalDeal,
  type PipelineInfo,
  type PipelineStage,
  type ProjectType,
  type Proposal,
  type Settings,
  type Targets,
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
  /** Cloud mode: teammates' proposals — a SEPARATE surface, never merged into
      `proposals` and never fed to pipeline math (accounts-supabase.md). */
  const [teamProposals, setTeamProposals] = useState(initialLoad.teamProposals ?? []);
  /** Cloud store with BOQ capability (null in localStorage mode). */
  const cloudStore = "createBoq" in pricingStore ? (pricingStore as SupabaseStore) : null;
  const [boqs, setBoqs] = useState(cloudStore?.boqs ?? []);
  const [costingDrawer, setCostingDrawer] = useState(false);
  const [boqViewOpen, setBoqViewOpen] = useState(false);
  const [ptPick, setPtPick] = useState("");
  const [pmPick, setPmPick] = useState("");
  const [includeClient, setIncludeClient] = useState(true);
  const [seedFromLines, setSeedFromLines] = useState(true);
  const [settings, setSettings] = useState<Settings>(initialLoad.settings);
  const [currentId, setCurrentId] = useState<string | null>(initialLoad.proposals[0]?.id ?? null);
  const [externals, setExternals] = useState<ExternalDeal[]>(initialLoad.externalDeals);
  const [mode, setMode] = useState<"edit" | "client" | "documents" | "pipeline">("edit");
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
  // Cloud mode: after a background refresh of shared/team data, re-read the
  // store snapshot (own drafts keep their in-memory versions inside the store).
  useEffect(() => {
    const cloud = pricingStore as { onRemoteRefresh?: (() => void) | null };
    if (!("onRemoteRefresh" in cloud)) return;
    cloud.onRemoteRefresh = () => {
      const fresh = pricingStore.loadAll();
      setExternals(fresh.externalDeals);
      setTeamProposals(fresh.teamProposals ?? []);
      setSettings((prev) => ({ ...prev, targets: fresh.settings.targets }));
      if (cloudStore) setBoqs(cloudStore.boqs);
    };
    return () => {
      cloud.onRemoteRefresh = null;
    };
  }, [pricingStore]);

  // Pending autosave writes must land before the tab closes or the component unmounts.
  useEffect(() => {
    const flush = () => save.flush();
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [save]);

  const ownCurrent = proposals.find((x) => x.id === currentId) ?? null;
  const teamEntry = ownCurrent ? null : (teamProposals.find((t) => t.proposal.id === currentId) ?? null);
  const current = ownCurrent ?? teamEntry?.proposal ?? null;
  /** Viewing a teammate's proposal: quote read-only (ownership lock, not sentAt). */
  const isTeamView = teamEntry != null;
  const locked = current?.sentAt != null || isTeamView;
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
    if (!current || isTeamView) return;
    addProposal({
      ...structuredClone(current),
      id: newId(),
      title: nextVersionTitle(current.title),
      date: new Date().toISOString().slice(0, 10),
      sentAt: null,
    });
    toast({ title: p.duplicate });
  };

  const markSent = () => {
    if (!current || locked) return;
    const updated = {
      ...current,
      sentAt: new Date().toISOString(),
      // A submitted proposal IS a pipeline deal (user mental model,
      // 2026-08-31): default the stage to "Proposal" so the amount and GP
      // reflect immediately. Never overwrites a stage set earlier.
      pipeline: current.pipeline.stage ? current.pipeline : { ...current.pipeline, stage: "Proposal" as const },
    };
    const next = proposals.map((x) => (x.id === updated.id ? updated : x));
    setProposals(next);
    save.flush();
    setStorageError(!pricingStore.saveProposal(updated, next.map((x) => x.id)));
    toast({ title: p.sent, description: p.sentLocked });
  };

  /**
   * Structural pipeline write path (design T3.4): only PipelineInfo fields can
   * flow through here, so the sent-lock on quote content cannot be bypassed.
   * Deliberately NOT guarded by `locked`: pipeline state is sales-journey
   * data and stays editable after Mark-as-sent.
   */
  const updatePipeline = (proposalId: string, patch: Partial<PipelineInfo>) => {
    const target = proposals.find((x) => x.id === proposalId);
    if (!target) {
      // A teammate's proposal (team view): journey stays team-editable and
      // routes to the shared row; quote content is untouchable by RLS anyway.
      const entry = teamProposals.find((t) => t.proposal.id === proposalId);
      if (!entry) return;
      const merged = { ...entry.proposal.pipeline, ...patch };
      setTeamProposals(teamProposals.map((t) => (t.proposal.id === proposalId ? { ...t, proposal: { ...t.proposal, pipeline: merged } } : t)));
      pricingStore.updateTeamJourney?.(proposalId, merged);
      return;
    }
    const updated = { ...target, pipeline: { ...target.pipeline, ...patch } };
    const next = proposals.map((x) => (x.id === proposalId ? updated : x));
    setProposals(next);
    if (pricingStore.updateJourney) {
      // Cloud: journey columns live on the shared row; gpPctOverride is quote
      // data and flows through saveProposal (it also moves the GP columns).
      const journeyPatch = { ...patch };
      delete journeyPatch.gpPctOverride;
      delete journeyPatch.copiedAt;
      if (Object.keys(journeyPatch).length > 0) pricingStore.updateJourney(target, journeyPatch);
      if ("gpPctOverride" in patch) save(updated, next.map((x) => x.id));
    } else {
      save(updated, next.map((x) => x.id));
    }
  };

  const stampCopied = (proposalIds: string[]) => {
    const now = new Date().toISOString();
    const ids = new Set(proposalIds);
    const next = proposals.map((x) => (ids.has(x.id) ? { ...x, pipeline: { ...x.pipeline, copiedAt: now } } : x));
    setProposals(next);
    if (pricingStore.stampCopied) {
      // Cloud: per-user stamps in the copies table (a colleague's copy never
      // marks rows copied for me).
      pricingStore.stampCopied(proposalIds);
      return;
    }
    for (const x of next) if (ids.has(x.id)) pricingStore.saveProposal(x, next.map((y) => y.id));
  };

  const replaceExternals = (deals: ExternalDeal[]) => {
    setExternals(deals);
    setStorageError(!pricingStore.replaceExternalDeals(deals));
  };

  const updateExternal = (deal: ExternalDeal) => {
    const next = externals.map((d) => (d.id === deal.id ? deal : d));
    setExternals(next);
    setStorageError(!pricingStore.replaceExternalDeals(next));
  };

  const deleteExternal = (id: string) => {
    // Judge F1 (HIGH): imported deals feed achievement totals and cannot be
    // recreated in-app, so deletion gets the same gate as decided proposals.
    if (!window.confirm(p.confirmDeleteImported)) return;
    setExternals(externals.filter((d) => d.id !== id));
    pricingStore.deleteExternalDeal(id);
  };

  /**
   * Internal costing workbook (design: cost-excel-and-custom-terms.md).
   * Regenerated from data on every click, never stored; works on drafts and
   * sent proposals alike (the sent data is frozen, so the file reproduces the
   * quoted economics exactly).
   */
  const downloadCosting = async (proposal: Proposal) => {
    try {
      // Lazy: keeps the writer + jszip out of the main bundle.
      const [{ buildCostingRows, costingFileName, COSTING_COLS }, { buildWorkbook }] = await Promise.all([
        import("./costingXlsx"),
        import("./xlsx"),
      ]);
      const { rows, rowKinds } = buildCostingRows(proposal, calc(proposal));
      const buf = await buildWorkbook("Costing", rows, { rowKinds, cols: COSTING_COLS, freezeRows: 4 });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = costingFileName(proposal.clientName, proposal.title, proposal.date, p.untitled);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: p.exportError, variant: "destructive" });
    }
  };

  /** BOQ relay (design: boq-costing-relay.md) — BD side. */
  const sendToCosting = async () => {
    if (!cloudStore || !current || !ptPick || !pmPick) return;
    try {
      await cloudStore.createBoq({
        proposalId: current.id,
        owner: cloudStore.sessionUserId,
        ptAssignee: ptPick,
        pmAssignee: pmPick,
        status: "draft",
        context: seedContext(current, includeClient),
        lines: seedFromLines ? seedLines(current) : [],
      });
      setBoqs(cloudStore.boqs);
      setCostingDrawer(false);
      toast({ title: p.boqStatusLabels.draft });
    } catch {
      toast({ title: p.exportError, variant: "destructive" });
    }
  };

  const importBoq = () => {
    if (!cloudStore || !current) return;
    const boq = boqs.find((b) => b.proposalId === current.id);
    if (!boq || boq.status !== "ready") return;
    const order = proposals.map((x) => x.id);
    const updated = cloudStore.importBoq(current, boq, p.boqUnmatchedSection, order);
    setProposals(proposals.map((x) => (x.id === updated.id ? updated : x)));
    setBoqs(cloudStore.boqs);
    toast({ title: p.boqImported });
  };

  const updateTargets = (targets: Targets) => {
    const nextSettings = { ...settings, targets };
    setSettings(nextSettings);
    setStorageError(!pricingStore.saveSettings(nextSettings));
  };

  const deleteProposal = () => {
    if (!current || isTeamView) return;
    // A decided deal counts in achievement numbers: one deliberate confirmation (design T3.7).
    const stage = current.pipeline.stage;
    if ((stage === "Won" || stage === "Lost") && !window.confirm(p.confirmDecidedDelete)) return;
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
    return (
      <ClientView
        proposal={current}
        result={result}
        settings={settings}
        onSettingsChange={(patch) => {
          const nextSettings = { ...settings, ...patch };
          setSettings(nextSettings);
          setStorageError(!pricingStore.saveSettings(nextSettings));
        }}
        onBack={() => setMode(clientViewOrigin)}
      />
    );
  }

  const sentDocuments = proposals.filter((x) => x.sentAt != null);
  const pipelineCount = proposals.filter(inPipeline).length + externals.length;

  return (
    <div>
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        controls={
          // Judge F10: imported deals must stay reachable even with zero
          // proposals, so the toggles render whenever ANY pipeline data exists.
          proposals.length > 0 || externals.length > 0 ? (
            <>
              {(proposals.length > 0 || teamProposals.length > 0) && (
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
                  {teamProposals.length > 0 && (
                    <div className="mt-1 border-t border-line-1 px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">
                      {p.teamProposals}
                    </div>
                  )}
                  {teamProposals.map((t) => (
                    <SelectItem key={t.proposal.id} value={t.proposal.id} data-testid={`team-proposal-${t.proposal.id}`}>
                      {t.proposal.title || p.untitled} · {t.ownerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
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
              <Button
                variant={mode === "pipeline" ? "secondary" : "outline"}
                size="sm"
                aria-pressed={mode === "pipeline"}
                data-testid="pipeline-toggle"
                onClick={() => setMode(mode === "pipeline" ? "edit" : "pipeline")}
              >
                <KanbanSquare className="size-4" aria-hidden />
                {p.pipelineTab}
                {pipelineCount > 0 && (
                  <span className="tabular rounded bg-surface-2 px-1 text-[11px] text-hni-grey-dark">{pipelineCount}</span>
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

      {mode === "pipeline" && (
        <PipelineTab
          proposals={proposals}
          externals={externals}
          settings={settings}
          onUpdatePipeline={updatePipeline}
          onStampCopied={stampCopied}
          onReplaceExternals={replaceExternals}
          onDeleteExternal={deleteExternal}
          onUpdateExternal={updateExternal}
          onUpdateTargets={updateTargets}
          onOpenProposal={(id) => {
            setCurrentId(id);
            setMode("edit");
          }}
        />
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
          onDownloadCosting={(id) => {
            const target = proposals.find((x) => x.id === id);
            if (target) void downloadCosting(target);
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
                <div className="w-44">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plStage}</span>
                  {/* The pipeline entry point: setting a stage adds the proposal to the
                      pipeline tab. Deliberately NOT disabled when locked; see updatePipeline. */}
                  <Select
                    value={current.pipeline.stage ?? "__none"}
                    onValueChange={(v) => {
                      if (v === "__none") {
                        updatePipeline(current.id, { stage: undefined, decidedAt: null });
                        return;
                      }
                      const stage = v as PipelineStage;
                      const decided = stage === "Won" || stage === "Lost";
                      updatePipeline(current.id, {
                        stage,
                        decidedAt: decided ? (current.pipeline.decidedAt ?? new Date().toISOString().slice(0, 10)) : null,
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 h-8" aria-label={p.plStage} data-testid="pipeline-stage-edit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{p.plNoStage}</SelectItem>
                      {PIPELINE_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {(p.stageLabels as Record<string, string>)[s] ?? s}
                        </SelectItem>
                      ))}
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
                <span data-testid="sent-badge" className="mb-1.5 flex items-center gap-1.5">
                  {hasCustomTerms(current) && (
                    <span data-testid="custom-terms-badge">
                      <StatusBadge tone="neutral">{p.customTermsBadge}</StatusBadge>
                    </span>
                  )}
                  <StatusBadge tone={locked ? "success" : "neutral"}>{locked ? p.sent : p.draft}</StatusBadge>
                </span>
              </div>
              {isTeamView ? (
                <p className="mt-2 text-[12.5px] font-medium text-hni-grey-dark" data-testid="team-readonly-banner">
                  {p.teamReadOnly.replace("{name}", teamEntry?.ownerName ?? "")}
                </p>
              ) : (
                locked && <p className="mt-2 text-[12.5px] text-hni-grey-dark" data-testid="locked-hint">{p.sentLocked}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line-1 pt-3">
                {!isTeamView && (
                <Button variant="outline" size="sm" data-testid="duplicate" onClick={duplicateProposal}>
                  <Copy className="size-4" aria-hidden />
                  {p.duplicate}
                </Button>
                )}
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
                {cloudStore && !isTeamView && !locked && !boqs.some((b) => b.proposalId === current.id) && (
                  <Button variant="outline" size="sm" data-testid="send-to-costing" onClick={() => setCostingDrawer(!costingDrawer)}>
                    <Users2 className="size-4" aria-hidden />
                    {p.boqSendToCosting}
                  </Button>
                )}
                {cloudStore && (() => {
                  const boq = boqs.find((b) => b.proposalId === current.id);
                  if (!boq) return null;
                  return (
                    <span className="flex items-center gap-1.5">
                      <span data-testid="boq-chip">
                        <StatusBadge tone={boq.status === "ready" ? "success" : "info"}>
                          {p.boqChip.replace("{status}", p.boqStatusLabels[boq.status])}
                        </StatusBadge>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[12.5px]"
                        data-testid="view-boq"
                        aria-pressed={boqViewOpen}
                        onClick={() => setBoqViewOpen(!boqViewOpen)}
                      >
                        <Eye className="size-3.5" aria-hidden />
                        {p.boqViewTitle}
                      </Button>
                      {boq.status === "ready" && !locked && (
                        <Button size="sm" data-testid="import-boq" onClick={importBoq}>
                          <Download className="size-4" aria-hidden />
                          {p.boqImport}
                        </Button>
                      )}
                    </span>
                  );
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="download-costing"
                  onClick={() => void downloadCosting(current)}
                >
                  <FileSpreadsheet className="size-4" aria-hidden />
                  {p.downloadCosting}
                </Button>
                {!isTeamView && (
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
                )}
              </div>
              {boqViewOpen && cloudStore && (() => {
                const boq = boqs.find((b) => b.proposalId === current.id);
                return boq ? <BoqView boq={boq} profiles={cloudStore.profiles} /> : null;
              })()}
              {costingDrawer && cloudStore && !isTeamView && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-line-1 bg-surface-1 p-3" data-testid="costing-drawer">
                  <label className="w-44">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.boqAssignPt}</span>
                    <select
                      className="mt-1 h-8 w-full rounded-md border border-line-1 bg-surface-0 px-2 text-[13px]"
                      value={ptPick}
                      data-testid="boq-pt-select"
                      onChange={(e) => setPtPick(e.target.value)}
                    >
                      <option value="">—</option>
                      {cloudStore.profiles.filter((x) => x.role === "proposals_team").map((x) => (
                        <option key={x.id} value={x.id}>{x.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="w-44">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.boqAssignPm}</span>
                    <select
                      className="mt-1 h-8 w-full rounded-md border border-line-1 bg-surface-0 px-2 text-[13px]"
                      value={pmPick}
                      data-testid="boq-pm-select"
                      onChange={(e) => setPmPick(e.target.value)}
                    >
                      <option value="">—</option>
                      {cloudStore.profiles.filter((x) => x.role === "project_manager").map((x) => (
                        <option key={x.id} value={x.id}>{x.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 pb-1 text-[12.5px] text-hni-grey-dark">
                    <input type="checkbox" checked={includeClient} onChange={(e) => setIncludeClient(e.target.checked)} />
                    {p.boqIncludeClient}
                  </label>
                  <label className="flex items-center gap-1.5 pb-1 text-[12.5px] text-hni-grey-dark">
                    <input type="checkbox" checked={seedFromLines} onChange={(e) => setSeedFromLines(e.target.checked)} />
                    {p.boqSeedLines}
                  </label>
                  {cloudStore.profiles.every((x) => x.role !== "proposals_team" && x.role !== "project_manager") && (
                    <p className="w-full text-[12px] text-hni-grey-dark">{p.boqNoDeliveryUsers}</p>
                  )}
                  <span className="ms-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCostingDrawer(false)}>{p.boqCancel}</Button>
                    <Button size="sm" disabled={!ptPick || !pmPick} data-testid="boq-create" onClick={() => void sendToCosting()}>
                      {p.boqCreate}
                    </Button>
                  </span>
                </div>
              )}
            </section>

            <CostTable
              programs={current.programs}
              locked={locked}
              result={result}
              defaultMarkupPct={current.markupPct}
              seedLabels={current.projectType === "workshop" ? p.workshopLines : []}
              groupLabel={sectionKindLabel(current.sectionLabel, p)}
              onChange={(programs) => updateCurrent({ programs })}
            />

            {/* Terms & Conditions: standard by default; Custom pre-fills the
                box with the standard text so the user edits deltas (design:
                cost-excel-and-custom-terms.md). Quote field: sent-locked. */}
            <section className="rounded-lg border border-line-1 bg-surface-0 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="me-1 text-[13px] font-semibold text-hni-black">{p.termsTitle}</h3>
                <Button
                  variant={current.customTerms == null ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  disabled={locked}
                  data-testid="terms-standard"
                  onClick={() => updateCurrent({ customTerms: null })}
                >
                  {p.standardTermsOption}
                </Button>
                <Button
                  variant={current.customTerms != null ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  disabled={locked}
                  data-testid="terms-custom"
                  onClick={() => {
                    if (current.customTerms == null)
                      updateCurrent({ customTerms: serializeStandardTerms([...TERMS_PAGE_1, ...TERMS_PAGE_2]) });
                  }}
                >
                  {p.customTermsOption}
                </Button>
              </div>
              {current.customTerms != null && (
                <div className="mt-2">
                  <Textarea
                    value={current.customTerms}
                    disabled={locked}
                    rows={10}
                    dir="auto"
                    className="text-[13px] leading-relaxed"
                    data-testid="custom-terms-input"
                    onChange={(e) => updateCurrent({ customTerms: e.target.value })}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-hni-grey-dark">
                    <span>{p.customTermsHint}</span>
                    {hasCustomTerms(current) ? (
                      <span className="tabular" data-testid="custom-terms-pages">
                        {p.rendersAsPages.replace("{n}", String(customTermsPageCount(current.customTerms)))}
                      </span>
                    ) : (
                      <span data-testid="custom-terms-empty">{p.customTermsEmptyFallback}</span>
                    )}
                  </div>
                </div>
              )}
            </section>
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
