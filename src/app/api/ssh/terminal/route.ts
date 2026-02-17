import { NextRequest, NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

export async function POST(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { command, timeout } = await req.json();
    if (!command) {
      return NextResponse.json({ error: 'command required' }, { status: 400 });
    }

    // Block dangerous commands
    const dangerous = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
    if (dangerous.some(d => command.includes(d))) {
      return NextResponse.json({ error: 'Comando bloqueado por seguridad' }, { status: 403 });
    }

    const result = await sshExec(command, timeout || 30000);
    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
