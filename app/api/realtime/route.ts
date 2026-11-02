import { getCurrentUser } from '@/lib/auth/session';
import { changeHub } from '@/lib/realtime/change-hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (process.env.HABITFLOW_EMBEDDED_DB === '1') {
    return new Response('Real-time cloud updates are unavailable locally.', { status: 404 });
  }

  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let closed = false;
  const timers: {
    heartbeat?: ReturnType<typeof setInterval>;
    expiry?: ReturnType<typeof setTimeout>;
  } = {};
  let unsubscribe: (() => void) | undefined;

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
    unsubscribe?.();
    try {
      streamController?.close();
    } catch {
      // The client can cancel while the stream is shutting down.
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
    unsubscribe = await changeHub.subscribe(user.id, {
      change: (payload) => send(`event: change\ndata: ${payload}\n\n`),
      resync: () => send('event: resync\ndata: {}\n\n'),
    });
  } catch (error) {
    console.error('Could not open real-time listener:', error);
    return new Response('Real-time updates unavailable', { status: 503 });
  }
  // The client may have left while the shared listener was connecting.
  if (request.signal.aborted) {
    void close();
    return new Response(null, { status: 204 });
  }

  request.signal.addEventListener('abort', onAbort, { once: true });
  timers.heartbeat = setInterval(() => send(': keep-alive\n\n'), 25_000);
  timers.expiry = setTimeout(() => void close(), 240_000);
  send(': connected\n\n');
  // A reconnecting client may have missed changes while it had no stream.
  send('event: resync\ndata: {}\n\n');

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
