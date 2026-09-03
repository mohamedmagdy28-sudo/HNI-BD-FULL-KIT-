// Cloud-mode gate (design: docs/designs/accounts-supabase.md, APPROVED).
// Owns the auth lifecycle: login screen → async snapshot load → children.
// Also: the one-time localStorage migration prompt, the re-login modal on
// session loss (in-memory state preserved, queues resume after sign-in),
// tab-focus refresh of shared data, and the unload warning while writes are
// pending. Invite-only: no signup or reset here; the owner manages accounts
// in the Supabase dashboard.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { LocalStoragePricingStore } from "../store";
import { isDeliveryRole } from "./boq";
import { CostingWorkspace } from "./CostingWorkspace";
import { SupabaseStore, type CloudStatus } from "./supabaseStore";

type Props = {
  client: SupabaseClient;
  children: (store: SupabaseStore) => ReactNode;
};

type Phase =
  | { kind: "checking" }
  | { kind: "login"; error: string | null; busy: boolean }
  | { kind: "loading" }
  | { kind: "loadError"; message: string }
  | { kind: "migrate"; store: SupabaseStore }
  | { kind: "ready"; store: SupabaseStore };

export function AuthGate({ client, children }: Props) {
  const { t } = useI18n();
  const p = t.pricing;
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [reLogin, setReLogin] = useState(false);
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const storeRef = useRef<SupabaseStore | null>(null);

  const boot = async (userId: string) => {
    setPhase({ kind: "loading" });
    try {
      const store = await SupabaseStore.create(client, userId);
      storeRef.current = store;
      store.onStatus = setStatus;
      // Delivery roles route straight to the costing workspace: no pricing
      // app, and NEVER the migration prompt (design: boq-costing-relay.md —
      // a delivery browser's stray localStorage must not enter team tables).
      if (isDeliveryRole(store.role)) {
        setPhase({ kind: "ready", store });
        return;
      }
      // Migration prompt: first login with zero cloud proposals AND local data present.
      const local = new LocalStoragePricingStore().loadAll();
      if (store.isEmpty() && local.proposals.length > 0) setPhase({ kind: "migrate", store });
      else setPhase({ kind: "ready", store });
    } catch (err) {
      setPhase({ kind: "loadError", message: err instanceof Error ? err.message : "load failed" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) void boot(data.session.user.id);
      else setPhase({ kind: "login", error: null, busy: false });
    });
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      // Session loss mid-work: keep all in-memory state, ask to sign in again.
      if (event === "SIGNED_OUT" && storeRef.current) setReLogin(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Shared/team data refreshes when the tab regains focus (skipped mid-typing).
  useEffect(() => {
    const refresh = () => {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      void storeRef.current?.refreshShared();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Unsaved cloud writes: warn before the tab closes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (storeRef.current?.hasPending()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const signIn = async (afterReLogin: boolean) => {
    if (!afterReLogin) setPhase({ kind: "login", error: null, busy: true });
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (afterReLogin) return; // modal stays; user retries
      setPhase({ kind: "login", error: p.authError, busy: false });
      return;
    }
    setPassword("");
    if (afterReLogin) {
      setReLogin(false);
      return; // store + state intact; queues resume on next write
    }
    if (data.session?.user) void boot(data.session.user.id);
  };

  const signOut = () => {
    storeRef.current = null;
    setReLogin(false);
    void client.auth.signOut();
    setPhase({ kind: "login", error: null, busy: false });
  };

  if (phase.kind === "checking" || phase.kind === "loading") {
    return (
      <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3" data-testid="cloud-loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hni-magenta border-t-transparent" aria-hidden />
        <p className="text-[13px] text-hni-grey-dark">{p.authLoading}</p>
      </div>
      </AppShell>
    );
  }

  if (phase.kind === "loadError") {
    return (
      <AppShell>
      <div className="mx-auto mt-16 max-w-sm rounded-lg border border-line-1 bg-surface-0 p-5 text-center" data-testid="cloud-load-error">
        <p className="text-[13.5px] font-medium text-hni-black">{p.authLoadError}</p>
        <p className="mt-1 break-all text-[12px] text-hni-grey-dark">{phase.message}</p>
        <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>
          {p.authRetry}
        </Button>
      </div>
      </AppShell>
    );
  }

  if (phase.kind === "login") {
    return (
      <AppShell>
      <div className="mx-auto mt-16 w-full max-w-sm rounded-lg border border-line-1 bg-surface-0 p-5" data-testid="login-screen">
        <h2 className="text-[16px] font-semibold text-hni-black">{p.authTitle}</h2>
        <p className="mt-1 text-[12.5px] text-hni-grey-dark">{p.authSubtitle}</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void signIn(false);
          }}
        >
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.authEmail}</span>
            <Input type="email" required autoComplete="email" value={email} data-testid="auth-email" onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.authPassword}</span>
            <Input type="password" required autoComplete="current-password" value={password} data-testid="auth-password" onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </label>
          {phase.error && <p className="text-[12.5px] text-[color:var(--status-danger-fg)]" data-testid="auth-error">{phase.error}</p>}
          <Button type="submit" className="w-full" disabled={phase.busy} data-testid="auth-submit">
            {phase.busy ? p.authSigningIn : p.authSignIn}
          </Button>
        </form>
      </div>
      </AppShell>
    );
  }

  if (phase.kind === "migrate") {
    return (
      <AppShell>
      <div className="mx-auto mt-16 w-full max-w-md rounded-lg border border-line-1 bg-surface-0 p-5" data-testid="migrate-prompt">
        <h2 className="text-[16px] font-semibold text-hni-black">{p.migrateTitle}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-hni-grey-dark">
          {phase.store.teamTablesPopulated() ? p.migrateBodyTeamExists : p.migrateBody}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            data-testid="migrate-confirm"
            onClick={() => {
              const local = new LocalStoragePricingStore().loadAll();
              const includeTeam = !phase.store.teamTablesPopulated();
              setPhase({ kind: "loading" });
              phase.store
                .migrateLocal(local, includeTeam)
                .then(() => setPhase({ kind: "ready", store: phase.store }))
                .catch((err) => setPhase({ kind: "loadError", message: err instanceof Error ? err.message : "migration failed" }));
            }}
          >
            {p.migrateConfirm}
          </Button>
          <Button variant="outline" data-testid="migrate-skip" onClick={() => setPhase({ kind: "ready", store: phase.store })}>
            {p.migrateSkip}
          </Button>
        </div>
      </div>
      </AppShell>
    );
  }

  const header = (
    <div className="flex items-center gap-2">
      {status && (
        <span
          className="text-[11.5px] text-hni-grey-mid"
          data-testid="cloud-status"
          style={status === "error" ? { color: "var(--status-danger-fg)" } : undefined}
        >
          {status === "saving" ? p.cloudSaving : status === "error" ? p.cloudSaveError : p.cloudSaved}
        </span>
      )}
      <Button variant="ghost" size="sm" data-testid="sign-out" onClick={signOut}>
        <LogOut className="size-4" aria-hidden />
        {p.authSignOut}
      </Button>
    </div>
  );

  return (
    <AppShell headerExtra={header}>
      {isDeliveryRole(phase.store.role) ? <CostingWorkspace store={phase.store} /> : children(phase.store)}
      {reLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="relogin-modal">
          <div className="w-full max-w-sm rounded-lg border border-line-1 bg-surface-0 p-5">
            <h2 className="text-[15px] font-semibold text-hni-black">{p.authSessionExpired}</h2>
            <p className="mt-1 text-[12.5px] text-hni-grey-dark">{p.authSessionExpiredBody}</p>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void signIn(true);
              }}
            >
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={p.authEmail} />
              <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={p.authPassword} />
              <Button type="submit" className="w-full">
                {p.authSignIn}
              </Button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
