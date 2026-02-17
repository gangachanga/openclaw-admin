'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';

// Standard OpenClaw workspace files
const OPENCLAW_FILES = [
  'SOUL.md',
  'AGENTS.md', 
  'TOOLS.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'IDENTITY.md',
  'USER.md',
  'MEMORY.md',
  'SHIELD.md'
];

interface FileItem {
  name: string;
  path: string;
}

export default function KnowledgePage() {
  const { api, connected } = useAdmin();
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('main');
  const [view, setView] = useState<'root' | 'memory'>('root');
  const [memoryFiles, setMemoryFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAgents = async () => {
    try {
      const data = await api.listAgents();
      setAgents(data.agents || []);
    } catch {}
  };

  const loadMemoryFiles = async (agentId: string) => {
    try {
      const data = await api.listWorkspaceFiles(agentId, 'memory');
      // Filter to only show .md and .txt files, sorted by name
      const filtered = (data.files || [])
        .filter((f: any) => !f.isDir && (f.name.endsWith('.md') || f.name.endsWith('.txt')))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      setMemoryFiles(filtered);
    } catch {
      setMemoryFiles([]);
    }
  };

  useEffect(() => {
    if (connected) loadAgents();
  }, [connected]);

  useEffect(() => {
    if (connected && selectedAgent) {
      setSelectedFile('');
      setContent('');
      setView('root');
    }
  }, [connected, selectedAgent]);

  useEffect(() => {
    if (view === 'memory' && selectedAgent) {
      loadMemoryFiles(selectedAgent);
    }
  }, [view, selectedAgent]);

  const openFile = async (name: string, isMemory: boolean = false) => {
    try {
      setLoading(true);
      setError('');
      setSelectedFile(name);
      const data = await api.readWorkspaceFile(name, selectedAgent, isMemory ? 'memory' : undefined);
      setContent(data.content || '');
    } catch (e: any) {
      setContent('');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      setSaving(true);
      setError('');
      await api.writeWorkspaceFile(selectedFile, content, selectedAgent, view === 'memory' ? 'memory' : undefined);
      setSuccess(`${selectedFile} guardado`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const agentName = agents.find(a => a.id === selectedAgent)?.name || selectedAgent;

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📚 Knowledge Base</h1>

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
              <img
                src={`/api/avatars/${agent.id}`}
                alt={agent.name || agent.id}
                className="w-6 h-6 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {agent.name || agent.id}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File list */}
        <div className="space-y-2">
          {view === 'root' ? (
            <>
              <h2 className="text-sm font-semibold text-gray-400 uppercase">
                Workspace Files
              </h2>
              {OPENCLAW_FILES.map((filename) => (
                <button 
                  key={filename} 
                  onClick={() => openFile(filename)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedFile === filename && view === 'root'
                      ? 'bg-orange-600/20 text-orange-400' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {filename}
                </button>
              ))}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => { setView('memory'); setSelectedFile(''); setContent(''); }}
                  className="w-full text-left px-3 py-2 rounded text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2"
                >
                  <span>📁</span>
                  <span>memory/</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => { setView('root'); setSelectedFile(''); setContent(''); }}
                  className="text-sm text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-800"
                >
                  ← Volver
                </button>
              </div>
              <h2 className="text-sm font-semibold text-blue-400 uppercase">
                📁 memory/
              </h2>
              {memoryFiles.length === 0 && <div className="text-gray-500 text-sm px-3">No hay archivos</div>}
              {memoryFiles.map((file) => (
                <button 
                  key={file.name} 
                  onClick={() => openFile(file.name, true)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedFile === file.name && view === 'memory'
                      ? 'bg-orange-600/20 text-orange-400' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-medium">
                  {selectedFile}
                  <span className="text-gray-500 text-sm ml-2">
                    ({agentName}{view === 'memory' && ' / memory'})
                  </span>
                </h2>
                <button onClick={saveFile} disabled={saving}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              {loading ? (
                <div className="text-gray-400">Cargando...</div>
              ) : (
                <textarea 
                  value={content} 
                  onChange={e => setContent(e.target.value)}
                  className="w-full h-[65vh] bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 font-mono text-sm resize-none" 
                />
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-20">
              Seleccioná un archivo para editar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
