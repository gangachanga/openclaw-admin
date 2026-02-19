import { NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

interface ActivityEvent {
  timestamp: string;
  type: 'message' | 'cron' | 'error' | 'session' | 'system' | 'channel';
  message: string;
}

export async function GET() {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    // Build activity feed from whichever OpenClaw log file exists on the remote host.
    // We intentionally avoid assuming uid=1000 or UTC date boundaries.
    const cmd = [
      'set -e',
      // Prefer latest daily log from /tmp/openclaw-*/openclaw-YYYY-MM-DD.log
      "daily=$(ls -1t /tmp/openclaw-*/openclaw-*.log 2>/dev/null | head -1 || true)",
      // Fallbacks used by some deployments
      "fallback1=\"$HOME/.openclaw/logs/gateway.log\"",
      "fallback2=\"$HOME/.openclaw/openclaw.log\"",
      'if [ -n "$daily" ]; then target="$daily";',
      'elif [ -f "$fallback1" ]; then target="$fallback1";',
      'elif [ -f "$fallback2" ]; then target="$fallback2";',
      'else target=""; fi',
      'if [ -n "$target" ]; then tail -n 200 "$target"; fi',
    ].join('; ');

    const result = await sshExec(cmd, 8000);
    const lines = result.stdout.split('\n').filter(Boolean);

    const events: ActivityEvent[] = [];

    for (const line of lines) {
      // Try to parse timestamp from beginning of line
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
      const timestamp = tsMatch ? tsMatch[1] : '';

      let type: ActivityEvent['type'] = 'system';
      let message = line;

      // Remove timestamp prefix for cleaner display
      if (tsMatch) {
        message = line.slice(tsMatch[0].length).replace(/^[\s.Z+\-\d]*/, '').trim();
      }

      // Classify
      const lower = line.toLowerCase();
      if (lower.includes('error') || lower.includes('fail') || lower.includes('crash') || lower.includes('uncaught')) {
        type = 'error';
      } else if (lower.includes('cron') || lower.includes('scheduled') || lower.includes('job ')) {
        type = 'cron';
      } else if (lower.includes('session') || lower.includes('agent') || lower.includes('spawn')) {
        type = 'session';
      } else if (lower.includes('message') || lower.includes('reply') || lower.includes('send') || lower.includes('inbound')) {
        type = 'message';
      } else if (lower.includes('whatsapp') || lower.includes('telegram') || lower.includes('discord') || lower.includes('connect') || lower.includes('disconnect')) {
        type = 'channel';
      }

      if (message.length > 0 && message.length < 500) {
        events.push({ timestamp, type, message });
      }
    }

    // Return last 50 most recent
    return NextResponse.json({ events: events.slice(-50).reverse() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
