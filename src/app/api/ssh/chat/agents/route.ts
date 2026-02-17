import { NextResponse } from 'next/server';
import { sshReadFile, isSSHConfigured } from '@/lib/ssh-client';

export async function GET() {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const content = await sshReadFile('~/.openclaw/openclaw.json');
    const config = JSON.parse(content);
    const agents = (config?.agents?.list || []).map((a: any) => ({
      id: a.id,
      name: a.name || a.id,
      model: a.model || 'default',
    }));
    return NextResponse.json({ agents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
