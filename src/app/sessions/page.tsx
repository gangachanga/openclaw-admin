'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '@/components/ssh-provider';

interface Session {
  id: string;
  agentId: string;
  agentName: string;
  startedAt: string;
  lastActivity: string;
  lastRole: string;
  lastModel: string;
  messageCount: number;
  size: number;
  totalCost: number;
  isActive: boolean;
}

export default function SessionsPage() {
  const { connected } = useAdmin();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // minutes
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ssh/sessions?activeMinutes=${timeRange}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSessions(data.sessions || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (agentId: string, sessionId: string) => {
    if (!confirm(`¿Eliminar sesión ${sessionId.slice(0, 8)}...?`)) return;
    try {
      await fetch('/api/ssh/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, sessionId }),
      });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (connected) load();
  }, [connected, timeRange]);

  useEffect(() => {
    if (autoRefresh && connected) {
      pollRef.current = setInterval(load, 10000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [autoRefresh, connected, timeRange]);

  const timeSince = (ts: string) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  };

  const isRecent = (ts: string) => {
    if (!ts) return false;
    return Date.now() - new Date(ts).getTime() < 5 * 60 * 1000; // 5 min
  };

  const totalCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);

  // Group by agent
  const byAgent: Record<string, Session[]> = {};
  for (const s of sessions) {
    (byAgent[s.agentId] = byAgent[s.agentId] || []).push(s);
  }

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">⚡ Sesiones Activas</h1>
        <div className="flex items-center gap-3">
          <select value={timeRange} onChange={e => setTimeRange(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
            <option value={10}>Últimos 10 min</option>
            <option value={30}>Últimos 30 min</option>
            <option value={60}>Última hora</option>
            <option value={360}>Últimas 6 horas</option>
            <option value={1440}>Últimas 24 horas</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto (10s)
          </label>
          <button onClick={load} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
            🔄
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{sessions.length}</div>
          <div className="text-sm text-gray-400">Sesiones</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{sessions.filter(s => isRecent(s.lastActivity)).length}</div>
          <div className="text-sm text-gray-400">Activas ahora</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">${totalCost.toFixed(4)}</div>
          <div className="text-sm text-gray-400">Costo total</div>
        </div>
      </div>

      {loading && sessions.length === 0 && <div className="text-gray-400">Cargando...</div>}

      {/* Sessions grouped by agent */}
      {Object.entries(byAgent).map(([agentId, agentSessions]) => (
        <div key={agentId} className="space-y-3">
          <div className="flex items-center gap-3">
            <img src={`/api/avatars/${agentId}`} alt="" className="w-8 h-8 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <h2 className="text-lg font-semibold text-white">{agentSessions[0]?.agentName || agentId}</h2>
            <span className="text-sm text-gray-500">{agentSessions.length} sesiones</span>
          </div>

          <div className="space-y-2">
            {agentSessions.map(s => (
              <div key={s.id} className={`bg-gray-800 border rounded-lg p-4 flex items-center justify-between ${
                isRecent(s.lastActivity) ? 'border-green-700/50' : 'border-gray-700'
              }`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    isRecent(s.lastActivity) ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
                  }`} />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white">{s.id.slice(0, 12)}...</span>
                      {isRecent(s.lastActivity) && (
                        <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">activa</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                      <span>📊 {s.messageCount} msgs</span>
                      <span>📦 {(s.size / 1024).toFixed(0)}KB</span>
                      {s.lastModel && <span>🤖 {s.lastModel}</span>}
                      {s.totalCost > 0 && <span>💰 ${s.totalCost.toFixed(4)}</span>}
                      <span>🕐 Inicio: {s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : '?'}</span>
                      <span>📡 Última: {timeSince(s.lastActivity)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <a href={`/monitoring?agent=${s.agentId}&session=${s.id}`}
                    className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">
                    Ver logs
                  </a>
                  <button onClick={() => deleteSession(s.agentId, s.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {sessions.length === 0 && !loading && (
        <div className="text-gray-500 text-center py-12">
          No hay sesiones en los últimos {timeRange} minutos
        </div>
      )}
    </div>
  );
}
