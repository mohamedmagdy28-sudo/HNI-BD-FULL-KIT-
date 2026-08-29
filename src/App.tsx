import { I18nProvider } from "@/lib/i18n";
import { AppShell } from "@/components/app/AppShell";
import { AppToaster } from "@/components/app/AppToaster";
import { PricingScreen } from "@/features/pricing/PricingScreen";

export default function App() {
  return (
    <I18nProvider>
      <AppShell>
        <PricingScreen />
      </AppShell>
      <AppToaster />
    </I18nProvider>
  );
}
