import { NextResponse } from 'next/server';
import { sshReadFile, isSSHConfigured } from '@/lib/ssh-client';

const CONFIG_PATH = '~/.openclaw/openclaw.json';

// Known built-in models by provider (these don't need explicit config)
const BUILTIN_PROVIDERS: Record<string, { id: string; name: string }[]> = {
  anthropic: [
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5' },
    { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'openai/o3', name: 'o3' },
    { id: 'openai/o4-mini', name: 'o4-mini' },
  ],
  google: [
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ],
  perplexity: [
    { id: 'perplexity/sonar-pro', name: 'Sonar Pro' },
    { id: 'perplexity/sonar', name: 'Sonar' },
  ],
};

export async function GET() {
  if (!isSSHConfigured()) {
    return NextResponse.json({ error: 'SSH not configured' }, { status: 400 });
  }

  try {
    const content = await sshReadFile(CONFIG_PATH);
    const config = JSON.parse(content);

    const defaultModel = config?.agents?.defaults?.model;
    const primaryModel = defaultModel?.primary || 'anthropic/claude-sonnet-4-5';
    const fallbacks: string[] = defaultModel?.fallbacks || [];

    // Collect which built-in providers have API keys configured
    const availableBuiltin: { id: string; name: string; provider: string }[] = [];

    // Check for API keys in env or config to determine available built-in providers
    // Anthropic and OpenAI are assumed available if they appear in fallbacks/primary
    const usedModels = new Set([primaryModel, ...fallbacks]);
    const activeBuiltinProviders = new Set<string>();
    for (const m of usedModels) {
      const provider = m.split('/')[0];
      if (provider && BUILTIN_PROVIDERS[provider]) {
        activeBuiltinProviders.add(provider);
      }
    }

    // Also check if aliases reference built-in providers
    const aliases = config?.aliases || {};
    for (const target of Object.values(aliases) as string[]) {
      const provider = target.split('/')[0];
      if (provider && BUILTIN_PROVIDERS[provider]) {
        activeBuiltinProviders.add(provider);
      }
    }

    for (const provider of activeBuiltinProviders) {
      for (const model of BUILTIN_PROVIDERS[provider]) {
        availableBuiltin.push({ ...model, provider });
      }
    }

    // Collect custom models from explicit provider configs
    const customModels: { id: string; name: string; provider: string }[] = [];
    const providers = config?.models?.providers || {};
    for (const [providerKey, providerData] of Object.entries(providers) as any) {
      for (const model of providerData.models || []) {
        customModels.push({
          id: `${providerKey}/${model.id}`,
          name: model.name || model.id,
          provider: providerKey,
        });
      }
    }

    // Build aliases list from config
    const aliasesList = Object.entries(aliases).map(([alias, target]) => ({
      id: alias,
      name: alias,
      resolves: target as string,
    }));

    return NextResponse.json({
      primaryModel,
      fallbacks,
      builtin: availableBuiltin,
      custom: customModels,
      aliases: aliasesList,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
