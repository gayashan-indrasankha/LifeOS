'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LifeActionState } from '@/lib/actions/life-actions';

export function ActionForm({
  action,
  children,
  className = '',
  submitLabel = 'Save',
  submitAriaLabel,
  previewAction,
  previewLabel = 'Check conflicts',
  showSuccess = true,
  successConfirmation,
  buttonVariant = 'primary',
  submitDisabled = false,
}: {
  action: (state: LifeActionState, form: FormData) => Promise<LifeActionState>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  submitAriaLabel?: string;
  previewAction?: (state: LifeActionState, form: FormData) => Promise<LifeActionState>;
  previewLabel?: string;
  showSuccess?: boolean;
  successConfirmation?: string;
  buttonVariant?: 'primary' | 'secondary' | 'danger';
  submitDisabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [previewState, setPreviewState] = useState<LifeActionState | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [changedSinceSubmit, setChangedSinceSubmit] = useState(false);
  const [dismissedSuccess, setDismissedSuccess] = useState<LifeActionState | null>(null);
  useEffect(() => {
    if (!successConfirmation || !state.success) return;
    const timeout = window.setTimeout(() => setDismissedSuccess(state), 3000);
    return () => window.clearTimeout(timeout);
  }, [state, successConfirmation]);
  async function preview() {
    if (!previewAction || !formRef.current) return;
    if (!formRef.current.reportValidity()) return;
    setPreviewPending(true);
    try {
      setPreviewState(await previewAction({}, new FormData(formRef.current)));
    } catch {
      setPreviewState({ error: 'Could not check conflicts. Try again.' });
    } finally {
      setPreviewPending(false);
    }
  }
  const submitButton = (
    <button
      type="submit"
      aria-label={submitAriaLabel}
      disabled={pending || submitDisabled}
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${successConfirmation ? 'min-w-32' : ''} ${buttonVariant === 'secondary' ? 'border border-border bg-background text-foreground hover:bg-muted' : buttonVariant === 'danger' ? 'bg-destructive text-destructive-foreground hover:opacity-90' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
    >
      {pending ? 'Saving…' : submitLabel}
    </button>
  );
  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onChange={() => {
        setPreviewState(null);
        setChangedSinceSubmit(true);
      }}
      onSubmit={() => {
        setPreviewState(null);
        setChangedSinceSubmit(false);
      }}
    >
      {children}
      {previewState?.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {previewState.error}
        </p>
      )}
      {previewState?.success && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {previewState.success}
        </p>
      )}
      {state.error && !changedSinceSubmit && !pending && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && !changedSinceSubmit && !pending && (
        <p
          role="status"
          className={showSuccess ? 'text-sm text-emerald-700 dark:text-emerald-300' : 'sr-only'}
        >
          {state.success}
        </p>
      )}
      {successConfirmation ? (
        <div className="col-span-full flex flex-wrap items-center justify-end gap-3">
          {state.success && dismissedSuccess !== state && !pending && (
            <span
              aria-hidden="true"
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary"
            >
              <span aria-hidden="true">✓</span>
              {successConfirmation}
            </span>
          )}
          {submitButton}
        </div>
      ) : (
        submitButton
      )}
      {previewAction && (
        <button
          type="button"
          disabled={pending || previewPending}
          onClick={preview}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
        >
          {previewPending ? 'Checking…' : previewLabel}
        </button>
      )}
    </form>
  );
}
