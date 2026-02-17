import { NextRequest, NextResponse } from 'next/server';
import { sshExec, sshReadFile, isSSHConfigured } from '@/lib/ssh-client';

export async function GET() {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const checks: any[] = [];

    // 1. Gateway process
    const gw = await sshExec("pgrep -f openclaw-gateway 2>/dev/null || pgrep -f 'openclaw.*gateway' 2>/dev/null", 5000);
    const gwPid = gw.stdout.trim().split('\n')[0];
    checks.push({
      name: 'Gateway',
      icon: '🦞',
      status: gwPid ? 'ok' : 'error',
      detail: gwPid ? `PID ${gwPid}` : 'No está corriendo',
    });

    // 2. Uptime & load
    const uptime = await sshExec('uptime -p 2>/dev/null; cat /proc/loadavg 2>/dev/null', 5000);
    const lines = uptime.stdout.split('\n');
    const load = lines[1]?.split(' ')[0] || '?';
    checks.push({
      name: 'Sistema',
      icon: '💻',
      status: parseFloat(load) > 4 ? 'warning' : 'ok',
      detail: `${lines[0] || '?'} · Load: ${load}`,
    });

    // 3. Memory
    const mem = await sshExec("free -m | awk '/Mem:/ {printf \"%d/%dMB (%.0f%%)\", $3, $2, $3/$2*100}'", 5000);
    const memPct = parseInt(mem.stdout.match(/\((\d+)%\)/)?.[1] || '0');
    checks.push({
      name: 'Memoria',
      icon: '🧠',
      status: memPct > 90 ? 'error' : memPct > 75 ? 'warning' : 'ok',
      detail: mem.stdout,
    });

    // 4. Disk
    const disk = await sshExec("df -h / | awk 'NR==2 {printf \"%s/%s (%s)\", $3, $2, $5}'", 5000);
    const diskPct = parseInt(disk.stdout.match(/\((\d+)%\)/)?.[1] || '0');
    checks.push({
      name: 'Disco',
      icon: '💾',
      status: diskPct > 90 ? 'error' : diskPct > 80 ? 'warning' : 'ok',
      detail: disk.stdout,
    });

    // 5. Telegram bots - ping each
    const configContent = await sshReadFile('$HOME/.openclaw/openclaw.json');
    const config = JSON.parse(configContent);
    const accounts = config?.channels?.telegram?.accounts || {};
    for (const [name, acc] of Object.entries(accounts) as any) {
      if (acc.enabled === false) continue;
      try {
        const res = await fetch(`https://api.telegram.org/bot${acc.botToken}/getMe`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        checks.push({
          name: `Telegram: ${name}`,
          icon: '📱',
          status: data.ok ? 'ok' : 'error',
          detail: data.ok ? `@${data.result.username}` : 'No responde',
        });
      } catch {
        checks.push({
          name: `Telegram: ${name}`,
          icon: '📱',
          status: 'error',
          detail: 'Timeout / no alcanzable',
        });
      }
    }

    // 6. WhatsApp
    if (config?.channels?.whatsapp?.enabled !== false) {
      const waCheck = await sshExec('ls $HOME/.openclaw/credentials/whatsapp/default/session-*.json 2>/dev/null | head -1', 5000);
      checks.push({
        name: 'WhatsApp',
        icon: '💬',
        status: waCheck.stdout ? 'ok' : 'warning',
        detail: waCheck.stdout ? 'Sesión activa' : 'Sin sesión detectada',
      });
    }

    // 7. Cron health
    const cronContent = await sshReadFile('$HOME/.openclaw/cron/jobs.json');
    const cronData = JSON.parse(cronContent);
    const jobs = cronData.jobs || [];
    const errorJobs = jobs.filter((j: any) => j.enabled && j.state?.consecutiveErrors > 0);
    checks.push({
      name: 'Cron Jobs',
      icon: '⏰',
      status: errorJobs.length > 0 ? 'warning' : 'ok',
      detail: errorJobs.length > 0
        ? `${errorJobs.length} con errores: ${errorJobs.map((j: any) => j.name || j.id).join(', ')}`
        : `${jobs.filter((j: any) => j.enabled).length} activos, sin errores`,
    });

    // 8. SSH latency (self-test)
    const latStart = Date.now();
    await sshExec('echo ok', 3000);
    const latency = Date.now() - latStart;
    checks.push({
      name: 'SSH Latencia',
      icon: '🔗',
      status: latency > 2000 ? 'warning' : 'ok',
      detail: `${latency}ms`,
    });

    const overall = checks.some(c => c.status === 'error') ? 'error'
      : checks.some(c => c.status === 'warning') ? 'warning' : 'ok';

    return NextResponse.json({ checks, overall, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
