'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';

interface AgentCost {
  id: string;
  name: string;
  total: number;
  calls: number;
  byModel: { model: string; cost: number; calls: number }[];
  byDay: { date: string; cost: number; calls: number }[];
}

interface CostData {
  agents: AgentCost[];
  daily: { date: string; cost: number; calls: number }[];
  byModel: { model: string; cost: number; calls: number }[];
  total: number;
}

export default function CostsPage() {
  const { connected } = useAdmin();
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ssh/costs?days=${days}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (connected) load(); }, [connected, days]);

  const maxDailyCost = data ? Math.max(...data.daily.map(d => d.cost), 0.01) : 1;
  const maxModelCost = data ? Math.max(...data.byModel.map(m => m.cost), 0.01) : 1;

  const avgDaily = data && data.daily.length > 0 ? data.total / data.daily.length : 0;
  const projected = avgDaily * 30;

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">💰 Costos</h1>
        <div className="flex items-center gap-3">
          <select value={days} onChange={e => setDays(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
            <option value={1}>Hoy</option>
            <option value={3}>3 días</option>
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>
          <button onClick={load} disabled={loading} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}

      {loading && !data && <div className="text-gray-400">Calculando costos (puede tardar unos segundos)...</div>}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-white">${data.total.toFixed(2)}</div>
              <div className="text-sm text-gray-400">Total ({days}d)</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400">${avgDaily.toFixed(2)}</div>
              <div className="text-sm text-gray-400">Promedio/día</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-400">${projected.toFixed(0)}</div>
              <div className="text-sm text-gray-400">Proyección mensual</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{data.byModel.reduce((s, m) => s + m.calls, 0).toLocaleString()}</div>
              <div className="text-sm text-gray-400">Llamadas API</div>
            </div>
          </div>

          {/* Daily bar chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-white font-medium mb-4">📊 Costo por día</h2>
            <div className="flex items-end gap-1 h-40">
              {data.daily.map(day => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-400">${day.cost.toFixed(2)}</span>
                  <div
                    className="w-full bg-orange-500/70 rounded-t hover:bg-orange-400/70 transition-colors"
                    style={{ height: `${(day.cost / maxDailyCost) * 100}%`, minHeight: '2px' }}
                    title={`${day.date}: $${day.cost.toFixed(4)} (${day.calls} calls)`}
                  />
                  <span className="text-xs text-gray-500 -rotate-45 origin-center whitespace-nowrap">
                    {day.date.slice(5)}
                  </span>
                </div>
              ))}
              {data.daily.length === 0 && <div className="text-gray-500 text-sm w-full text-center">Sin datos</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by agent */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-white font-medium mb-4">🤖 Por agente</h2>
              <div className="space-y-3">
                {data.agents.filter(a => a.total > 0).sort((a, b) => b.total - a.total).map(agent => {
                  const pct = data.total > 0 ? (agent.total / data.total) * 100 : 0;
                  return (
                    <div key={agent.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <img src={`/api/avatars/${agent.id}`} alt="" className="w-5 h-5 rounded-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span className="text-white">{agent.name}</span>
                        </div>
                        <span className="text-gray-400">${agent.total.toFixed(2)} <span className="text-gray-600">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{agent.calls.toLocaleString()} llamadas</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost by model */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-white font-medium mb-4">🧠 Por modelo</h2>
              <div className="space-y-3">
                {data.byModel.map(m => {
                  const pct = data.total > 0 ? (m.cost / data.total) * 100 : 0;
                  const colors: Record<string, string> = {
                    'claude-opus-4-6': 'bg-purple-500',
                    'claude-opus-4-5': 'bg-purple-400',
                    'claude-sonnet-4-5': 'bg-blue-500',
                    'claude-haiku-4-5': 'bg-green-500',
                  };
                  const barColor = Object.entries(colors).find(([k]) => m.model?.includes(k))?.[1] || 'bg-gray-500';
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-white">{m.model || 'unknown'}</span>
                        <span className="text-gray-400">${m.cost.toFixed(2)} <span className="text-gray-600">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{m.calls.toLocaleString()} llamadas</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
