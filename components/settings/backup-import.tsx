'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileJson2, Loader2, Upload } from 'lucide-react';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export function BackupImport() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<{ exportedAt: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function selectFile(selected: File | undefined) {
    setFile(null);
    setSummary(null);
    setError(null);
    setSuccess(null);
    if (!selected) return;
    if (selected.size > MAX_BACKUP_BYTES) {
      setError('Choose a backup smaller than 25 MB.');
      return;
    }
    try {
      const data: unknown = JSON.parse(await selected.text());
      if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error();
      const backup = data as Record<string, unknown>;
      if (
        (backup.schemaVersion !== 1 && backup.schemaVersion !== 2) ||
        typeof backup.exportedAt !== 'string' ||
        !Number.isFinite(Date.parse(backup.exportedAt))
      )
        throw new Error();
      const count = Object.values(backup).reduce<number>(
        (total, value) => total + (Array.isArray(value) ? value.length : 0),
        0,
      );
      setFile(selected);
      setSummary({ exportedAt: new Date(backup.exportedAt).toLocaleString(), count });
    } catch {
      setError('This does not look like a LifeOS backup file.');
    }
  }

  async function importFile() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: file,
      });
      const result = (await response.json()) as { error?: string; importedRecords?: number };
      if (!response.ok) throw new Error(result.error || 'Import failed.');
      setSuccess(`Restored ${result.importedRecords} records. Your data is ready to use.`);
      setFile(null);
      setSummary(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Import failed. Your existing data was kept.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-col rounded-xl border bg-muted/30 p-4 sm:p-5 md:col-span-2 xl:col-span-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Upload aria-hidden="true" className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-base font-semibold">Restore a backup</h3>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
          Continue here with a LifeOS backup from another device.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          {file ? 'Choose another file' : 'Choose backup file'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          tabIndex={-1}
          disabled={busy}
          onClick={(event) => {
            event.currentTarget.value = '';
          }}
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </div>

      {file && summary && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100 sm:p-5 md:col-span-2 xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <FileJson2 aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs opacity-80">
                  Exported {summary.exportedAt} · {summary.count} records
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setSummary(null);
                setError(null);
              }}
              className="text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 border-t border-amber-300/70 pt-4 dark:border-amber-700/70">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">This will replace your current LifeOS data</p>
              <p className="mt-1 leading-relaxed opacity-85">
                Habits, check-ins, meals, plans, settings, notes and reviews will be replaced. Your
                sign-in stays the same. Download a backup of this device first if you need to keep
                its data.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void importFile()}
            disabled={busy}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
          >
            {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {busy ? 'Restoring backup…' : 'Replace data and restore'}
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive md:col-span-2 xl:col-span-3"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 md:col-span-2 xl:col-span-3"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          {success}
        </p>
      )}
    </>
  );
}
