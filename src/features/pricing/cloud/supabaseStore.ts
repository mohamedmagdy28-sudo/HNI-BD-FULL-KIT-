// Supabase-backed PricingStore (design: docs/designs/accounts-supabase.md, APPROVED).
//
// Shape of the integration: AuthGate loads the full snapshot asynchronously
// BEFORE PricingScreen mounts, so this store serves the same synchronous
// loadAll() contract as localStorage and the screen never branches on mode.
// Writes are optimistic: methods return true immediately, the actual network
// write runs through a per-record single-flight queue (latest-state
// coalescing, in-order dispatch) and failures surface through onStatus.
//
// Data model (the load-bearing decision): sales-journey fields are canonical
// on the shared pipeline_rows table for EVERYONE, including the owner.
// proposals.data keeps quote content only (plus gpPctOverride, which is
// owner-private pricing judgment, and copiedAt hydrated per-user from
// copies). saveProposal never writes journey columns after the initial
// insert, so a teammate's stage edit can never be clobbered by autosave.
//
// Team visibility (v1, symmetric): everyone reads all proposals; writes stay
// owner-only (RLS split per-command policies). Teammates' proposals hydrate
// into `teamProposals` — a SEPARATE surface never merged into `proposals`
// and never fed to pipeline math (their deals already arrive through the
// shared pipeline_rows channel as pseudo-externals; merging would
// double-count every sent deal).

import type { SupabaseClient } from "@supabase/supabase-js";
import { calc } from "../calc";
import {
  asImageDataUrl,
  DEFAULT_SETTINGS,
  inPipeline,
  normalizeProposal,
  PIPELINE_STAGES,
  type ExternalDeal,
  type PipelineInfo,
  type PipelineStage,
  type Proposal,
  type Settings,
  type Targets,
} from "../types";
import type { LoadResult, PricingStore } from "../store";

export type TeamProposal = { proposal: Proposal; ownerId: string; ownerName: string };
export type CloudStatus = "saving" | "saved" | "error";

/** Pseudo-external ids for teammates' pipeline rows (kept out of `proposals`). */
export const TEAM_ROW_PREFIX = "team:";

type PipelineRowRecord = {
  proposal_id: string;
  owner: string;
  client: string;
  title: string;
  value: number | null;
  gp_amount: number | null;
  gp_pct: number | null;
  stage: string | null;
  probability: number | null;
  decided_at: string | null;
  source: string | null;
  deal_type: string | null;
  sector: string | null;
  primary_service: string | null;
  delivery_start: string | null;
  delivery_end: string | null;
  po_number: string | null;
  project_status: string | null;
  notes: string | null;
};

/**
 * Quote-only payload for proposals.data: journey fields live on pipeline_rows.
 * gpPctOverride stays here (owner-private); copiedAt is dropped (per-user in
 * `copies`).
 */
export function stripJourney(p: Proposal): Proposal {
  return {
    ...p,
    pipeline: p.pipeline.gpPctOverride != null ? { gpPctOverride: p.pipeline.gpPctOverride } : {},
  };
}

/** Identity + money columns the OWNER upserts (never journey; see module header). */
export function identityColumns(p: Proposal): Pick<PipelineRowRecord, "client" | "title" | "value" | "gp_amount" | "gp_pct"> {
  const result = calc(p);
  const override = p.pipeline.gpPctOverride;
  return {
    client: p.clientName,
    title: p.title,
    value: result.netPrice,
    gp_amount: override != null ? Math.round((result.netPrice * override) / 100) : result.marginAmount,
    gp_pct: override ?? result.marginPct,
  };
}

/** Journey columns, written only on the row's initial insert (or via updateJourney). */
export function journeyColumns(info: PipelineInfo): Omit<PipelineRowRecord, "proposal_id" | "owner" | "client" | "title" | "value" | "gp_amount" | "gp_pct"> {
  return {
    stage: info.stage ?? null,
    probability: info.winningProbability ?? null,
    decided_at: info.decidedAt ?? null,
    source: info.source ?? null,
    deal_type: info.dealType ?? null,
    sector: info.sector ?? null,
    primary_service: info.primaryService ?? null,
    delivery_start: info.deliveryStart ?? null,
    delivery_end: info.deliveryEnd ?? null,
    po_number: info.poNumber ?? null,
    project_status: info.projectStatus ?? null,
    notes: info.notes ?? null,
  };
}

/** Row → the in-memory PipelineInfo shape, so proposals hydrate identically in both modes. */
export function rowToPipelineInfo(row: PipelineRowRecord): PipelineInfo {
  const stage = (PIPELINE_STAGES as readonly string[]).includes(row.stage ?? "") ? (row.stage as PipelineStage) : undefined;
  return {
    stage,
    winningProbability: row.probability ?? undefined,
    decidedAt: row.decided_at,
    source: row.source ?? undefined,
    dealType: row.deal_type ?? undefined,
    sector: row.sector ?? undefined,
    primaryService: row.primary_service ?? undefined,
    deliveryStart: row.delivery_start ?? undefined,
    deliveryEnd: row.delivery_end ?? undefined,
    poNumber: row.po_number ?? undefined,
    projectStatus: row.project_status ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/**
 * A teammate's pipeline row as a pseudo-external deal: value/GP flow into the
 * shared totals exactly like an imported row; journey fields stay editable
 * (routed back to the row); identity/money render read-only by RLS anyway.
 */
export function rowToTeamExternal(row: PipelineRowRecord, ownerName: string): ExternalDeal {
  return {
    id: `${TEAM_ROW_PREFIX}${row.proposal_id}`,
    importedAt: "",
    date: "",
    source: row.source ?? "",
    dealType: row.deal_type ?? "",
    sector: row.sector ?? "",
    primaryService: row.primary_service ?? "",
    company: row.client,
    projectName: row.title,
    stage: ((PIPELINE_STAGES as readonly string[]).includes(row.stage ?? "") ? row.stage : "") as PipelineStage | "",
    winningProbability: row.probability,
    deliveryStart: row.delivery_start ?? "",
    deliveryEnd: row.delivery_end ?? "",
    poNumber: row.po_number ?? "",
    currency: "SAR",
    dealValue: row.value,
    gpPct: row.gp_pct,
    gpAmount: row.gp_amount,
    projectStatus: row.project_status ?? "",
    notes: row.notes ?? "",
    flags: {},
    ownerName,
  };
}

/** Journey patch from an edited pseudo-external (the only writable surface on a team row). */
export function externalToJourneyPatch(deal: ExternalDeal): Partial<PipelineInfo> {
  return {
    stage: deal.stage === "" ? undefined : deal.stage,
    winningProbability: deal.winningProbability ?? undefined,
    source: deal.source || undefined,
    dealType: deal.dealType || undefined,
    sector: deal.sector || undefined,
    primaryService: deal.primaryService || undefined,
    deliveryStart: deal.deliveryStart || undefined,
    deliveryEnd: deal.deliveryEnd || undefined,
    poNumber: deal.poNumber || undefined,
    projectStatus: deal.projectStatus || undefined,
    notes: deal.notes || undefined,
  };
}

type Snapshot = {
  proposals: Proposal[];
  teamProposals: TeamProposal[];
  externalDeals: ExternalDeal[];
  settings: Settings;
  corruptIds: string[];
};

type CloudExportPayload = {
  version: 3;
  settings: Settings;
  proposals: Proposal[];
  externalDeals: ExternalDeal[];
  /** Teammates' proposals: backup-for-reading only; NEVER imported. */
  teamProposals: Array<{ ownerName: string; proposal: Proposal }>;
};

const SETTINGS_ROW_ID = 1;

export class SupabaseStore implements PricingStore {
  /** Latest hydrated state; loadAll() serves this synchronously. */
  private snapshot: Snapshot;
  /** Per-record write chains: key → tail promise (in-order, single-flight). */
  private chains = new Map<string, Promise<void>>();
  private pendingCount = 0;
  onStatus: ((status: CloudStatus) => void) | null = null;
  /** Fired after a background re-fetch of shared data; the screen re-reads loadAll(). */
  onRemoteRefresh: (() => void) | null = null;

  private client: SupabaseClient;
  private userId: string;

  private constructor(client: SupabaseClient, userId: string, snapshot: Snapshot) {
    this.client = client;
    this.userId = userId;
    this.snapshot = snapshot;
  }

  // ------------------------------------------------------------------ boot

  static async create(client: SupabaseClient, userId: string): Promise<SupabaseStore> {
    const snapshot = await SupabaseStore.fetchSnapshot(client, userId);
    return new SupabaseStore(client, userId, snapshot);
  }

  private static async fetchSnapshot(client: SupabaseClient, userId: string): Promise<Snapshot> {
    const [proposalsRes, rowsRes, externalsRes, teamRes, userRes, profilesRes, copiesRes] = await Promise.all([
      client.from("proposals").select("id, owner, data, sort_index").order("sort_index"),
      client.from("pipeline_rows").select("*"),
      client.from("external_deals").select("id, data"),
      client.from("team_settings").select("targets").eq("id", SETTINGS_ROW_ID).maybeSingle(),
      client.from("user_settings").select("data").eq("user_id", userId).maybeSingle(),
      client.from("profiles").select("id, display_name"),
      client.from("copies").select("row_id, copied_at").eq("user_id", userId),
    ]);
    const firstError = [proposalsRes, rowsRes, externalsRes, teamRes, userRes, profilesRes, copiesRes].find((r) => r.error);
    if (firstError?.error) throw new Error(firstError.error.message);

    const names = new Map<string, string>((profilesRes.data ?? []).map((r) => [r.id as string, r.display_name as string]));
    const rows = new Map<string, PipelineRowRecord>(
      ((rowsRes.data ?? []) as PipelineRowRecord[]).map((r) => [r.proposal_id, r]),
    );
    const copied = new Map<string, string>((copiesRes.data ?? []).map((r) => [r.row_id as string, r.copied_at as string]));

    const corruptIds: string[] = [];
    const proposals: Proposal[] = [];
    const teamProposals: TeamProposal[] = [];
    for (const rec of proposalsRes.data ?? []) {
      let parsed: Proposal;
      try {
        parsed = normalizeProposal(rec.data as Proposal);
        if (typeof parsed.id !== "string" || !Array.isArray(parsed.programs)) throw new Error("shape");
      } catch {
        corruptIds.push(rec.id as string);
        continue;
      }
      const row = rows.get(rec.id as string);
      const hydrated: Proposal = {
        ...parsed,
        pipeline: {
          ...(row ? rowToPipelineInfo(row) : {}),
          gpPctOverride: parsed.pipeline.gpPctOverride,
          copiedAt: copied.get(rec.id as string) ?? null,
        },
      };
      if (rec.owner === userId) proposals.push(hydrated);
      else teamProposals.push({ proposal: hydrated, ownerId: rec.owner as string, ownerName: names.get(rec.owner as string) ?? "—" });
    }

    const externalDeals: ExternalDeal[] = [];
    for (const rec of externalsRes.data ?? []) {
      const deal = rec.data as ExternalDeal;
      if (deal && typeof deal.id === "string") externalDeals.push(deal.gpPct == null && deal.gpAmount == null ? { ...deal, gpPct: 50 } : deal);
      else corruptIds.push(rec.id as string);
    }
    // Teammates' pipeline rows join the shared surface as pseudo-externals.
    for (const row of rows.values()) {
      if (row.owner !== userId) externalDeals.push(rowToTeamExternal(row, names.get(row.owner) ?? "—"));
    }

    const userData = (userRes.data?.data ?? {}) as Partial<Settings>;
    const settings: Settings = {
      marginFloorPct: typeof userData.marginFloorPct === "number" ? userData.marginFloorPct : DEFAULT_SETTINGS.marginFloorPct,
      lastExportAt: typeof userData.lastExportAt === "string" ? userData.lastExportAt : null,
      signatureImage: asImageDataUrl(userData.signatureImage),
      stampImage: asImageDataUrl(userData.stampImage),
      targets: { ...DEFAULT_SETTINGS.targets, ...((teamRes.data?.targets ?? {}) as Partial<Targets>) },
    };

    return { proposals, teamProposals, externalDeals, settings, corruptIds };
  }

  /** Re-fetches shared + team data (tab focus / after own writes); own drafts stay untouched. */
  async refreshShared(): Promise<void> {
    try {
      const fresh = await SupabaseStore.fetchSnapshot(this.client, this.userId);
      // Own proposals keep the in-memory versions (they may hold unsaved edits);
      // everything shared/team refreshes.
      this.snapshot = { ...fresh, proposals: this.snapshot.proposals, corruptIds: this.snapshot.corruptIds };
      this.onRemoteRefresh?.();
    } catch {
      /* transient refresh failures are silent; next focus retries */
    }
  }

  // -------------------------------------------------------------- interface

  loadAll(): LoadResult {
    return {
      proposals: this.snapshot.proposals,
      externalDeals: this.snapshot.externalDeals,
      settings: this.snapshot.settings,
      corruptIds: this.snapshot.corruptIds,
      teamProposals: this.snapshot.teamProposals,
    };
  }

  hasPending(): boolean {
    return this.pendingCount > 0;
  }

  /** Latest-state coalescing single-flight chain per record key. */
  private enqueue(key: string, task: () => Promise<void>): void {
    this.pendingCount += 1;
    this.onStatus?.("saving");
    const tail = this.chains.get(key) ?? Promise.resolve();
    const next = tail
      .then(task)
      .then(() => {
        this.pendingCount -= 1;
        if (this.pendingCount === 0) this.onStatus?.("saved");
      })
      .catch(() => {
        this.pendingCount -= 1;
        this.onStatus?.("error");
      });
    this.chains.set(key, next);
  }

  saveProposal(proposal: Proposal, order: string[]): boolean {
    this.snapshot.proposals = order
      .map((id) => (id === proposal.id ? proposal : this.snapshot.proposals.find((x) => x.id === id)))
      .filter((x): x is Proposal => x != null);
    const sortIndex = order.indexOf(proposal.id);
    this.enqueue(proposal.id, async () => {
      // Mark-as-sent ordering: the pipeline row lands FIRST so a sent
      // proposal can never stay invisible to the team (loadAll reconciles
      // partial failures).
      const existing = await this.client.from("pipeline_rows").select("proposal_id").eq("proposal_id", proposal.id).maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (inPipeline(proposal)) {
        if (!existing.data) {
          const { error } = await this.client.from("pipeline_rows").insert({
            proposal_id: proposal.id,
            owner: this.userId,
            ...identityColumns(proposal),
            ...journeyColumns(proposal.pipeline),
          });
          if (error) throw new Error(error.message);
        } else {
          const { error } = await this.client
            .from("pipeline_rows")
            .update(identityColumns(proposal))
            .eq("proposal_id", proposal.id);
          if (error) throw new Error(error.message);
        }
      }
      const { error } = await this.client.from("proposals").upsert({
        id: proposal.id,
        owner: this.userId,
        data: stripJourney(proposal),
        sort_index: sortIndex < 0 ? 0 : sortIndex,
      });
      if (error) throw new Error(error.message);
    });
    return true;
  }

  deleteProposal(id: string, order: string[]): boolean {
    this.snapshot.proposals = this.snapshot.proposals.filter((x) => x.id !== id);
    void order;
    this.enqueue(id, async () => {
      // FK cascade removes the pipeline row.
      const { error } = await this.client.from("proposals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
    return true;
  }

  /**
   * Journey writes for OWN proposals (replaces the localStorage direct write):
   * UPDATE journey columns; clearing the stage deletes the row (membership
   * rule); setting a stage on a row-less proposal inserts the full row.
   */
  updateJourney(proposal: Proposal, patch: Partial<PipelineInfo>): void {
    this.snapshot.proposals = this.snapshot.proposals.map((x) =>
      x.id === proposal.id ? { ...x, pipeline: { ...x.pipeline, ...patch } } : x,
    );
    const merged: PipelineInfo = { ...proposal.pipeline, ...patch };
    this.enqueue(proposal.id, async () => {
      if ("stage" in patch && patch.stage === undefined) {
        const { error } = await this.client.from("pipeline_rows").delete().eq("proposal_id", proposal.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { data, error: selError } = await this.client
        .from("pipeline_rows")
        .select("proposal_id")
        .eq("proposal_id", proposal.id)
        .maybeSingle();
      if (selError) throw new Error(selError.message);
      if (!data) {
        const { error } = await this.client.from("pipeline_rows").insert({
          proposal_id: proposal.id,
          owner: this.userId,
          ...identityColumns({ ...proposal, pipeline: merged }),
          ...journeyColumns(merged),
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.client.from("pipeline_rows").update(journeyColumns(merged)).eq("proposal_id", proposal.id);
        if (error) throw new Error(error.message);
      }
    });
  }

  /** Journey writes on a TEAMMATE's row (pseudo-external or team proposal view). */
  updateTeamJourney(proposalId: string, journey: PipelineInfo): void {
    this.enqueue(`row:${proposalId}`, async () => {
      const { error } = await this.client.from("pipeline_rows").update(journeyColumns(journey)).eq("proposal_id", proposalId);
      if (error) throw new Error(error.message);
    });
  }

  replaceExternalDeals(deals: ExternalDeal[]): boolean {
    const previous = this.snapshot.externalDeals;
    this.snapshot.externalDeals = deals;
    const realNext = deals.filter((d) => !d.id.startsWith(TEAM_ROW_PREFIX));
    const realPrev = previous.filter((d) => !d.id.startsWith(TEAM_ROW_PREFIX));
    // Team pseudo rows: route changed journey fields back to pipeline_rows.
    const prevTeam = new Map(previous.filter((d) => d.id.startsWith(TEAM_ROW_PREFIX)).map((d) => [d.id, d]));
    for (const deal of deals) {
      if (!deal.id.startsWith(TEAM_ROW_PREFIX)) continue;
      const before = prevTeam.get(deal.id);
      if (before && JSON.stringify(before) !== JSON.stringify(deal)) {
        this.updateTeamJourney(deal.id.slice(TEAM_ROW_PREFIX.length), externalToJourneyPatch(deal) as PipelineInfo);
      }
    }
    // Real externals: upsert all, delete removed (import is a team-visible replace).
    const nextIds = new Set(realNext.map((d) => d.id));
    this.enqueue("externals", async () => {
      if (realNext.length > 0) {
        const { error } = await this.client
          .from("external_deals")
          .upsert(realNext.map((d) => ({ id: d.id, data: d })));
        if (error) throw new Error(error.message);
      }
      const removed = realPrev.filter((d) => !nextIds.has(d.id)).map((d) => d.id);
      if (removed.length > 0) {
        const { error } = await this.client.from("external_deals").delete().in("id", removed);
        if (error) throw new Error(error.message);
      }
    });
    return true;
  }

  deleteExternalDeal(id: string): boolean {
    if (id.startsWith(TEAM_ROW_PREFIX)) return true; // teammates' rows are not deletable here
    this.snapshot.externalDeals = this.snapshot.externalDeals.filter((d) => d.id !== id);
    this.enqueue("externals", async () => {
      const { error } = await this.client.from("external_deals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
    return true;
  }

  saveSettings(settings: Settings): boolean {
    const previousTargets = JSON.stringify(this.snapshot.settings.targets);
    this.snapshot.settings = settings;
    const { targets, ...personal } = settings;
    this.enqueue("settings", async () => {
      const { error } = await this.client
        .from("user_settings")
        .upsert({ user_id: this.userId, data: personal });
      if (error) throw new Error(error.message);
    });
    if (JSON.stringify(targets) !== previousTargets) {
      this.enqueue("team_settings", async () => {
        const { error } = await this.client.from("team_settings").update({ targets }).eq("id", SETTINGS_ROW_ID);
        if (error) throw new Error(error.message);
      });
    }
    return true;
  }

  /** Per-user copy stamps (a colleague's copy never marks rows copied for me). */
  stampCopied(rowIds: string[]): void {
    const now = new Date().toISOString();
    this.snapshot.proposals = this.snapshot.proposals.map((x) =>
      rowIds.includes(x.id) ? { ...x, pipeline: { ...x.pipeline, copiedAt: now } } : x,
    );
    this.enqueue("copies", async () => {
      const { error } = await this.client
        .from("copies")
        .upsert(rowIds.map((row_id) => ({ user_id: this.userId, row_id, copied_at: now })));
      if (error) throw new Error(error.message);
    });
  }

  exportAll(): string {
    const payload: CloudExportPayload = {
      version: 3,
      settings: this.snapshot.settings,
      proposals: this.snapshot.proposals,
      externalDeals: this.snapshot.externalDeals.filter((d) => !d.id.startsWith(TEAM_ROW_PREFIX)),
      teamProposals: this.snapshot.teamProposals.map((t) => ({ ownerName: t.ownerName, proposal: t.proposal })),
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Cloud import restores ONLY the own-proposals section + user settings.
   * The team section is backup-for-reading, never imported (importing it
   * would resurrect teammates' proposals under the importer's account).
   * Team-shared tables are never touched.
   */
  importAll(json: string): LoadResult {
    const parsed = JSON.parse(json) as Partial<CloudExportPayload>;
    if (!Array.isArray(parsed.proposals)) throw new Error("invalid payload");
    const proposals = parsed.proposals.map((p) => normalizeProposal(p));
    this.snapshot.proposals = proposals;
    proposals.forEach((p, i) => this.saveProposal(p, proposals.map((x) => x.id).slice(0, Math.max(i + 1, proposals.length))));
    if (parsed.settings) {
      this.saveSettings({
        ...this.snapshot.settings,
        marginFloorPct: parsed.settings.marginFloorPct ?? this.snapshot.settings.marginFloorPct,
        signatureImage: asImageDataUrl(parsed.settings.signatureImage),
        stampImage: asImageDataUrl(parsed.settings.stampImage),
        targets: this.snapshot.settings.targets, // team-shared: never imported
      });
    }
    return this.loadAll();
  }

  // ------------------------------------------------------- one-time migration

  /** True when this account has no cloud proposals yet (drives the migration prompt). */
  isEmpty(): boolean {
    return this.snapshot.proposals.length === 0;
  }

  teamTablesPopulated(): boolean {
    return (
      this.snapshot.externalDeals.some((d) => !d.id.startsWith(TEAM_ROW_PREFIX)) ||
      this.snapshot.settings.targets.gpTarget != null ||
      this.snapshot.settings.targets.revenueTarget != null
    );
  }

  /**
   * Pushes this browser's localStorage data into the account: each proposal
   * splits into journey-stripped data + a pipeline_rows insert. Externals and
   * targets go up only when the team tables are still empty (first importer
   * wins). Returns when every write has settled; caller refreshes.
   */
  async migrateLocal(local: LoadResult, includeTeamData: boolean): Promise<void> {
    for (let i = 0; i < local.proposals.length; i++) {
      const p = local.proposals[i];
      if (inPipeline(p)) {
        const { error } = await this.client.from("pipeline_rows").insert({
          proposal_id: p.id,
          owner: this.userId,
          ...identityColumns(p),
          ...journeyColumns(p.pipeline),
        });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message);
      }
      const { error } = await this.client
        .from("proposals")
        .upsert({ id: p.id, owner: this.userId, data: stripJourney(p), sort_index: i });
      if (error) throw new Error(error.message);
    }
    if (includeTeamData) {
      if (local.externalDeals.length > 0) {
        const { error } = await this.client
          .from("external_deals")
          .upsert(local.externalDeals.map((d) => ({ id: d.id, data: d })));
        if (error) throw new Error(error.message);
      }
      const { error } = await this.client.from("team_settings").update({ targets: local.settings.targets }).eq("id", SETTINGS_ROW_ID);
      if (error) throw new Error(error.message);
    }
    const { targets, ...personal } = local.settings;
    void targets;
    const { error } = await this.client.from("user_settings").upsert({ user_id: this.userId, data: personal });
    if (error) throw new Error(error.message);
    this.snapshot = await SupabaseStore.fetchSnapshot(this.client, this.userId);
  }
}
