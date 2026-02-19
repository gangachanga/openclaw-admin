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
  bindingChannel: string;
  bindingAccountId: string;
}

const emptyForm: AgentForm = {
  id: '', name: '', model: '', workspace: '',
  tools: { allow: [], deny: [] },
  subagents: { allowAgents: [] },
  sandbox: { mode: 'off', scope: 'session' },
  bindingChannel: 'telegram',
  bindingAccountId: '',
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
  const [fullConfig, setFullConfig] = useState<any>(null);

  const [mdFile, setMdFile] = useState('AGENTS.md');
  const [mdContent, setMdContent] = useState('');
  const [mdLoading, setMdLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [agentsData, configData] = await Promise.all([
        api.listAgents(),
        api.getConfig(),
      ]);
      setAgents(agentsData.agents || []);
      setFullConfig(configData.config || {});
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


  const telegramAccounts = Object.keys(fullConfig?.channels?.telegram?.accounts || {});

  const findBindingForAgent = (agentId: string) => {
    const bindings = fullConfig?.bindings || [];
    return bindings.find((b: any) => b?.agentId === agentId);
  };

  const loadMdFile = async (agentId: string, file: string) => {
    try {
      setMdLoading(true);
      const data = await api.readWorkspaceFile(file, agentId);
      setMdContent(data.content || '');
    } catch (e: any) {
      setMdContent('');
      setError(e.message || `No se pudo leer ${file}`);
    } finally {
      setMdLoading(false);
    }
  };

  const openEditor = async (agent: any) => {
    const binding = findBindingForAgent(agent.id);
    const form = {
      ...emptyForm,
      ...agent,
      tools: { allow: [], deny: [], ...agent.tools },
      subagents: { allowAgents: [], ...agent.subagents },
      sandbox: { mode: 'off', scope: 'session', ...agent.sandbox },
      bindingChannel: binding?.match?.channel || 'telegram',
      bindingAccountId: binding?.match?.accountId || '',
    };
    setEditing(form);
    setMdFile('AGENTS.md');
    await loadMdFile(agent.id, 'AGENTS.md');
  };

  const save = async () => {
    if (!editing) return;
    try {
      await api.updateAgent(editing);

      const cfg = JSON.parse(JSON.stringify(fullConfig || {}));
      if (!Array.isArray(cfg.bindings)) cfg.bindings = [];

      cfg.bindings = cfg.bindings.filter((b: any) => b?.agentId !== editing.id);
      cfg.bindings.push({
        agentId: editing.id,
        match: {
          channel: editing.bindingChannel || 'telegram',
          ...(editing.bindingAccountId ? { accountId: editing.bindingAccountId } : {}),
        },
      });

      await api.setConfig(cfg, true);

      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveMdFile = async () => {
    if (!editing) return;
    try {
      await api.writeWorkspaceFile(mdFile, mdContent, editing.id);
    } catch (e: any) {
      setError(e.message || `No se pudo guardar ${mdFile}`);
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
              <p className="text-gray-400 text-sm mb-1">{t('agents.model')}: {agent.model || 'default'}</p>
              {findBindingForAgent(agent.id) && (
                <p className="text-gray-500 text-xs mb-3">
                  binding: {findBindingForAgent(agent.id)?.match?.channel}
                  {findBindingForAgent(agent.id)?.match?.accountId ? `:${findBindingForAgent(agent.id)?.match?.accountId}` : ''}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => openEditor(agent)} className="text-xs text-blue-400 hover:text-blue-300">
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

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-5xl max-h-[92vh] overflow-y-auto mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">{editing.id ? t('agents.editAgent') : t('agents.newAgent')}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <select value={editing.model || ''} onChange={e => setEditing({ ...editing, model: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                      <option value="">{t('agents.noOverride')} ({models.primaryModel || t('agents.systemDefault')})</option>
                      {models.aliases.length > 0 && (
                        <optgroup label={`⚡ ${t('agents.aliases')}`}>
                          {models.aliases.map(a => (
                            <option key={a.id} value={a.id}>{a.name} → {a.resolves}</option>
                          ))}
                        </optgroup>
                      )}
                      {models.builtin.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">{t('agents.workspace')}</label>
                    <input value={editing.workspace} onChange={e => setEditing({ ...editing, workspace: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                  </div>
                </div>

                <div className="border border-gray-700 rounded p-3 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Bindings / Comunicación</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400">Canal</label>
                      <select value={editing.bindingChannel} onChange={e => setEditing({ ...editing, bindingChannel: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                        <option value="telegram">Telegram</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="discord">Discord</option>
                        <option value="signal">Signal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Account ID (opcional)</label>
                      {editing.bindingChannel === 'telegram' && telegramAccounts.length > 0 ? (
                        <select
                          value={editing.bindingAccountId}
                          onChange={e => setEditing({ ...editing, bindingAccountId: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="">(default)</option>
                          {telegramAccounts.map((acc) => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                      ) : (
                        <input value={editing.bindingAccountId} onChange={e => setEditing({ ...editing, bindingAccountId: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                          placeholder="ej: neo / personal / default" />
                      )}
                    </div>
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
              </div>

              <div className="space-y-3 border border-gray-700 rounded p-3">
                <h3 className="text-sm font-semibold text-white">Editar .md del agente</h3>
                <div className="flex gap-2">
                  <select
                    value={mdFile}
                    onChange={async (e) => {
                      const file = e.target.value;
                      setMdFile(file);
                      if (editing.id) await loadMdFile(editing.id, file);
                    }}
                    className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option>AGENTS.md</option>
                    <option>SOUL.md</option>
                    <option>USER.md</option>
                    <option>MEMORY.md</option>
                    <option>HEARTBEAT.md</option>
                  </select>
                  <button onClick={saveMdFile} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Guardar MD</button>
                </div>
                <textarea
                  value={mdContent}
                  onChange={(e) => setMdContent(e.target.value)}
                  className="w-full h-[420px] bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono"
                  placeholder={mdLoading ? 'Cargando...' : 'Contenido del archivo...'}
                />
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
