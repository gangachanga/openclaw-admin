'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';
import { useI18n } from '@/i18n/provider';

interface HistoryEntry {
  command: string;
  stdout: string;
  stderr: string;
  code: number;
  timestamp: string;
  duration: number;
}

export default function TerminalPage() {
  const { connected } = useAdmin();
  const { t } = useI18n();
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const SHORTCUTS = [
    { label: t('terminal.status'), cmd: 'openclaw status' },
    { label: t('terminal.doctor'), cmd: 'openclaw doctor' },
    { label: t('terminal.cronList'), cmd: 'openclaw cron list' },
    { label: t('terminal.disk'), cmd: 'df -h' },
    { label: t('terminal.memory'), cmd: 'free -h' },
    { label: t('terminal.uptime'), cmd: 'uptime' },
    { label: t('terminal.processes'), cmd: 'ps aux --sort=-%mem | head -15' },
    { label: t('terminal.gatewayPID'), cmd: 'pgrep -a openclaw-gateway' },
  ];

  const exec = async (cmd: string) => {
    if (!cmd.trim()) return;
    setRunning(true);
    setCommand('');
    setCmdHistory(prev => [cmd, ...prev.slice(0, 50)]);
    setHistIdx(-1);

    const start = Date.now();
    try {
      const res = await fetch('/api/ssh/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, timeout: 60000 }),
      });
      const data = await res.json();
      const entry: HistoryEntry = {
        command: cmd,
        stdout: data.stdout || '',
        stderr: data.stderr || data.error || '',
        code: data.code ?? (data.error ? 1 : 0),
        timestamp: new Date().toLocaleTimeString(),
        duration: Date.now() - start,
      };
      setHistory(prev => [...prev, entry]);
    } catch (e: any) {
      setHistory(prev => [...prev, {
        command: cmd, stdout: '', stderr: e.message, code: 1,
        timestamp: new Date().toLocaleTimeString(), duration: Date.now() - start,
      }]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      exec(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      if (cmdHistory[next]) setCommand(cmdHistory[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setCommand(''); }
      else { setHistIdx(next); setCommand(cmdHistory[next] || ''); }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!connected) return <div className="p-6 text-gray-400">{t('terminal.waitingSSH')}</div>;

  return (
    <div className="p-6 space-y-4 h-screen flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">🖥️ {t('terminal.title')}</h1>
        <div className="flex gap-1 flex-wrap">
          {SHORTCUTS.map(s => (
            <button key={s.cmd} onClick={() => exec(s.cmd)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs border border-gray-700">
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-y-auto font-mono text-sm min-h-0">
        {history.length === 0 && (
          <div className="text-gray-600">
            {t('terminal.connected')}
            <br />{t('terminal.clearHelp')}
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} className="mb-3">
            <div className="flex items-center gap-2">
              <span className="text-green-500">$</span>
              <span className="text-white">{entry.command}</span>
              <span className="text-gray-600 text-xs ml-auto">
                {entry.timestamp} · {entry.duration}ms
                {entry.code !== 0 && <span className="text-red-400 ml-1">exit {entry.code}</span>}
              </span>
            </div>
            {entry.stdout && <pre className="text-gray-300 whitespace-pre-wrap mt-0.5 ml-4">{entry.stdout}</pre>}
            {entry.stderr && <pre className="text-red-400 whitespace-pre-wrap mt-0.5 ml-4">{entry.stderr}</pre>}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="animate-pulse">●</span> {t('terminal.executing')}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-green-500 font-mono">$</span>
        <input
          ref={inputRef}
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={handleKey}
          disabled={running}
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:border-orange-500 focus:outline-none disabled:opacity-50"
          placeholder={`${t('terminal.title')}...`}
          autoComplete="off"
          spellCheck={false}
        />
        <button onClick={() => exec(command)} disabled={running || !command}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm disabled:opacity-50">
          ▶
        </button>
      </div>
    </div>
  );
}
