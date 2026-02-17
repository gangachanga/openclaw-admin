import { NextRequest, NextResponse } from 'next/server';
import { sshReadFile, sshWriteFile, sshExec, isSSHConfigured } from '@/lib/ssh-client';

const CONFIG_PATH = '~/.openclaw/openclaw.json';

export async function GET() {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const content = await sshReadFile(CONFIG_PATH);
    const config = JSON.parse(content);
    const agents = config?.agents?.list || [];
    const defaults = config?.agents?.defaults || {};
    return NextResponse.json({ agents, defaults });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { agent } = await req.json();
    const content = await sshReadFile(CONFIG_PATH);
    const config = JSON.parse(content);

    if (!config.agents) config.agents = { list: [] };
    if (!config.agents.list) config.agents.list = [];

    // Only keep fields that OpenClaw actually accepts
    const VALID_KEYS = new Set([
      'id', 'name', 'default', 'model', 'workspace', 'agentDir',
      'tools', 'subagents', 'sandbox', 'containerTag', 'thinking',
      'reasoningEffort', 'systemPrompt', 'maxTurns',
    ]);
    const VALID_SUBAGENT_KEYS = new Set(['allowAgents']);
    const VALID_SANDBOX_KEYS = new Set(['mode', 'scope']);
    const VALID_TOOLS_KEYS = new Set(['allow', 'deny']);

    // Sanitize the agent object
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(agent)) {
      if (!VALID_KEYS.has(k)) continue;
      if (v === '' || v === null || v === undefined) continue;
      if (k === 'subagents' && typeof v === 'object') {
        const sub: Record<string, any> = {};
        for (const [sk, sv] of Object.entries(v as any)) {
          if (VALID_SUBAGENT_KEYS.has(sk)) sub[sk] = sv;
        }
        if (Object.keys(sub).length > 0) clean[k] = sub;
      } else if (k === 'sandbox' && typeof v === 'object') {
        const sb: Record<string, any> = {};
        for (const [sk, sv] of Object.entries(v as any)) {
          if (VALID_SANDBOX_KEYS.has(sk)) sb[sk] = sv;
        }
        if (Object.keys(sb).length > 0) clean[k] = sb;
      } else if (k === 'tools' && typeof v === 'object') {
        const t: Record<string, any> = {};
        for (const [tk, tv] of Object.entries(v as any)) {
          if (VALID_TOOLS_KEYS.has(tk)) t[tk] = tv;
        }
        if (Object.keys(t).length > 0) clean[k] = t;
      } else {
        clean[k] = v;
      }
    }

    // Preserve fields from existing config that the UI doesn't manage
    const idx = config.agents.list.findIndex((a: any) => a.id === clean.id);
    if (idx >= 0) {
      const existing = config.agents.list[idx];
      config.agents.list[idx] = { ...existing, ...clean };
    } else {
      config.agents.list.push(clean);
    }

    await sshWriteFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    await sshExec('openclaw gateway restart 2>&1');

    return NextResponse.json({ ok: true, agent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { id } = await req.json();
    const content = await sshReadFile(CONFIG_PATH);
    const config = JSON.parse(content);

    if (config.agents?.list) {
      config.agents.list = config.agents.list.filter((a: any) => a.id !== id);
    }

    await sshWriteFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    await sshExec('openclaw gateway restart 2>&1');

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
