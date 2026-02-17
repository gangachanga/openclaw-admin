import { NextRequest, NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

export async function GET(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') || '7');

  try {
    // Get config for agent list
    const configResult = await sshExec('cat $HOME/.openclaw/openclaw.json', 5000);
    const config = JSON.parse(configResult.stdout);
    const agents = config?.agents?.list || [];

    const result: any = { agents: [], daily: [], byModel: [], total: 0 };

    for (const agent of agents) {
      const safeId = agent.id.replace(/[^a-zA-Z0-9_-]/g, '');
      const dir = `$HOME/.openclaw/agents/${safeId}/sessions`;

      // Get cost data per agent - use find to limit to recent files
      const costData = await sshExec(
        `find ${dir} -name "*.jsonl" -mtime -${days} -exec grep -h '"cost"' {} + 2>/dev/null | jq -s '
          [.[] | select(.message.usage.cost.total > 0)] |
          {
            total: ([.[].message.usage.cost.total] | add // 0),
            count: length,
            byModel: (group_by(.message.model) | map({
              model: .[0].message.model,
              cost: ([.[].message.usage.cost.total] | add),
              calls: length
            })),
            byDay: (group_by(.timestamp | split("T")[0]) | map({
              date: .[0].timestamp | split("T")[0],
              cost: ([.[].message.usage.cost.total] | add),
              calls: length
            }))
          }
        ' 2>/dev/null`,
        60000
      );

      let parsed: any = { total: 0, count: 0, byModel: [], byDay: [] };
      try { parsed = JSON.parse(costData.stdout); } catch {}

      result.agents.push({
        id: safeId,
        name: agent.name || safeId,
        total: parsed.total || 0,
        calls: parsed.count || 0,
        byModel: parsed.byModel || [],
        byDay: parsed.byDay || [],
      });

      result.total += parsed.total || 0;

      // Merge daily data
      for (const day of (parsed.byDay || [])) {
        const existing = result.daily.find((d: any) => d.date === day.date);
        if (existing) {
          existing.cost += day.cost;
          existing.calls += day.calls;
        } else {
          result.daily.push({ ...day });
        }
      }

      // Merge model data
      for (const m of (parsed.byModel || [])) {
        const existing = result.byModel.find((x: any) => x.model === m.model);
        if (existing) {
          existing.cost += m.cost;
          existing.calls += m.calls;
        } else {
          result.byModel.push({ ...m });
        }
      }
    }

    // Sort
    result.daily.sort((a: any, b: any) => a.date.localeCompare(b.date));
    result.byModel.sort((a: any, b: any) => b.cost - a.cost);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
