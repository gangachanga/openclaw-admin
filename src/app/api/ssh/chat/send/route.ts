import { NextRequest, NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

export async function POST(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { agentId, message } = await req.json();
    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId and message required' }, { status: 400 });
    }

    // Escape message for shell
    const escaped = message.replace(/'/g, "'\\''");
    const cmd = `openclaw send --agent ${agentId} '${escaped}' 2>&1`;

    const result = await sshExec(cmd, 120000); // 2 min timeout for LLM response
    const output = (result.stdout || '').trim();

    return NextResponse.json({
      response: output || '(sin respuesta)',
      agentId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
