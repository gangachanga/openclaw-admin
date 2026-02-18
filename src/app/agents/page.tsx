'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';
import { useI18n } from '@/i18n/provider';
import { OPENCLAW_TOOLS } from '@/lib/types';

interface AgentForm {
  id: string;
  name: string;
  model: string;
  workspace: string;
  tools: { allow: string[]; deny: string[] };
  subagents: { allowAgents: string[] };
  sandbox: { mode: string; scope: string };
}

const emptyForm: AgentForm = {
  id: '', name: '', model: '', workspace: '',
  tools: { allow: [], deny: [] },
  subagents: { allowAgents: [] },
  sandbox: { mode: 'off', scope: 'session' },
};

interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export default function AgentsPage() {
  const { api, connected } = useAdmin();
  const { t } = useI18n();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentForm | null>(null);
  const [error, setError] = useState('');
  const [models, setModels] = useState<{ primaryModel: string; builtin: ModelOption[]; custom: ModelOption[]; aliases: any[] }>({ primaryModel: '', builtin: [], custom: [], aliases: [] });

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.listAgents();
      setAgents(data.agents || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetch('/api/ssh/models');
      const data = await res.json();
      if (data.builtin) setModels(data);
    } catch {}
  };

  useEffect(() => { if (connected) { load(); loadModels(); } }, [connected]);

  const save = async () => {
    if (!editing) return;
    try {
      console.log('Saving agent:', JSON.stringify(editing, null, 2));
      await api.updateAgent(editing);
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('agents.deleteConfirm').replace('%s', id))) return;
    try {
      await api.deleteAgent(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggleTool = (list: 'allow' | 'deny', tool: string) => {
    if (!editing) return;
    const current = editing.tools[list];
    const updated = current.includes(tool) ? current.filter(t => t !== tool) : [...current, tool];
    setEditing({ ...editing, tools: { ...editing.tools, [list]: updated } });
  };

  if (!connected) return <div className="p-6 text-gray-400">{t('agents.waitingSSH')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🤖 {t('agents.title')}</h1>
        <button onClick={() => setEditing({ ...emptyForm })} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">
          + {t('agents.newAgent')}
        </button>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-400">{t('agents.loading')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: any) => (
            <div key={agent.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <img
                    src={`/api/avatars/${agent.id}`}
                    alt={agent.name || agent.id}
                    className="w-10 h-10 rounded-full object-cover border border-gray-600"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div>
                    <h3 className="text-white font-medium">{agent.name || agent.id}</h3>
                    <p className="text-gray-400 text-xs">{agent.id}</p>
                  </div>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-3">{t('agents.model')}: {agent.model || 'default'}</p>
              <div className="flex gap-2">
                <button onClick={() => setEditing({ ...emptyForm, ...agent, tools: { allow: [], deny: [], ...agent.tools }, subagents: { allowAgents: [], ...agent.subagents }, sandbox: { mode: 'off', scope: 'session', ...agent.sandbox } })} className="text-xs text-blue-400 hover:text-blue-300">
                  {t('agents.edit')}
                </button>
                <button onClick={() => remove(agent.id)} className="text-xs text-red-400 hover:text-red-300">
                  {t('agents.delete')}
                </button>
              </div>
            </div>
          ))}
          {agents.length === 0 && <p className="text-gray-500 col-span-full">{t('agents.noAgents')}</p>}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">{editing.id ? t('agents.editAgent') : t('agents.newAgent')}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">{t('agents.id')}</label>
                  <input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-gray-400">{t('agents.name')}</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-gray-400">{t('agents.model')}</label>
                  <select value={editing.model || ''} onChange={e => {
                    console.log('Model selected:', e.target.value);
                    setEditing({ ...editing, model: e.target.value });
                  }} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                    <option value="">{t('agents.noOverride')} ({models.primaryModel || t('agents.systemDefault')})</option>
                    {models.aliases.length > 0 && (
                      <optgroup label={`⚡ ${t('agents.aliases')}`}>
                        {models.aliases.map(a => (
                          <option key={a.id} value={a.id}>{a.name} → {a.resolves}</option>
                        ))}
                      </optgroup>
                    )}
                    {(() => {
                      const grouped: Record<string, ModelOption[]> = {};
                      for (const m of models.builtin) {
                        (grouped[m.provider] = grouped[m.provider] || []).push(m);
                      }
                      return Object.entries(grouped).map(([provider, ms]) => (
                        <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                          {ms.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </optgroup>
                      ));
                    })()}
                    {models.custom.length > 0 && (
                      <optgroup label={`🔧 ${t('agents.custom')}`}>
                        {models.custom.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">{t('agents.workspace')}</label>
                  <input value={editing.workspace} onChange={e => setEditing({ ...editing, workspace: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">{t('agents.toolsAllow')}</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {OPENCLAW_TOOLS.map(tool => (
                    <button key={tool} onClick={() => toggleTool('allow', tool)}
                      className={`text-xs px-2 py-1 rounded ${editing.tools.allow.includes(tool) ? 'bg-green-800 text-green-200' : 'bg-gray-700 text-gray-400'}`}>
                      {tool}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">{t('agents.toolsDeny')}</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {OPENCLAW_TOOLS.map(tool => (
                    <button key={tool} onClick={() => toggleTool('deny', tool)}
                      className={`text-xs px-2 py-1 rounded ${editing.tools.deny.includes(tool) ? 'bg-red-800 text-red-200' : 'bg-gray-700 text-gray-400'}`}>
                      {tool}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">{t('agents.sandboxMode')}</label>
                <select value={editing.sandbox.mode} onChange={e => setEditing({ ...editing, sandbox: { ...editing.sandbox, mode: e.target.value } })}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                  <option value="off">Off</option>
                  <option value="non-main">Non-Main</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">{t('agents.cancel')}</button>
              <button onClick={save} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">{t('agents.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
