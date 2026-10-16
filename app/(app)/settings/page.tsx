import { requireUser } from '@/lib/auth/session';
import { getUserSettings } from '@/lib/dal/user-settings';
import { SettingsForm } from '@/components/settings/settings-form';
import { BackupImport } from '@/components/settings/backup-import';
import { NutritionSettings } from '@/components/nutrition/nutrition-settings';
import { getMealTemplates } from '@/lib/dal/nutrition';
import Link from 'next/link';
import { ArrowUpRight, DatabaseBackup, Download, LockKeyhole, Sparkles } from 'lucide-react';

export const metadata = { title: 'Settings | LifeOS' };

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, meals] = await Promise.all([
    getUserSettings(user.id),
    getMealTemplates(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Your space
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personalise your LifeOS experience</p>
      </header>

      <SettingsForm defaultValues={settings} />
      <NutritionSettings enabled={settings.nutritionEnabled} meals={meals} />
      <section
        aria-labelledby="data-management-heading"
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      >
        <div className="android-copy-intro flex items-start gap-3 border-b px-5 py-5 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DatabaseBackup aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 id="data-management-heading" className="text-xl font-bold tracking-tight">
              Personal setup and backup
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Set up your workspace or move your LifeOS data between devices.
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 lg:gap-4 lg:p-6 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col rounded-xl border bg-muted/30 p-4 sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold">Set up LifeOS</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
              Start from an editable example and make it your own.
            </p>
            <Link
              href="/settings/life-os"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Open setup <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex min-w-0 flex-col rounded-xl border bg-muted/30 p-4 sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Download aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold">Export your data</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
              Save a JSON backup of your plans, progress, notes and reviews.
            </p>
            <a
              href="/api/export"
              download
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Download aria-hidden="true" className="h-4 w-4" /> Download backup
            </a>
          </div>

          <BackupImport />
        </div>
        <p className="flex items-start gap-2 border-t bg-muted/20 px-5 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
          <LockKeyhole aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="android-standard-copy">
            Backups include private notes and reviews. Keep the downloaded file somewhere you trust.
          </span>
          <span className="android-mobile-copy">
            Your backup contains private notes and reviews, so keep it somewhere you trust.
          </span>
        </p>
      </section>
    </div>
  );
}
