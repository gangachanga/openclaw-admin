'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '@/components/ssh-provider';

interface Message {
  id: number;
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
  agentId?: string;
}

interface Agent {
  id: string;
  name: string;
  model: string;
}

export default function ChatPage() {
  const { connected } = useAdmin();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let nextId = useRef(0);

  useEffect(() => {
    if (!connected) return;
    fetch('/api/ssh/chat/agents')
      .then(r => r.json())
      .then(data => {
        if (data.agents?.length) {
          setAgents(data.agents);
          setSelectedAgent(data.agents[0].id);
        }
      })
      .catch(() => {});
  }, [connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !selectedAgent || sending) return;

    const userMsg: Message = {
      id: nextId.current++,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/ssh/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent, message: text }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        const agentMsg: Message = {
          id: nextId.current++,
          role: 'agent',
          text: data.response,
          timestamp: new Date(),
          agentId: selectedAgent,
        };
        setMessages(prev => [...prev, agentMsg]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const agentName = agents.find(a => a.id === selectedAgent)?.name || selectedAgent;

  if (!connected) return <div className="p-6 text-gray-400">Esperando conexión SSH...</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">💬 Chat</h1>
          <select
            value={selectedAgent}
            onChange={e => { setSelectedAgent(e.target.value); setMessages([]); }}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.model})</option>
            ))}
          </select>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-gray-400 hover:text-white px-2 py-1"
          >
            Limpiar chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg">Enviá un mensaje a <span className="text-orange-400">{agentName}</span></p>
            <p className="text-sm mt-1">Cada mensaje es independiente (sin contexto de sesión)</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-orange-600 text-white rounded-br-md'
                : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-md'
            }`}>
              {msg.role === 'agent' && (
                <div className="flex items-center gap-2 mb-1">
                  <img src={`/api/avatars/${msg.agentId}`} alt="" className="w-5 h-5 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="text-xs text-gray-400 font-medium">{agentName}</span>
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-orange-200' : 'text-gray-500'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400">{agentName} está pensando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Mensaje para ${agentName}...`}
            disabled={sending}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm
              placeholder-gray-500 focus:outline-none focus:border-orange-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="px-5 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500
              text-white rounded-xl text-sm font-medium transition-colors"
          >
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
