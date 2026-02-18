'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';

// Editable field component
function Field({ label, value, onChange, type = 'text', options, placeholder, mono, rows }: {
  label: string; value: any; onChange: (v: any) => void;
  type?: 'text' | 'number' | 'select' | 'toggle' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string; mono?: boolean; rows?: number;
}) {
  if (type === 'toggle') {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-400">{label}</span>
        <button onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-orange-500' : 'bg-gray-600'}`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  }
  if (type === 'select' && options) {
    return (
      <div>
        <label className="text-sm text-gray-400">{label}</label>
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  if (type === 'textarea') {
    return (
      <div>
        <label className="text-sm text-gray-400">{label}</label>
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows || 3}
          className={`w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1 ${mono ? 'font-mono' : ''}`}
          placeholder={placeholder} />
      </div>
    );
  }
  return (
    <div>
      <label className="text-sm text-gray-400">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
        className={`w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1 ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder} />
    </div>
  );
}

// Section wrapper
function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details className="bg-gray-800 border border-gray-700 rounded-lg" open={defaultOpen}>
      <summary className="px-4 py-3 text-white font-medium cursor-pointer hover:bg-gray-700/50 flex items-center gap-2">
        <span>{icon}</span> {title}
      </summary>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </details>
  );
}

export default function ConfigPage() {
  const { api, connected } = useAdmin();
  const [config, setConfig] = useState<any>(null);
  const [raw, setRaw] = useState('');
  const [tab, setTab] = useState<'visual' | 'raw'>('visual');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [showAddTelegramAccount, setShowAddTelegramAccount] = useState(false);
  const [newTelegramAccount, setNewTelegramAccount] = useState({ name: '', botToken: '', dmPolicy: 'allowlist' });

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getConfig();
      setConfig(data.config);
      setRaw(data.raw || JSON.stringify(data.config, null, 2));
      
      // Load agents
      try {
        const agentsData = await api.listAgents();
        const agentIds = agentsData.agents?.map((a: any) => a.id || a.label) || [];
        setAgents(agentIds);
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (connected) load(); }, [connected]);

  const update = (path: string, value: any) => {
    const parts = path.split('.');
    const newConfig = JSON.parse(JSON.stringify(config));
    let obj = newConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setConfig(newConfig);
    setRaw(JSON.stringify(newConfig, null, 2));
  };

  const get = (path: string, def?: any) => {
    const parts = path.split('.');
    let obj = config;
    for (const p of parts) {
      if (obj == null) return def;
      obj = obj[p];
    }
    return obj ?? def;
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError('');
      if (tab === 'raw') {
        await api.setConfigRaw(raw);
      } else {
        await api.setConfig(config);
      }
      setSuccess('✅ Configuración guardada y Gateway reiniciado');
      setTimeout(() => setSuccess(''), 5000);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const backup = () => {
    const blob = new Blob([raw || JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const restore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setRaw(content);
      try { setConfig(JSON.parse(content)); } catch {}
      setTab('raw');
    };
    reader.readAsText(file);
  };

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">⚙️ Configuración</h1>
        <div className="flex gap-2">
          <button onClick={backup} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">📦 Backup</button>
          <label className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm cursor-pointer">
            📂 Restaurar
            <input type="file" accept=".json" onChange={restore} className="hidden" />
          </label>
          <button onClick={saveConfig} disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar y reiniciar'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}<button onClick={() => setError('')} className="ml-2">✕</button></div>}
      {success && <div className="p-3 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm">{success}</div>}

      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button onClick={() => setTab('visual')} className={`px-3 py-1.5 rounded text-sm ${tab === 'visual' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>🎨 Visual</button>
        <button onClick={() => { setTab('raw'); setRaw(JSON.stringify(config, null, 2)); }} className={`px-3 py-1.5 rounded text-sm ${tab === 'raw' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>📝 JSON</button>
      </div>

      {loading ? (
        <div className="text-gray-400">Cargando configuración...</div>
      ) : tab === 'raw' ? (
        <textarea value={raw} onChange={e => { setRaw(e.target.value); try { setConfig(JSON.parse(e.target.value)); } catch {} }}
          className="w-full h-[70vh] bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 font-mono text-sm resize-none" />
      ) : config ? (
        <div className="space-y-4">
          {/* Gateway */}
          <Section title="Gateway" icon="🌐" defaultOpen>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Puerto" value={get('gateway.port')} onChange={v => update('gateway.port', v)} type="number" />
              <Field label="Modo" value={get('gateway.mode')} onChange={v => update('gateway.mode', v)} type="select"
                options={[{ value: 'local', label: 'Local' }, { value: 'remote', label: 'Remote' }, { value: 'cloud', label: 'Cloud' }]} />
              <Field label="Bind" value={get('gateway.bind')} onChange={v => update('gateway.bind', v)} type="select"
                options={[{ value: 'loopback', label: 'Loopback (127.0.0.1)' }, { value: 'lan', label: 'LAN (0.0.0.0)' }]} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Auth mode" value={get('gateway.auth.mode')} onChange={v => update('gateway.auth.mode', v)} type="select"
                options={[{ value: 'token', label: 'Token' }, { value: 'none', label: 'None' }]} />
              <Field label="Token" value={get('gateway.auth.token')} onChange={v => update('gateway.auth.token', v)} mono placeholder="Gateway token" />
            </div>
          </Section>

          {/* Models */}
          <Section title="Modelos" icon="🧠" defaultOpen>
            <Field label="Modelo primario" value={get('agents.defaults.model.primary')} onChange={v => update('agents.defaults.model.primary', v)} mono />
            <div>
              <label className="text-sm text-gray-400">Fallbacks</label>
              <div className="space-y-1 mt-1">
                {(get('agents.defaults.model.fallbacks', []) as string[]).map((fb, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={fb} onChange={e => {
                      const fbs = [...get('agents.defaults.model.fallbacks', [])];
                      fbs[i] = e.target.value;
                      update('agents.defaults.model.fallbacks', fbs);
                    }} className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm font-mono" />
                    <button onClick={() => {
                      const fbs = get('agents.defaults.model.fallbacks', []).filter((_: any, j: number) => j !== i);
                      update('agents.defaults.model.fallbacks', fbs);
                    }} className="text-red-400 hover:text-red-300 px-2">✕</button>
                  </div>
                ))}
                <button onClick={() => {
                  const fbs = [...get('agents.defaults.model.fallbacks', []), ''];
                  update('agents.defaults.model.fallbacks', fbs);
                }} className="text-xs text-orange-400 hover:text-orange-300">+ Agregar fallback</button>
              </div>
            </div>
          </Section>

          {/* Bindings - MUST BE FIRST! */}
          <Section title="Bindings (Canal → Agente)" icon="🔗" defaultOpen>
            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded text-blue-300 text-xs mb-3">
              📌 Crea bindings aquí primero. Estos agentes aparecerán en Telegram/WhatsApp más abajo.
            </div>
            <div className="space-y-3">
              {(get('bindings', []) as any[]).map((binding, i) => (
                <div key={i} className="bg-gray-900 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                      <img src={`/api/avatars/${binding.agentId}`} alt="" className="w-5 h-5 rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="text-white font-medium">{binding.agentId}</span>
                      <span className="text-gray-500">←</span>
                      <span className="text-gray-400">{binding.match?.channel}{binding.match?.accountId ? `:${binding.match.accountId}` : ''}</span>
                    </div>
                    <button onClick={() => {
                      const bindings = [...get('bindings', [])];
                      bindings.splice(i, 1);
                      update('bindings', bindings);
                    }} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Agente" value={binding.agentId} onChange={v => {
                      const bindings = [...get('bindings', [])];
                      bindings[i] = { ...bindings[i], agentId: v };
                      update('bindings', bindings);
                    }} type="select" options={agents.map(a => ({ value: a, label: a }))} />
                    <Field label="Canal" value={binding.match?.channel || 'telegram'} onChange={v => {
                      const bindings = [...get('bindings', [])];
                      bindings[i] = { ...bindings[i], match: { ...bindings[i].match, channel: v } };
                      update('bindings', bindings);
                    }} type="select" options={[
                      { value: 'telegram', label: 'Telegram' },
                      { value: 'whatsapp', label: 'WhatsApp' },
                      { value: 'discord', label: 'Discord' },
                      { value: 'signal', label: 'Signal' },
                    ]} />
                    <Field label="Account ID" value={binding.match?.accountId || ''} onChange={v => {
                      const bindings = [...get('bindings', [])];
                      const match = { ...bindings[i].match, accountId: v || undefined };
                      if (!v) delete match.accountId;
                      bindings[i] = { ...bindings[i], match };
                      update('bindings', bindings);
                    }} placeholder="default" />
                  </div>
                </div>
              ))}
              
              {/* Add new binding */}
              <button onClick={() => {
                const bindings = [...get('bindings', [])];
                bindings.push({ agentId: agents[0] || 'main', match: { channel: 'telegram' } });
                update('bindings', bindings);
              }} className="w-full py-2 border border-dashed border-gray-600 rounded text-sm text-orange-400 hover:text-orange-300 hover:border-gray-500">
                + Agregar binding
              </button>
            </div>
          </Section>

          {/* Channels - Telegram */}
          <Section title="Telegram" icon="📱">
            <Field label="Habilitado" value={get('channels.telegram.enabled', true)} onChange={v => update('channels.telegram.enabled', v)} type="toggle" />
            <Field label="DM Policy" value={get('channels.telegram.dmPolicy')} onChange={v => update('channels.telegram.dmPolicy', v)} type="select"
              options={[{ value: 'allowlist', label: 'Allowlist' }, { value: 'open', label: 'Open' }, { value: 'disabled', label: 'Disabled' }]} />
            <Field label="Stream Mode" value={get('channels.telegram.streamMode')} onChange={v => update('channels.telegram.streamMode', v)} type="select"
              options={[{ value: 'partial', label: 'Partial' }, { value: 'full', label: 'Full' }, { value: 'off', label: 'Off' }]} />
            <div>
              <label className="text-sm text-gray-400 font-medium">Cuentas</label>
              {Object.entries(get('channels.telegram.accounts', {}) as Record<string, any>).map(([name, acc]) => (
                <details key={name} className="mt-2 bg-gray-900 rounded p-3">
                  <summary className="text-sm text-white cursor-pointer flex items-center justify-between">
                    <span>{name} {acc.enabled === false ? '(desactivada)' : ''}</span>
                    <button onClick={(e) => {
                      e.preventDefault();
                      if (!confirm(`¿Eliminar la cuenta "${name}"?`)) return;
                      const accounts = { ...get('channels.telegram.accounts', {}) };
                      delete accounts[name];
                      update('channels.telegram.accounts', accounts);
                    }} className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Field label="Habilitado" value={acc.enabled ?? true}
                      onChange={v => update(`channels.telegram.accounts.${name}.enabled`, v)} type="toggle" />
                    <Field label="Bot Token" value={acc.botToken}
                      onChange={v => update(`channels.telegram.accounts.${name}.botToken`, v)} mono placeholder="123456:ABC-DEF..." />
                    <Field label="DM Policy" value={acc.dmPolicy}
                      onChange={v => update(`channels.telegram.accounts.${name}.dmPolicy`, v)} type="select"
                      options={[{ value: 'allowlist', label: 'Allowlist' }, { value: 'open', label: 'Open' }, { value: 'disabled', label: 'Disabled' }]} />
                    <Field label="Stream Mode" value={acc.streamMode || 'partial'}
                      onChange={v => update(`channels.telegram.accounts.${name}.streamMode`, v)} type="select"
                      options={[{ value: 'partial', label: 'Partial' }, { value: 'full', label: 'Full' }, { value: 'off', label: 'Off' }]} />
                    <Field label="Allow From (IDs, separados por coma)" value={(acc.allowFrom || []).join(', ')}
                      onChange={v => update(`channels.telegram.accounts.${name}.allowFrom`, v.split(',').map((s: string) => { const n = parseInt(s.trim()); return isNaN(n) ? s.trim() : n; }).filter(Boolean))} />
                  </div>
                </details>
              ))}
              {showAddTelegramAccount ? (
                <div className="mt-3 bg-gray-900 rounded p-3 border border-orange-600 space-y-2">
                  <div>
                    <label className="text-sm text-gray-400">Nombre de la cuenta</label>
                    <input type="text" value={newTelegramAccount.name}
                      onChange={e => setNewTelegramAccount({ ...newTelegramAccount, name: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                      placeholder="ej: neo, extra, etc" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Bot Token</label>
                    <input type="text" value={newTelegramAccount.botToken}
                      onChange={e => setNewTelegramAccount({ ...newTelegramAccount, botToken: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1 font-mono text-xs"
                      placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">DM Policy</label>
                    <select value={newTelegramAccount.dmPolicy}
                      onChange={e => setNewTelegramAccount({ ...newTelegramAccount, dmPolicy: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1">
                      <option value="allowlist">Allowlist</option>
                      <option value="open">Open</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (!newTelegramAccount.name || !newTelegramAccount.botToken) {
                        setError('Nombre y Bot Token son requeridos');
                        return;
                      }
                      const accounts = { ...get('channels.telegram.accounts', {}) };
                      accounts[newTelegramAccount.name] = {
                        enabled: true,
                        botToken: newTelegramAccount.botToken,
                        dmPolicy: newTelegramAccount.dmPolicy || 'allowlist',
                        allowFrom: [],
                        streamMode: 'partial'
                      };
                      update('channels.telegram.accounts', accounts);
                      setNewTelegramAccount({ name: '', botToken: '', dmPolicy: 'allowlist' });
                      setShowAddTelegramAccount(false);
                    }} className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm">
                      ✓ Guardar
                    </button>
                    <button onClick={() => {
                      setNewTelegramAccount({ name: '', botToken: '', dmPolicy: 'allowlist' });
                      setShowAddTelegramAccount(false);
                    }} className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
                      ✕ Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddTelegramAccount(true)}
                  className="mt-2 w-full py-2 border border-dashed border-orange-500 rounded text-sm text-orange-400 hover:text-orange-300 hover:border-orange-400">
                  + Agregar cuenta de Telegram
                </button>
              )}
            </div>
          </Section>

          {/* WhatsApp */}
          {get('channels.whatsapp') && (
            <Section title="WhatsApp" icon="💬">
              <Field label="Habilitado" value={get('channels.whatsapp.enabled', true)} onChange={v => update('channels.whatsapp.enabled', v)} type="toggle" />
              <Field label="Stream Mode" value={get('channels.whatsapp.streamMode')} onChange={v => update('channels.whatsapp.streamMode', v)} type="select"
                options={[{ value: 'partial', label: 'Partial' }, { value: 'full', label: 'Full' }, { value: 'off', label: 'Off' }]} />
            </Section>
          )}

          {/* TTS */}
          <Section title="TTS (ElevenLabs)" icon="🎵">
            <Field label="API Key" value={get('talk.apiKey')} onChange={v => update('talk.apiKey', v)} mono />
          </Section>

          {/* Messages */}
          <Section title="Mensajes" icon="💬">
            <Field label="TTS habilitado" value={get('messages.tts.enabled', false)} onChange={v => update('messages.tts.enabled', v)} type="toggle" />
            <Field label="Reacciones" value={get('messages.ackReactionScope', 'off')} onChange={v => update('messages.ackReactionScope', v)} type="select"
              options={[{ value: 'off', label: 'Off' }, { value: 'minimal', label: 'Minimal' }, { value: 'all', label: 'All' }]} />
          </Section>

          {/* Custom providers */}
          <Section title="Proveedores custom" icon="🔧">
            {Object.entries(get('models.providers', {}) as Record<string, any>).map(([name, prov]) => (
              <details key={name} className="bg-gray-900 rounded p-3">
                <summary className="text-sm text-white cursor-pointer">{name} ({prov.models?.length || 0} modelos)</summary>
                <div className="mt-2 space-y-2">
                  <Field label="Base URL" value={prov.baseUrl} onChange={v => update(`models.providers.${name}.baseUrl`, v)} mono />
                  <Field label="API Key" value={prov.apiKey} onChange={v => update(`models.providers.${name}.apiKey`, v)} mono />
                  <Field label="API Type" value={prov.api} onChange={v => update(`models.providers.${name}.api`, v)} type="select"
                    options={[{ value: 'openai-completions', label: 'OpenAI Completions' }, { value: 'anthropic', label: 'Anthropic' }]} />
                  <div className="text-xs text-gray-500">
                    Modelos: {prov.models?.map((m: any) => m.name || m.id).join(', ') || 'ninguno'}
                  </div>
                </div>
              </details>
            ))}
          </Section>

          {/* Plugins */}
          <Section title="Plugins" icon="🔌">
            <pre className="text-gray-300 text-xs font-mono bg-gray-900 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
              {JSON.stringify(get('plugins'), null, 2)}
            </pre>
          </Section>

          {/* Skills */}
          <Section title="Skills" icon="🎯">
            <pre className="text-gray-300 text-xs font-mono bg-gray-900 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
              {JSON.stringify(get('skills'), null, 2)}
            </pre>
          </Section>
        </div>
      ) : (
        <div className="text-gray-400">No se pudo parsear la configuración.</div>
      )}
    </div>
  );
}
