'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '@/components/ssh-provider';
import { useI18n } from '@/i18n/provider';

interface HealthCheck {
  name: string;
  icon: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export default function Dashboard() {
  const { connected, status, error, refreshStatus } = useAdmin();
  const { t } = useI18n();
  const [health, setHealth] = useState<{ checks: HealthCheck[]; overall: string; timestamp: string } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [activity, setActivity] = useState<{ timestamp: string; type: string; message: string }[]>([]);
  const activityRef = useRef<HTMLDivElement>(null);

  const loadHealth = async () => {
    try {
      setHealthLoading(true);
      const res = await fetch('/api/ssh/health');
      const data = await res.json();
      if (!data.error) setHealth(data);
    } catch {} finally {
      setHealthLoading(false);
    }
  };

  const loadActivity = async () => {
    try {
      const res = await fetch('/api/ssh/activity');
      const data = await res.json();
      if (data.events) setActivity(data.events);
    } catch {}
  };

  useEffect(() => {
    if (connected) { loadHealth(); loadActivity(); }
  }, [connected]);

  // Auto-refresh health every 60s, activity every 15s
  useEffect(() => {
    if (!connected) return;
    const healthInterval = setInterval(loadHealth, 60000);
    const activityInterval = setInterval(loadActivity, 15000);
    return () => { clearInterval(healthInterval); clearInterval(activityInterval); };
  }, [connected]);

  const activityTypeStyle = (type: string) => {
    switch (type) {
      case 'message': return { dot: 'bg-green-500', text: 'text-green-400', label: '💬' };
      case 'cron': return { dot: 'bg-yellow-500', text: 'text-yellow-400', label: '⏰' };
      case 'error': return { dot: 'bg-red-500', text: 'text-red-400', label: '❌' };
      case 'session': return { dot: 'bg-blue-500', text: 'text-blue-400', label: '⚡' };
      case 'channel': return { dot: 'bg-cyan-500', text: 'text-cyan-400', label: '📡' };
      default: return { dot: 'bg-gray-500', text: 'text-gray-400', label: '🔧' };
    }
  };

  const statusColor = (s: string) => {
    if (s === 'ok') return 'text-green-400';
    if (s === 'warning') return 'text-yellow-400';
    return 'text-red-400';
  };

  const statusDot = (s: string) => {
    if (s === 'ok') return 'bg-green-500';
    if (s === 'warning') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const overallLabel = (s: string) => {
    if (s === 'ok') return { text: t('home.operationalAll'), color: 'text-green-400', bg: 'bg-green-900/30 border-green-800' };
    if (s === 'warning') return { text: t('home.warnings'), color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800' };
    return { text: t('home.hasErrors'), color: 'text-red-400', bg: 'bg-red-900/30 border-red-800' };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🦞 {t('home.title')}</h1>
        <div className="flex gap-2">
          <button onClick={loadHealth} disabled={healthLoading}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm disabled:opacity-50">
            {healthLoading ? '...' : `🔄 ${t('home.healthCheck')}`}
          </button>
          <button onClick={() => refreshStatus()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">
            {t('home.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          <strong>{t('home.error')}:</strong> {error}
        </div>
      )}

      {!connected && !error && (
        <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
          {t('home.connectingSSH')}
        </div>
      )}

      {connected && (
        <div className="space-y-6">
          {/* Overall health banner */}
          {health && (
            <div className={`p-4 rounded-lg border ${overallLabel(health.overall).bg} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${statusDot(health.overall)} ${health.overall === 'ok' ? '' : 'animate-pulse'}`} />
                <span className={`text-lg font-semibold ${overallLabel(health.overall).color}`}>
                  {overallLabel(health.overall).text}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {t('home.lastCheck')}: {health.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '?'}
              </span>
            </div>
          )}

          {/* Health checks grid */}
          {health && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {health.checks.map((check, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{check.icon}</span>
                    <span className="text-sm text-white font-medium">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusDot(check.status)}`} />
                    <span className={`text-xs ${statusColor(check.status)}`}>
                      {check.status === 'ok' ? '✓' : check.status === 'warning' ? '⚠' : '✗'}
                    </span>
                    <span className="text-xs text-gray-400 truncate">{check.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gateway status */}
          {status && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">{t('home.gatewayStatus')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-xs">{t('home.state')}</p>
                  <p className={`font-medium ${status.state === 'running' || status.state === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {status.state || 'unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.version')}</p>
                  <p className="text-white">{status.version || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.uptime')}</p>
                  <p className="text-white">{status.uptime || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.primaryModel')}</p>
                  <p className="text-white text-sm">{status.model || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.pid')}</p>
                  <p className="text-white">{status.pid || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.memory')}</p>
                  <p className="text-white">{status.memory || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.cpu')}</p>
                  <p className="text-white">{status.cpu || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('home.network')}</p>
                  <p className="text-white">{status.bind || '?'}:{status.port || '?'} · {status.agents || 0} {t('home.agents')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-medium">📡 {t('home.recentActivity')}</h2>
              <button onClick={loadActivity} className="text-xs text-gray-400 hover:text-white">🔄</button>
            </div>
            <div ref={activityRef} className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
              {activity.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">{t('home.noRecentActivity')}</p>
              ) : activity.map((evt, i) => {
                const style = activityTypeStyle(evt.type);
                return (
                  <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-gray-700/50 text-sm">
                    <span className="flex-shrink-0 mt-0.5">{style.label}</span>
                    <span className="text-gray-500 flex-shrink-0 text-xs mt-0.5 w-16">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    <span className={`${style.text} truncate`}>{evt.message}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/agents', icon: '🤖', label: t('sidebar.agents'), desc: t('home.configureAgents'), color: 'blue' },
              { href: '/sessions', icon: '⚡', label: t('sidebar.sessions'), desc: t('home.activeSessions'), color: 'yellow' },
              { href: '/costs', icon: '💰', label: t('sidebar.costs'), desc: t('home.costsDashboard'), color: 'green' },
              { href: '/cron', icon: '⏰', label: t('sidebar.cron'), desc: t('home.scheduledJobs'), color: 'purple' },
              { href: '/knowledge', icon: '📚', label: t('sidebar.knowledge'), desc: t('home.workspaceFiles'), color: 'orange' },
              { href: '/config', icon: '⚙️', label: t('sidebar.config'), desc: t('home.configuration'), color: 'gray' },
              { href: '/monitoring', icon: '📊', label: t('sidebar.monitoring'), desc: t('home.monitoringLogs'), color: 'pink' },
              { href: '/terminal', icon: '🖥️', label: t('sidebar.terminal'), desc: t('home.sshTerminal'), color: 'red' },
            ].map(link => {
              const colors: Record<string, string> = {
                blue: 'hover:bg-blue-600 hover:border-blue-500 hover:shadow-blue-500/20',
                green: 'hover:bg-green-600 hover:border-green-500 hover:shadow-green-500/20',
                purple: 'hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20',
                orange: 'hover:bg-orange-600 hover:border-orange-500 hover:shadow-orange-500/20',
                yellow: 'hover:bg-yellow-600 hover:border-yellow-500 hover:shadow-yellow-500/20',
                gray: 'hover:bg-gray-600 hover:border-gray-500 hover:shadow-gray-500/20',
                pink: 'hover:bg-pink-600 hover:border-pink-500 hover:shadow-pink-500/20',
                red: 'hover:bg-red-600 hover:border-red-500 hover:shadow-red-500/20',
              };
              return (
                <a key={link.href} href={link.href}
                  className={`bg-gray-800 border border-gray-600 rounded-xl p-4 
                    transition-all duration-200 ease-out
                    hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5
                    active:scale-[0.98] active:translate-y-0
                    cursor-pointer flex flex-col items-center text-center gap-2
                    ${colors[link.color]}`}>
                  <span className="text-3xl drop-shadow-sm">{link.icon}</span>
                  <h3 className="text-white font-semibold">{link.label}</h3>
                  <p className="text-xs text-gray-400 group-hover:text-gray-200">{link.desc}</p>
                </a>
              );
            })}
          </div>

          {/* Raw Status */}
          {status?.raw && (
            <details className="bg-gray-800 rounded-lg border border-gray-700">
              <summary className="p-4 text-white font-medium cursor-pointer hover:bg-gray-700/50">
                📋 {t('home.statusRaw')}
              </summary>
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono bg-gray-900 p-4 mx-4 mb-4 rounded">
                {status.raw}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
