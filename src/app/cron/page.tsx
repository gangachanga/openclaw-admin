'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';

export default function CronPage() {
  const { api, connected } = useAdmin();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [viewingRuns, setViewingRuns] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'errors'>('all');
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.listCronJobs();
      const list = data.jobs;
      setJobs(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (connected) load(); }, [connected]);

  const run = async (jobId: string, jobName: string) => {
    try {
      setSuccess(`Ejecutando "${jobName}"...`);
      const result = await api.runCronJob(jobId);
      setRunOutput(result.output || 'Ejecutado');
      setViewingRuns(jobId);
      setSuccess(`"${jobName}" ejecutado`);
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggle = async (jobId: string) => {
    try {
      await api.toggleCronJob(jobId);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (jobId: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await api.deleteCronJob(jobId);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const save = async () => {
    if (!editing) return;
    try {
      if (editing._isNew) {
        const { _isNew, ...job } = editing;
        await api.createCronJob(job);
      } else {
        await api.updateCronJob(editing);
      }
      setEditing(null);
      setSuccess('Guardado');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const timeSince = (ms: number) => {
    if (!ms) return 'nunca';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  };

  const timeUntil = (ms: number) => {
    if (!ms) return '';
    const diff = ms - Date.now();
    if (diff < 0) return 'pendiente';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `en ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `en ${hrs}h ${mins % 60}m`;
    return `en ${Math.floor(hrs / 24)}d`;
  };

  const statusBadge = (state: any, enabled: boolean) => {
    if (!enabled) return { color: 'bg-gray-700 text-gray-400', label: 'Inactivo' };
    if (!state?.lastStatus) return { color: 'bg-blue-900 text-blue-300', label: 'Sin ejecutar' };
    if (state.consecutiveErrors > 0) return { color: 'bg-red-900 text-red-300', label: `Error (${state.consecutiveErrors}x)` };
    if (state.lastStatus === 'ok') return { color: 'bg-green-900 text-green-300', label: 'OK' };
    return { color: 'bg-yellow-900 text-yellow-300', label: state.lastStatus };
  };

  const scheduleLabel = (schedule: any) => {
    if (!schedule) return '?';
    if (schedule.kind === 'cron') return `${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ''}`;
    if (schedule.kind === 'every') {
      const ms = schedule.everyMs;
      if (ms >= 3600000) return `cada ${ms / 3600000}h`;
      if (ms >= 60000) return `cada ${ms / 60000}m`;
      return `cada ${ms / 1000}s`;
    }
    if (schedule.kind === 'at') return `una vez: ${new Date(schedule.at).toLocaleString()}`;
    return JSON.stringify(schedule);
  };

  const filtered = jobs.filter(j => {
    if (filter === 'active') return j.enabled;
    if (filter === 'inactive') return !j.enabled;
    if (filter === 'errors') return j.state?.consecutiveErrors > 0;
    return true;
  });

  // Stats
  const activeCount = jobs.filter(j => j.enabled).length;
  const errorCount = jobs.filter(j => j.state?.consecutiveErrors > 0).length;

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">⏰ Cron Jobs</h1>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">🔄</button>
          <button onClick={() => setEditing({
            _isNew: true, name: '', enabled: true,
            sessionTarget: 'isolated', agentId: 'main',
            schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'America/Chicago' },
            payload: { kind: 'agentTurn', message: '' },
            delivery: { mode: 'none' },
          })}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">
            + Nuevo Job
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}<button onClick={() => setError('')} className="ml-2 text-red-400">✕</button></div>}
      {success && <div className="p-3 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm">{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <button onClick={() => setFilter('all')} className={`bg-gray-800 border rounded-lg p-3 text-left ${filter === 'all' ? 'border-orange-500' : 'border-gray-700'}`}>
          <div className="text-2xl font-bold text-white">{jobs.length}</div>
          <div className="text-xs text-gray-400">Total</div>
        </button>
        <button onClick={() => setFilter('active')} className={`bg-gray-800 border rounded-lg p-3 text-left ${filter === 'active' ? 'border-orange-500' : 'border-gray-700'}`}>
          <div className="text-2xl font-bold text-green-400">{activeCount}</div>
          <div className="text-xs text-gray-400">Activos</div>
        </button>
        <button onClick={() => setFilter('inactive')} className={`bg-gray-800 border rounded-lg p-3 text-left ${filter === 'inactive' ? 'border-orange-500' : 'border-gray-700'}`}>
          <div className="text-2xl font-bold text-gray-400">{jobs.length - activeCount}</div>
          <div className="text-xs text-gray-400">Inactivos</div>
        </button>
        <button onClick={() => setFilter('errors')} className={`bg-gray-800 border rounded-lg p-3 text-left ${filter === 'errors' ? 'border-orange-500' : 'border-gray-700'}`}>
          <div className="text-2xl font-bold text-red-400">{errorCount}</div>
          <div className="text-xs text-gray-400">Con errores</div>
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">Cargando...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job: any) => {
            const badge = statusBadge(job.state, job.enabled);
            return (
              <div key={job.id} className={`bg-gray-800 border rounded-lg p-4 ${
                job.state?.consecutiveErrors > 0 ? 'border-red-800/50' : 'border-gray-700'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-medium">{job.name || job.id}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                      {job.agentId && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <img src={`/api/avatars/${job.agentId}`} alt="" className="w-4 h-4 rounded-full inline"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          {job.agentId}
                        </span>
                      )}
                    </div>

                    {/* Schedule */}
                    <div className="text-xs text-gray-400 mt-1.5 flex gap-3 flex-wrap">
                      <span>📅 {scheduleLabel(job.schedule)}</span>
                      <span>🎯 {job.sessionTarget || '?'}</span>
                      {job.payload?.kind && <span>📦 {job.payload.kind}</span>}
                    </div>

                    {/* State info */}
                    {job.state && (
                      <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                        {job.state.lastRunAtMs > 0 && (
                          <span>🕐 Última: {timeSince(job.state.lastRunAtMs)}</span>
                        )}
                        {job.state.lastDurationMs > 0 && (
                          <span>⏱ {(job.state.lastDurationMs / 1000).toFixed(1)}s</span>
                        )}
                        {job.state.nextRunAtMs > 0 && job.enabled && (
                          <span>⏭ Próxima: {timeUntil(job.state.nextRunAtMs)}</span>
                        )}
                      </div>
                    )}

                    {/* Prompt preview */}
                    {job.payload?.message && (
                      <div className="mt-2">
                        <button onClick={() => setExpandedPrompt(expandedPrompt === job.id ? null : job.id)}
                          className="text-xs text-gray-500 hover:text-gray-300 italic">
                          {expandedPrompt === job.id ? '▼' : '▶'} "{job.payload.message.slice(0, 80)}{job.payload.message.length > 80 ? '...' : ''}"
                        </button>
                        {expandedPrompt === job.id && (
                          <pre className="mt-1 text-xs text-gray-400 bg-gray-900 p-2 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {job.payload.message}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-3 pt-2 border-t border-gray-700/50">
                  <button onClick={() => run(job.id, job.name || job.id)} className="text-xs text-orange-400 hover:text-orange-300">▶ Ejecutar</button>
                  <button onClick={() => toggle(job.id)} className="text-xs text-blue-400 hover:text-blue-300">
                    {job.enabled ? '⏸ Pausar' : '▶ Activar'}
                  </button>
                  <button onClick={() => setEditing({ ...job })} className="text-xs text-blue-400 hover:text-blue-300">✏️ Editar</button>
                  <button onClick={() => remove(job.id, job.name || job.id)} className="text-xs text-red-400 hover:text-red-300">🗑 Eliminar</button>
                </div>

                {/* Run output */}
                {viewingRuns === job.id && runOutput && (
                  <div className="mt-3 bg-gray-900 rounded p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">Último output</span>
                      <button onClick={() => setViewingRuns(null)} className="text-xs text-gray-500">✕</button>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{runOutput}</pre>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-gray-500 text-center py-8">No hay jobs que coincidan con el filtro</p>}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-4">{editing._isNew ? 'Nuevo Job' : 'Editar Job'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Nombre</label>
                <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Agente</label>
                  <input value={editing.agentId || ''} onChange={e => setEditing({ ...editing, agentId: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" placeholder="main" />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Session Target</label>
                  <select value={editing.sessionTarget || 'isolated'} onChange={e => setEditing({ ...editing, sessionTarget: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                    <option value="isolated">Isolated</option>
                    <option value="main">Main</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Schedule Kind</label>
                  <select value={editing.schedule?.kind || 'cron'} onChange={e => setEditing({ ...editing, schedule: { ...editing.schedule, kind: e.target.value } })}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                    <option value="cron">Cron</option>
                    <option value="every">Interval</option>
                    <option value="at">At (una vez)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">
                    {editing.schedule?.kind === 'cron' ? 'Expresión cron' : editing.schedule?.kind === 'every' ? 'Intervalo (ms)' : 'Fecha/hora'}
                  </label>
                  <input value={editing.schedule?.expr || editing.schedule?.everyMs || editing.schedule?.at || ''}
                    onChange={e => {
                      const k = editing.schedule?.kind;
                      const val = e.target.value;
                      if (k === 'cron') setEditing({ ...editing, schedule: { ...editing.schedule, expr: val } });
                      else if (k === 'every') setEditing({ ...editing, schedule: { ...editing.schedule, everyMs: parseInt(val) || 0 } });
                      else setEditing({ ...editing, schedule: { ...editing.schedule, at: val } });
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    placeholder={editing.schedule?.kind === 'cron' ? '0 9 * * *' : editing.schedule?.kind === 'every' ? '3600000' : '2026-02-17T09:00:00'} />
                </div>
              </div>
              {editing.schedule?.kind === 'cron' && (
                <div>
                  <label className="text-sm text-gray-400">Timezone</label>
                  <input value={editing.schedule?.tz || ''} onChange={e => setEditing({ ...editing, schedule: { ...editing.schedule, tz: e.target.value } })}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" placeholder="America/Chicago" />
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400">Payload Kind</label>
                <select value={editing.payload?.kind || 'agentTurn'} onChange={e => setEditing({ ...editing, payload: { ...editing.payload, kind: e.target.value } })}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                  <option value="agentTurn">Agent Turn</option>
                  <option value="systemEvent">System Event</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400">{editing.payload?.kind === 'systemEvent' ? 'Texto del evento' : 'Prompt'}</label>
                <textarea value={editing.payload?.message || editing.payload?.text || ''}
                  onChange={e => {
                    const field = editing.payload?.kind === 'systemEvent' ? 'text' : 'message';
                    setEditing({ ...editing, payload: { ...editing.payload, [field]: e.target.value } });
                  }}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm h-32 font-mono" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.enabled ?? true}
                  onChange={e => setEditing({ ...editing, enabled: e.target.checked })} />
                <label className="text-sm text-gray-400">Habilitado</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={save} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
