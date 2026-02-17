import { NextResponse } from 'next/server';
import { sshExec, isSSHConfigured } from '@/lib/ssh-client';

export async function POST(req: Request) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { path, name } = await req.json();
    
    if (!path || !name) {
      return NextResponse.json({ error: 'Path and name required' }, { status: 400 });
    }

    // Safety: only allow removing from skills directories
    if (!path.includes('/skills/')) {
      return NextResponse.json({ 
        error: 'Invalid path: can only remove from skills directories' 
      }, { status: 400 });
    }

    // Verify the path exists and is a directory
    const check = await sshExec(`test -d "${path}" && echo 'exists' || echo 'missing'`);
    if (check.stdout.trim() !== 'exists') {
      return NextResponse.json({ 
        error: `Skill "${name}" not found` 
      }, { status: 404 });
    }

    // Remove the directory
    const result = await sshExec(`rm -rf "${path}" 2>&1`);
    
    if (result.stderr && result.code !== 0) {
      throw new Error(result.stderr);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Skill "${name}" uninstalled successfully` 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
