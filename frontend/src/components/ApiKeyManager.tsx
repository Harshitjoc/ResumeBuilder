import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o'],
    keyLabel: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    keyLabel: 'sk-ant-...',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    keyLabel: 'AIza...',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    models: ['mistral', 'llama3'],
    // 127.0.0.1 (not localhost): on Windows "localhost" can hit a Docker/WSL
    // relay serving a different Ollama (and a different model set).
    keyLabel: 'http://127.0.0.1:11434',
  },
]

export default function ApiKeyManager() {
  const apiKeys = useAppStore((s) => s.apiKeys)
  const setApiKeys = useAppStore((s) => s.setApiKeys)

  const [provider, setProvider] = useState(apiKeys?.primaryProvider || 'openai')
  const [key, setKey] = useState(apiKeys?.primaryKey || '')
  const [model, setModel] = useState(apiKeys?.primaryModel || PROVIDERS[0].models[0])
  const [saved, setSaved] = useState(false)

  const activeModels = PROVIDERS.find((p) => p.id === provider)?.models ?? []

  const handleProviderChange = (id: string) => {
    setProvider(id)
    setModel(PROVIDERS.find((p) => p.id === id)?.models[0] ?? '')
  }

  const save = () => {
    setApiKeys({
      primaryProvider: provider,
      primaryKey: key,
      primaryModel: model,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-900">LLM Provider</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Provider</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">API key / URL</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={PROVIDERS.find((p) => p.id === provider)?.keyLabel}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Model</label>
          {provider === 'ollama' ? (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. qwen3:0.6b, llama3.1"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            />
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {activeModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Save key
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
        <p className="text-xs text-slate-400">
          Keys are stored in your browser and sent only to the LLM provider — never our backend.
        </p>
      </div>
    </div>
  )
}
