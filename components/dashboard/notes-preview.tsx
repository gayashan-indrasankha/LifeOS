import Link from 'next/link';
import { ArrowUpRight, NotebookPen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function NotesPreview({ content }: { content: string }) {
  return (
    <Card className="analytics-card">
      <div className="analytics-band flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wide">
        <span>Journal</span>
        <NotebookPen className="h-4 w-4" aria-hidden="true" />
      </div>
      <CardContent className="space-y-3">
        {content.trim() ? (
          <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {content}
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Capture a thought, a feeling, or a small win from today.
          </p>
        )}
        <Link
          href={content.trim() ? '/notes' : '/today?finish=1#finish-your-day'}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:text-xs"
        >
          {content.trim() ? 'Read journal' : 'Write today’s entry'}{' '}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
