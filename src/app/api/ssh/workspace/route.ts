import { NextRequest, NextResponse } from 'next/server';
import { sshExec, sshReadFile, sshWriteFile, isSSHConfigured } from '@/lib/ssh-client';

const DEFAULT_WORKSPACE = '~/.openclaw/workspace';
const CONFIG_PATH = '~/.openclaw/openclaw.json';

export async function GET(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  const file = req.nextUrl.searchParams.get('file');
  const agentId = req.nextUrl.searchParams.get('agent');
  const subdir = req.nextUrl.searchParams.get('subdir') || ''; // e.g., 'memory'

  try {
    // Resolve workspace path from agent config
    let wsPath = DEFAULT_WORKSPACE;
    if (agentId) {
      const configContent = await sshReadFile(CONFIG_PATH);
      const config = JSON.parse(configContent);
      const agent = config?.agents?.list?.find((a: any) => a.id === agentId);
      if (agent?.workspace) {
        wsPath = agent.workspace;
      }
    }

    // Append subdirectory if specified
    const fullPath = subdir ? `${wsPath}/${subdir}` : wsPath;

    if (file) {
      // Read specific file
      const content = await sshReadFile(`${fullPath}/${file}`);
      const statResult = await sshExec(`stat -c '%s %Y' "${fullPath}/${file}" 2>/dev/null || echo "0 0"`);
      const [size, mtime] = statResult.stdout.split(' ');
      return NextResponse.json({
        name: file,
        path: `${fullPath}/${file}`,
        content,
        size: parseInt(size || '0'),
        lastModified: parseInt(mtime || '0') * 1000,
      });
    }

    // List all files in the directory
    const result = await sshExec(`ls -la ${fullPath}/ 2>/dev/null | tail -n +2 || true`);
    const files = result.stdout
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('total'))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const isDir = line.startsWith('d');
        const name = parts[parts.length - 1] || '';
        return { name, isDir, path: `${fullPath}/${name}` };
      })
      .filter((f) => f.name && f.name !== '.' && f.name !== '..');

    return NextResponse.json({ files, subdir });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { file, content, agent: agentId, subdir } = await req.json();
    if (!file || content === undefined) {
      return NextResponse.json({ error: 'file and content required' }, { status: 400 });
    }

    // Resolve workspace path from agent config
    let wsPath = DEFAULT_WORKSPACE;
    if (agentId) {
      const configContent = await sshReadFile(CONFIG_PATH);
      const config = JSON.parse(configContent);
      const agent = config?.agents?.list?.find((a: any) => a.id === agentId);
      if (agent?.workspace) {
        wsPath = agent.workspace;
      }
    }

    const fullPath = subdir ? `${wsPath}/${subdir}` : wsPath;
    await sshWriteFile(`${fullPath}/${file}`, content);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
