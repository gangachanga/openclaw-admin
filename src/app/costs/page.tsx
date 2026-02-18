'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';
import { useI18n } from '@/i18n/provider';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';

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

const MODEL_COLORS: Record<string, string> = {
  'opus-4-6': '#a855f7',
  'opus-4-5': '#c084fc',
  'sonnet-4-5': '#3b82f6',
  'haiku-4-5': '#22c55e',
  'gpt-5': '#f97316',
  'gpt-4': '#eab308',
  'kimi': '#06b6d4',
};

function getModelColor(model: string, idx: number): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (model?.includes(key)) return color;
  }
  const fallback = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#eab308', '#06b6d4', '#ef4444', '#ec4899'];
  return fallback[idx % fallback.length];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white text-sm">
          <span style={{ color: p.color }}>●</span> ${p.value?.toFixed(4)} ({p.payload?.calls || 0} calls)
        </p>
      ))}
    </div>
  );
};

export default function CostsPage() {
  const { connected } = useAdmin();
  const { t } = useI18n();
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

  const avgDaily = data && data.daily.length > 0 ? data.total / data.daily.length : 0;
  const projected = avgDaily * 30;

  if (!connected) return <div className="p-6 text-gray-400">{t('costs.waitingSSH')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">💰 {t('costs.title')}</h1>
        <div className="flex items-center gap-3">
          <select value={days} onChange={e => setDays(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
            <option value={1}>{t('costs.today')}</option>
            <option value={3}>{t('costs.3days')}</option>
            <option value={7}>{t('costs.7days')}</option>
            <option value={14}>{t('costs.14days')}</option>
            <option value={30}>{t('costs.30days')}</option>
          </select>
          <button onClick={load} disabled={loading} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}
      {loading && !data && <div className="text-gray-400">{t('costs.calculatingCosts')}</div>}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-white">${data.total.toFixed(2)}</div>
              <div className="text-sm text-gray-400">{t('costs.total')} ({days}d)</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400">${avgDaily.toFixed(2)}</div>
              <div className="text-sm text-gray-400">{t('costs.avgPerDay')}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-400">${projected.toFixed(0)}</div>
              <div className="text-sm text-gray-400">{t('costs.monthlyProjection')}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{data.byModel.reduce((s, m) => s + m.calls, 0).toLocaleString()}</div>
              <div className="text-sm text-gray-400">{t('costs.apiCalls')}</div>
            </div>
          </div>

          {/* Daily cost area chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-white font-medium mb-4">📊 {t('costs.costPerDay')}</h2>
            {data.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.daily.map(d => ({ ...d, label: d.date.slice(5) }))}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={v => `$${v.toFixed(2)}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={2}
                    fill="url(#costGradient)" dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-500 text-sm text-center py-12">{t('costs.noData')}</div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by model - horizontal bar chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-white font-medium mb-4">🧠 {t('costs.byModel')}</h2>
              {data.byModel.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, data.byModel.length * 45)}>
                  <BarChart data={data.byModel.map(m => ({
                    ...m,
                    shortName: (m.model || 'unknown').split('/').pop() || m.model,
                  }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={v => `$${v.toFixed(2)}`} />
                    <YAxis type="category" dataKey="shortName" stroke="#9ca3af" fontSize={11} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                      {data.byModel.map((m, i) => (
                        <Cell key={m.model} fill={getModelColor(m.model, i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-gray-500 text-sm text-center py-8">{t('costs.noData')}</div>
              )}
            </div>

            {/* Cost by agent */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-white font-medium mb-4">🤖 {t('costs.byAgent')}</h2>
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
                        <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{agent.calls.toLocaleString()} llamadas</div>
                    </div>
                  );
                })}
                {data.agents.filter(a => a.total > 0).length === 0 && (
                  <div className="text-gray-500 text-sm text-center py-8">{t('costs.noData')}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
