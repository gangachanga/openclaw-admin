import { NextRequest, NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

const AGENTS_BASE = '$HOME/.openclaw/agents';

export async function GET(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  const agentId = req.nextUrl.searchParams.get('agent') || 'main';
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100');
  const sessionId = req.nextUrl.searchParams.get('session');

  // Sanitize inputs to prevent injection
  const safeAgent = agentId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeSession = sessionId?.replace(/[^a-zA-Z0-9_-]/g, '') || '';

  try {
    const sessionsDir = `${AGENTS_BASE}/${safeAgent}/sessions`;

    if (safeSession) {
      // Read specific session log
      const result = await sshExec(
        `tail -n ${limit} ${sessionsDir}/${safeSession}.jsonl 2>/dev/null`,
        15000
      );
      const lines = result.stdout.split('\n').filter(Boolean);
      const entries = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);

      return NextResponse.json({ entries, sessionId: safeSession });
    }

    // List recent sessions for this agent
    const result = await sshExec(
      `ls -lt ${sessionsDir}/*.jsonl 2>/dev/null | head -20`,
      10000
    );
    const sessions = result.stdout.split('\n').filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/);
      const fullPath = parts[parts.length - 1] || '';
      const filename = fullPath.split('/').pop() || '';
      const id = filename.replace('.jsonl', '');
      const size = parseInt(parts[4] || '0');
      const dateStr = `${parts[5]} ${parts[6]} ${parts[7]}`;
      return { id, size, lastModified: dateStr, filename };
    }).filter(s => s.id);

    // For each session, get the last entry to show a preview
    const previews = await Promise.all(
      sessions.slice(0, 10).map(async (s) => {
        try {
          const lastLine = await sshExec(
            `tail -5 ${sessionsDir}/${s.id}.jsonl 2>/dev/null | grep '"role"' | tail -1`,
            5000
          );
          if (lastLine.stdout) {
            const entry = JSON.parse(lastLine.stdout);
            return {
              ...s,
              lastRole: entry.message?.role,
              lastModel: entry.message?.model,
              lastTimestamp: entry.timestamp,
            };
          }
        } catch {}
        return s;
      })
    );

    return NextResponse.json({ sessions: previews, agentId: safeAgent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
