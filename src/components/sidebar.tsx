'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/components/ssh-provider';
import { useI18n } from '@/i18n/provider';

export function Sidebar() {
  const pathname = usePathname();
  const { connected, error } = useAdmin();
  const { t, locale, setLocale } = useI18n();

  const NAV = [
    { href: '/', label: t('sidebar.panel'), icon: '🦞' },
    { href: '/agents', label: t('sidebar.agents'), icon: '🤖' },
    { href: '/skills', label: t('sidebar.skills'), icon: '🎯' },
    { href: '/chat', label: t('sidebar.chat'), icon: '💬' },
    { href: '/cron', label: t('sidebar.cron'), icon: '⏰' },
    { href: '/config', label: t('sidebar.config'), icon: '⚙️' },
    { href: '/sessions', label: t('sidebar.sessions'), icon: '⚡' },
    { href: '/costs', label: t('sidebar.costs'), icon: '💰' },
    { href: '/monitoring', label: t('sidebar.monitoring'), icon: '📊' },
    { href: '/terminal', label: t('sidebar.terminal'), icon: '🖥️' },
  ];

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-orange-500">🦞 {t('sidebar.title')}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-400">
            {connected ? t('sidebar.sshConnected') : error ? t('sidebar.sshError') : t('sidebar.disconnected')}
          </span>
        </div>
      </div>

      <nav className="flex-1 p-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                active
                  ? 'bg-orange-500/20 text-orange-400 font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Language Switcher */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 mb-2">{t('sidebar.language')}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setLocale('en')}
            className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
              locale === 'en'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLocale('es')}
            className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
              locale === 'es'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            ES
          </button>
        </div>
      </div>
    </aside>
  );
}
