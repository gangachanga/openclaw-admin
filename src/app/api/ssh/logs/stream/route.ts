import { NextRequest } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

const AGENTS_BASE = '$HOME/.openclaw/agents';

// SSE endpoint that polls for new log entries
export async function GET(req: NextRequest) {
  if (!isSSHConfigured()) {
    return new Response('SSH not configured', { status: 400 });
  }

  const agentId = req.nextUrl.searchParams.get('agent') || 'main';
  const sessionId = req.nextUrl.searchParams.get('session');

  if (!sessionId) {
    return new Response('session required', { status: 400 });
  }

  const safeAgent = agentId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sessionsDir = `${AGENTS_BASE}/${safeAgent}/sessions`;
  const filePath = `${sessionsDir}/${safeSession}.jsonl`;

  const encoder = new TextEncoder();
  let lastLineCount = 0;
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Get initial line count
      try {
        const wc = await sshExec(`wc -l < "${filePath}" 2>/dev/null || echo 0`, 5000);
        lastLineCount = parseInt(wc.stdout.trim()) || 0;
      } catch {}

      const poll = async () => {
        if (aborted) return;
        try {
          const wc = await sshExec(`wc -l < "${filePath}" 2>/dev/null || echo 0`, 5000);
          const currentCount = parseInt(wc.stdout.trim()) || 0;

          if (currentCount > lastLineCount) {
            const newLines = currentCount - lastLineCount;
            const result = await sshExec(
              `tail -n ${newLines} "${filePath}" 2>/dev/null`,
              10000
            );
            const lines = result.stdout.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
              } catch {}
            }
            lastLineCount = currentCount;
          }

          // Send heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`));
        }

        if (!aborted) {
          setTimeout(poll, 2000);
        }
      };

      poll();
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
