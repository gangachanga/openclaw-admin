import { NextRequest, NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

const AGENTS_BASE = '$HOME/.openclaw/agents';

export async function GET(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  const activeMinutes = parseInt(req.nextUrl.searchParams.get('activeMinutes') || '30');

  try {
    // Get agent list from config
    const configContent = await sshExec(`cat $HOME/.openclaw/openclaw.json`, 5000);
    const config = JSON.parse(configContent.stdout);
    const agentList = config?.agents?.list || [];

    const allSessions: any[] = [];

    for (const agent of agentList) {
      const safeId = agent.id.replace(/[^a-zA-Z0-9_-]/g, '');
      const dir = `${AGENTS_BASE}/${safeId}/sessions`;

      // Find sessions modified within the time window
      const result = await sshExec(
        `find ${dir} -name "*.jsonl" -mmin -${activeMinutes} -exec ls -lt {} + 2>/dev/null | head -20`,
        10000
      );

      if (!result.stdout.trim()) continue;

      const files = result.stdout.split('\n').filter(Boolean);

      for (const line of files) {
        const parts = line.trim().split(/\s+/);
        const fullPath = parts[parts.length - 1] || '';
        const filename = fullPath.split('/').pop() || '';
        const sid = filename.replace('.jsonl', '');
        if (!sid) continue;

        const size = parseInt(parts[4] || '0');

        // Get first line (session start) and last few lines (recent activity)
        const meta = await sshExec(
          `head -1 ${dir}/${sid}.jsonl 2>/dev/null; echo "---SEPARATOR---"; tail -5 ${dir}/${sid}.jsonl 2>/dev/null | grep '"role"' | tail -1; echo "---SEPARATOR---"; wc -l < ${dir}/${sid}.jsonl 2>/dev/null`,
          5000
        );

        const metaParts = meta.stdout.split('---SEPARATOR---');
        let startInfo: any = {};
        let lastMsg: any = {};
        let lineCount = 0;

        try { startInfo = JSON.parse(metaParts[0]?.trim() || '{}'); } catch {}
        try { lastMsg = JSON.parse(metaParts[1]?.trim() || '{}'); } catch {}
        try { lineCount = parseInt(metaParts[2]?.trim() || '0'); } catch {}

        // Calculate cost for this session
        const costResult = await sshExec(
          `grep '"cost"' ${dir}/${sid}.jsonl 2>/dev/null | jq -s '[.[].message.usage.cost.total // 0] | add' 2>/dev/null`,
          5000
        );
        const totalCost = parseFloat(costResult.stdout.trim()) || 0;

        allSessions.push({
          id: sid,
          agentId: safeId,
          agentName: agent.name || safeId,
          startedAt: startInfo.timestamp,
          lastActivity: lastMsg.timestamp,
          lastRole: lastMsg.message?.role,
          lastModel: lastMsg.message?.model,
          messageCount: lineCount,
          size,
          totalCost,
          isActive: size > 0,
        });
      }
    }

    // Sort by last activity
    allSessions.sort((a, b) => {
      const ta = a.lastActivity || a.startedAt || '';
      const tb = b.lastActivity || b.startedAt || '';
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ sessions: allSessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - kill/clean a session file
export async function DELETE(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { agentId, sessionId } = await req.json();
    const safeAgent = agentId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');

    await sshExec(
      `rm -f ${AGENTS_BASE}/${safeAgent}/sessions/${safeSession}.jsonl 2>/dev/null`,
      5000
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
