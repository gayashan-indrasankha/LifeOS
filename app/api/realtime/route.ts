import postgres from 'postgres';
import { getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function directDatabaseUrl() {
  const value = process.env.REALTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) throw new Error('A database URL is required for real-time updates.');
  const url = new URL(value);
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, '');
  return url.toString();
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (process.env.HABITFLOW_EMBEDDED_DB === '1') {
    return new Response('Real-time cloud updates are unavailable locally.', { status: 404 });
  }

  const sql = postgres(directDatabaseUrl(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 0,
  });
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let closed = false;
  const timers: {
    heartbeat?: ReturnType<typeof setInterval>;
    expiry?: ReturnType<typeof setTimeout>;
  } = {};
  let unlisten: (() => Promise<void>) | undefined;

  const send = (message: string) => {
    if (closed || !streamController) return;
    try {
      streamController.enqueue(encoder.encode(message));
    } catch {
      void close();
    }
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    if (timers.heartbeat) clearInterval(timers.heartbeat);
    if (timers.expiry) clearTimeout(timers.expiry);
    request.signal.removeEventListener('abort', onAbort);
    try {
      await unlisten?.();
    } finally {
      await sql.end();
      try {
        streamController?.close();
      } catch {
        // The client can cancel while the listener is shutting down.
      }
    }
  };
  const onAbort = () => void close();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
    cancel() {
      void close();
    },
  });

  try {
    const listener = await sql.listen(
      'lifeos_changes',
      (payload) => {
        try {
          const change = JSON.parse(payload) as { userId?: string };
          if (change.userId === user.id) send(`event: change\ndata: ${payload}\n\n`);
        } catch {
          // Ignore malformed notifications instead of closing a healthy stream.
        }
      },
      () => send('event: resync\ndata: {}\n\n'),
    );
    unlisten = listener.unlisten;
  } catch (error) {
    console.error('Could not open real-time listener:', error);
    await sql.end();
    return new Response('Real-time updates unavailable', { status: 503 });
  }

  request.signal.addEventListener('abort', onAbort, { once: true });
  timers.heartbeat = setInterval(() => send(': keep-alive\n\n'), 25_000);
  timers.expiry = setTimeout(() => void close(), 240_000);
  send(': connected\n\n');

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
