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
    { id: 'openai/gpt-5.2', name: 'GPT-5.2' },
    { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro' },
    { id: 'openai/gpt-5.1', name: 'GPT-5.1' },
    { id: 'openai/gpt-5', name: 'GPT-5' },
    { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
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
    // Aliases come from agents.defaults.models entries that have an "alias" field
    const agentModels = config?.agents?.defaults?.models || {};
    const aliases: Record<string, string> = {};
    for (const [modelId, modelData] of Object.entries(agentModels) as any) {
      if (modelData?.alias) {
        aliases[modelData.alias] = modelId;
      }
      // Also mark the provider as active
      const prov = modelId.split('/')[0];
      if (prov && BUILTIN_PROVIDERS[prov]) activeBuiltinProviders.add(prov);
    }
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

    // Ensure any model currently used by an agent appears in the list
    const allKnownIds = new Set([
      ...availableBuiltin.map(m => m.id),
      ...customModels.map(m => m.id),
    ]);
    const agentList = config?.agents?.list || [];
    for (const agent of agentList) {
      if (agent.model && !allKnownIds.has(agent.model)) {
        const [prov, ...rest] = agent.model.split('/');
        const modelName = rest.join('/') || prov;
        customModels.push({ id: agent.model, name: modelName, provider: prov });
        allKnownIds.add(agent.model);
      }
    }
    // Also include primary + fallbacks that aren't already listed
    for (const m of usedModels) {
      if (!allKnownIds.has(m)) {
        const [prov, ...rest] = m.split('/');
        customModels.push({ id: m, name: rest.join('/') || prov, provider: prov });
        allKnownIds.add(m);
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
