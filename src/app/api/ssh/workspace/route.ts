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

    if (file) {
      // Read specific file
      const content = await sshReadFile(`${wsPath}/${file}`);
      const statResult = await sshExec(`stat -c '%s %Y' "${wsPath}/${file}" 2>/dev/null || echo "0 0"`);
      const [size, mtime] = statResult.stdout.split(' ');
      return NextResponse.json({
        name: file,
        path: `${wsPath}/${file}`,
        content,
        size: parseInt(size || '0'),
        lastModified: parseInt(mtime || '0') * 1000,
      });
    }

    // List all workspace files
    const result = await sshExec(`ls -la ${wsPath}/*.md 2>/dev/null; ls -la ${wsPath}/*.txt 2>/dev/null || true`);
    const files = result.stdout
      .split('\n')
      .filter((line) => line.includes('.md') || line.includes('.txt'))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const name = parts[parts.length - 1]?.split('/').pop() || '';
        return { name, path: `${wsPath}/${name}` };
      })
      .filter((f) => f.name);

    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const { file, content, agent: agentId } = await req.json();
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

    await sshWriteFile(`${wsPath}/${file}`, content);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
