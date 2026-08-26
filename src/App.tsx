import { I18nProvider, useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/app/AppShell";
import { AppToaster } from "@/components/app/AppToaster";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/States";

// Placeholder screen. Replace with the first feature screen under src/features/<screen>/
// following the feature workflow in CLAUDE.md.
function PlaceholderScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t.home.title} subtitle={t.home.subtitle} />
      <EmptyState title={t.home.empty.title} body={t.home.empty.body} />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell>
        <PlaceholderScreen />
      </AppShell>
      <AppToaster />
    </I18nProvider>
  );
}
