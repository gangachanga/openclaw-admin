import { NextResponse } from 'next/server';
import { sshExec, sshReadFile, isSSHConfigured } from '@/lib/ssh-client';

export async function GET() {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    // Get version
    const versionResult = await sshExec('openclaw --version 2>/dev/null', 5000);
    const version = versionResult.stdout.trim() || 'unknown';

    // Get gateway process info
    const procResult = await sshExec(
      "ps -p $(pgrep -f openclaw-gateway 2>/dev/null | head -1 || echo 1) -o pid,etimes,rss,pcpu --no-headers 2>/dev/null",
      5000
    );
    let pid = '', uptime = '', memMB = '', cpu = '';
    if (procResult.stdout.trim()) {
      const parts = procResult.stdout.trim().split(/\s+/);
      pid = parts[0] || '';
      const secs = parseInt(parts[1] || '0');
      const hrs = Math.floor(secs / 3600);
      const mins = Math.floor((secs % 3600) / 60);
      uptime = hrs > 24 ? `${Math.floor(hrs / 24)}d ${hrs % 24}h` : `${hrs}h ${mins}m`;
      memMB = ((parseInt(parts[2] || '0') / 1024)).toFixed(0) + 'MB';
      cpu = (parts[3] || '0') + '%';
    }

    // Get model from config
    const configContent = await sshReadFile('$HOME/.openclaw/openclaw.json');
    const config = JSON.parse(configContent);
    const primaryModel = config?.agents?.defaults?.model?.primary || 'unknown';
    const agentCount = config?.agents?.list?.length || 0;

    // Gateway status text
    const statusResult = await sshExec('openclaw gateway status 2>&1', 10000);
    const raw = statusResult.stdout;

    // Parse bind/port from raw
    const bindMatch = raw.match(/bind=(\w+)/);
    const portMatch = raw.match(/port=(\d+)/);
    const runtimeMatch = raw.match(/running \(pid (\d+),.*state (\w+)/);

    const status = {
      version,
      pid: pid || runtimeMatch?.[1] || '?',
      uptime: uptime || 'N/A',
      memory: memMB || 'N/A',
      cpu: cpu || 'N/A',
      model: primaryModel,
      agents: agentCount,
      bind: bindMatch?.[1] || '?',
      port: portMatch?.[1] || config?.gateway?.port || '?',
      state: runtimeMatch?.[2] || (pid ? 'running' : 'unknown'),
      raw,
    };

    return NextResponse.json({ status, connected: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, connected: false }, { status: 500 });
  }
}
