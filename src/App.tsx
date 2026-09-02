import { I18nProvider } from "@/lib/i18n";
import { AppShell } from "@/components/app/AppShell";
import { AppToaster } from "@/components/app/AppToaster";
import { PricingScreen } from "@/features/pricing/PricingScreen";
import { AuthGate } from "@/features/pricing/cloud/AuthGate";
import { getSupabase } from "@/lib/supabase";

export default function App() {
  // Env vars present → cloud mode behind the auth gate; absent → localStorage
  // mode exactly as before accounts existed (design: accounts-supabase.md).
  const supabase = getSupabase();
  return (
    <I18nProvider>
      {supabase ? (
        <AuthGate client={supabase}>{(store) => <PricingScreen store={store} />}</AuthGate>
      ) : (
        <AppShell>
          <PricingScreen />
        </AppShell>
      )}
      <AppToaster />
    </I18nProvider>
  );
}
