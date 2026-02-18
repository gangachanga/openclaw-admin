'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/components/ssh-provider';
import { useI18n } from '@/i18n/provider';

interface Skill {
  name: string;
  path: string;
  source: 'global' | 'workspace';
  description?: string;
  version?: string;
}

interface InstallForm {
  url: string;
  name: string;
}

export default function SkillsPage() {
  const { api, connected } = useAdmin();
  const { t } = useI18n();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installForm, setInstallForm] = useState<InstallForm>({ url: '', name: '' });
  const [showInstall, setShowInstall] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ssh/skills');
      const data = await res.json();
      
      // Fetch descriptions for each skill
      const skillsWithMeta = await Promise.all(
        (data.skills || []).map(async (skill: Skill) => {
          try {
            const metaRes = await fetch(`/api/ssh/skills/meta?path=${encodeURIComponent(skill.path)}`);
            const meta = await metaRes.json();
            return { ...skill, ...meta };
          } catch {
            return skill;
          }
        })
      );
      
      setSkills(skillsWithMeta);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (connected) load(); }, [connected]);

  const install = async () => {
    if (!installForm.url || !installForm.name) return;
    try {
      setInstalling(true);
      setError('');
      
      const res = await fetch('/api/ssh/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installForm),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.error'));
      
      setSuccess(t('skills.skillInstalled').replace('%s', installForm.name));
      setShowInstall(false);
      setInstallForm({ url: '', name: '' });
      load();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstalling(false);
    }
  };

  const uninstall = async (skill: Skill) => {
    if (!confirm(t('skills.uninstallConfirm').replace('%s', skill.name))) return;
    try {
      const res = await fetch('/api/ssh/skills/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: skill.path, name: skill.name }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.error'));
      
      setSuccess(t('skills.skillUninstalled').replace('%s', skill.name));
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openClawHub = (skill: Skill) => {
    // Try to extract author from path (skills/author/skill-name)
    const pathParts = skill.path.split('/');
    const author = pathParts[pathParts.length - 2] || 'openclaw';
    const skillName = skill.name;
    window.open(`https://clawhub.ai/${author}/${skillName}`, '_blank');
  };

  if (!connected) return <div className="p-6 text-gray-400">{t('skills.waitingSSH')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🎯 {t('skills.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('skills.manageSkills')}</p>
        </div>
        <button 
          onClick={() => setShowInstall(true)} 
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm"
        >
          + {t('skills.installSkill')}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">{t('skills.loading')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div key={skill.path} className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{skill.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      skill.source === 'workspace' 
                        ? 'bg-blue-900/50 text-blue-300' 
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {t(`skills.${skill.source}`)}
                    </span>
                    {skill.version && (
                      <span className="text-xs text-gray-500">v{skill.version}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {skill.description && (
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{skill.description}</p>
              )}
              
              <div className="flex gap-2">
                <button 
                  onClick={() => openClawHub(skill)} 
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {t('skills.viewOnClawHub')}
                </button>
                <button 
                  onClick={() => uninstall(skill)} 
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t('skills.uninstall')}
                </button>
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <p className="text-gray-500 col-span-full">{t('skills.noSkills')}</p>
          )}
        </div>
      )}

      {/* Install Modal */}
      {showInstall && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">{t('skills.installSkill')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">{t('skills.skillName')}</label>
                <input 
                  value={installForm.name} 
                  onChange={e => setInstallForm({ ...installForm, name: e.target.value })}
                  placeholder="ex: humanizer"
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-400">{t('skills.skillUrl')}</label>
                <input 
                  value={installForm.url} 
                  onChange={e => setInstallForm({ ...installForm, url: e.target.value })}
                  placeholder="https://clawhub.ai/author/skill-name or https://github.com/..."
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                />
                <p className="text-gray-500 text-xs mt-1">
                  {t('skills.alsoInstall')}
                </p>
              </div>

              <div className="bg-gray-900/50 p-3 rounded text-sm">
                <p className="text-gray-400 mb-2">{t('skills.alsoInstall')}:</p>
                <button 
                  onClick={() => window.open('https://clawhub.ai', '_blank')}
                  className="text-orange-400 hover:text-orange-300"
                >
                  🦞 {t('skills.clawHubDirectory')}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowInstall(false)} 
                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
              >
                {t('skills.cancel')}
              </button>
              <button 
                onClick={install} 
                disabled={installing || !installForm.url || !installForm.name}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg text-sm"
              >
                {installing ? t('skills.installing') : t('skills.install')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
