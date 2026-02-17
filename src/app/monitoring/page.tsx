'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '@/components/ssh-provider';

interface SessionInfo {
  id: string;
  size: number;
  lastModified: string;
  lastRole?: string;
  lastModel?: string;
  lastTimestamp?: string;
}

interface LogEntry {
  type: string;
  timestamp: string;
  message?: {
    role: string;
    content: string | { type: string; text?: string }[];
    model?: string;
    provider?: string;
    usage?: {
      input: number;
      output: number;
      cacheRead?: number;
      totalTokens: number;
      cost?: { total: number };
    };
  };
}

export default function MonitoringPage() {
  const { api, connected } = useAdmin();
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('main');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'user' | 'assistant' | 'tool'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadAgents = async () => {
    try {
      const data = await api.listAgents();
      setAgents(data.agents || []);
    } catch {}
  };

  const loadSessions = async (agentId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ssh/logs?agent=${encodeURIComponent(agentId)}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionLog = async (sessionId: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/ssh/logs?agent=${encodeURIComponent(selectedAgent)}&session=${encodeURIComponent(sessionId)}&limit=200`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = (sessionId: string) => {
    stopStreaming();
    const url = `/api/ssh/logs/stream?agent=${encodeURIComponent(selectedAgent)}&session=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);
    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        if (entry.type !== 'error') {
          setEntries(prev => [...prev, entry]);
        }
      } catch {}
    };
    es.onerror = () => {
      setStreaming(false);
    };
    eventSourceRef.current = es;
    setStreaming(true);
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
  };

  const selectSession = async (sessionId: string) => {
    stopStreaming();
    setSelectedSession(sessionId);
    await loadSessionLog(sessionId);
  };

  const runDoctor = async () => {
    try {
      setLoading(true);
      const data = await api.runDoctor();
      setDoctorOutput(data.output || 'Sin salida');
    } catch (e: any) {
      setDoctorOutput(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const restartGateway = async () => {
    if (!confirm('¿Reiniciar el Gateway?')) return;
    try {
      await api.restartGateway();
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (connected) loadAgents();
  }, [connected]);

  useEffect(() => {
    if (connected && selectedAgent) {
      setSelectedSession('');
      setEntries([]);
      stopStreaming();
      loadSessions(selectedAgent);
    }
  }, [connected, selectedAgent]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  useEffect(() => {
    return () => stopStreaming();
  }, []);

  const getContent = (entry: LogEntry): string => {
    const msg = entry.message;
    if (!msg) return '';
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .map(p => (typeof p === 'string' ? p : p.text || `[${p.type}]`))
        .join('');
    }
    return '';
  };

  const roleColor = (role?: string) => {
    switch (role) {
      case 'user': return 'text-blue-400';
      case 'assistant': return 'text-green-400';
      case 'toolResult': return 'text-purple-400';
      case 'toolCall': return 'text-yellow-400';
      case 'system': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const roleLabel = (role?: string) => {
    switch (role) {
      case 'user': return '👤 User';
      case 'assistant': return '🤖 Assistant';
      case 'toolResult': return '🔧 Tool Result';
      case 'toolCall': return '⚡ Tool Call';
      case 'system': return '⚙️ System';
      default: return role || 'unknown';
    }
  };

  const filteredEntries = entries.filter(e => {
    const role = e.message?.role;
    if (filter === 'all') return true;
    if (filter === 'user') return role === 'user';
    if (filter === 'assistant') return role === 'assistant';
    if (filter === 'tool') return role === 'toolResult' || role === 'toolCall';
    return true;
  });

  const totalCost = entries
    .filter(e => e.message?.usage?.cost?.total)
    .reduce((sum, e) => sum + (e.message!.usage!.cost!.total || 0), 0);

  const totalTokens = entries
    .filter(e => e.message?.usage?.totalTokens)
    .reduce((sum, e) => sum + (e.message!.usage!.totalTokens || 0), 0);

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📊 Monitoreo</h1>
        <div className="flex gap-2">
          <button onClick={runDoctor} disabled={loading}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm disabled:opacity-50">
            🩺 Doctor
          </button>
          <button onClick={restartGateway}
            className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded text-sm">
            🔄 Reiniciar Gateway
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}

      {doctorOutput && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-white font-medium">🩺 Doctor</h2>
            <button onClick={() => setDoctorOutput('')} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
          </div>
          <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap bg-gray-900 p-3 rounded max-h-60 overflow-y-auto">{doctorOutput}</pre>
        </div>
      )}

      {/* Agent selector */}
      <div className="flex items-center gap-3">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedAgent === agent.id
                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
            }`}
          >
            <img src={`/api/avatars/${agent.id}`} alt="" className="w-6 h-6 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {agent.name || agent.id}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sessions list */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">Sesiones recientes</h2>
          {loading && !selectedSession && <div className="text-gray-500 text-sm">Cargando...</div>}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedSession === s.id
                  ? 'bg-orange-600/20 text-orange-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <div className="font-mono text-xs truncate">{s.id.slice(0, 8)}...</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {s.lastModified} · {(s.size / 1024).toFixed(0)}KB
                {s.lastModel && <span className="ml-1 text-gray-500">· {s.lastModel}</span>}
              </div>
            </button>
          ))}
          {sessions.length === 0 && !loading && (
            <p className="text-gray-500 text-sm">Sin sesiones</p>
          )}
        </div>

        {/* Log viewer */}
        <div className="lg:col-span-3">
          {selectedSession ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-white font-medium font-mono text-sm">{selectedSession.slice(0, 12)}...</h2>
                  {totalCost > 0 && (
                    <span className="text-xs text-gray-500">
                      💰 ${totalCost.toFixed(4)} · {(totalTokens / 1000).toFixed(0)}k tokens
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Filter buttons */}
                  {(['all', 'user', 'assistant', 'tool'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`text-xs px-2 py-1 rounded ${filter === f ? 'bg-orange-600/30 text-orange-400' : 'text-gray-500 hover:text-gray-300'}`}>
                      {f === 'all' ? 'Todo' : f === 'user' ? '👤' : f === 'assistant' ? '🤖' : '🔧'}
                    </button>
                  ))}
                  {/* Stream toggle */}
                  <button
                    onClick={() => streaming ? stopStreaming() : startStreaming(selectedSession)}
                    className={`text-xs px-3 py-1 rounded ${streaming ? 'bg-green-700 text-green-200' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {streaming ? '⏸ Pausar' : '▶ En vivo'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-lg h-[60vh] overflow-y-auto p-4 space-y-2">
                {loading ? (
                  <div className="text-gray-500 text-center py-8">Cargando logs...</div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">Sin entradas</div>
                ) : (
                  filteredEntries.map((entry, i) => {
                    const role = entry.message?.role;
                    const content = getContent(entry);
                    const model = entry.message?.model;
                    const cost = entry.message?.usage?.cost?.total;
                    const tokens = entry.message?.usage?.totalTokens;
                    const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';

                    return (
                      <div key={i} className="border-b border-gray-800 pb-2">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className="text-gray-600">{ts}</span>
                          <span className={roleColor(role)}>{roleLabel(role)}</span>
                          {model && <span className="text-gray-600">· {model}</span>}
                          {cost != null && <span className="text-gray-600">· ${cost.toFixed(4)}</span>}
                          {tokens != null && <span className="text-gray-600">· {tokens.toLocaleString()} tok</span>}
                        </div>
                        {content && (
                          <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-hidden hover:max-h-none transition-all">
                            {content.slice(0, 2000)}{content.length > 2000 ? '...' : ''}
                          </pre>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-20">
              Seleccioná una sesión para ver los logs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
