/**
 * CredentialStore — Secure credential management for Ironclad Forge (Part 3).
 *
 * Requirements:
 * - Supports: OpenRouter, Grok, Gemini, OpenAI, Anthropic, Ollama, Local / Offline
 * - Persistent storage across application restarts (using safe local encrypted/obfuscated storage)
 * - Safe retrieval, update, removal, and testing
 * - Masked display (never leaks complete key in UI, logs, diagnostics, or generated code)
 * - Strict security boundary: keys are never injected into generated workspaces or git
 */

export type SupportedProviderId =
  | 'openrouter'
  | 'grok'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'local_offline';

export interface ProviderCredentialInfo {
  providerId: SupportedProviderId;
  configured: boolean;
  maskedKey: string;
  updatedAt?: number;
  customBaseUrl?: string;
  selectedModel?: string;
}

const STORAGE_KEY_PREFIX = 'ironclad_forge_cred_';
const PROVIDER_METADATA_KEY = 'ironclad_forge_configured_providers';

// Safe encryption/obfuscation layer for environment storage
function obfuscate(plaintext: string): string {
  if (!plaintext) return '';
  const bytes = new TextEncoder().encode(plaintext);
  let binary = '';
  const key = 0x5a; // XOR mask
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ^ key);
  }
  return btoa(binary);
}

function deobfuscate(ciphertext: string): string {
  if (!ciphertext) return '';
  try {
    const binary = atob(ciphertext);
    const bytes = new Uint8Array(binary.length);
    const key = 0x5a;
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i) ^ key;
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export class CredentialStore {
  private static inMemoryFallback: Map<string, string> = new Map();

  /**
   * Mask an API key for safe UI display (e.g. `••••••••••••abcd`).
   */
  static maskKey(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.length <= 6) {
      return '••••••••';
    }
    const suffix = trimmed.slice(-4);
    return `••••••••••••${suffix}`;
  }

  /**
   * Save an API key securely.
   */
  static saveKey(providerId: SupportedProviderId, apiKey: string): void {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      this.removeKey(providerId);
      return;
    }

    const payload = JSON.stringify({
      key: obfuscate(trimmed),
      updatedAt: Date.now(),
    });

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${providerId}`, payload);
      } else {
        this.inMemoryFallback.set(providerId, payload);
      }
    } catch {
      this.inMemoryFallback.set(providerId, payload);
    }

    this.markProviderConfigured(providerId, true);
  }

  /**
   * Retrieve the plaintext API key (for internal engine provider calls ONLY).
   * NEVER pass this to UI, logs, diagnostics, or generated project files.
   */
  static getKey(providerId: SupportedProviderId): string | null {
    try {
      let raw: string | null = null;
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${providerId}`);
      }
      if (!raw) {
        raw = this.inMemoryFallback.get(providerId) ?? null;
      }
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed?.key) {
        return deobfuscate(parsed.key);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a provider has a configured key.
   */
  static hasKey(providerId: SupportedProviderId): boolean {
    const key = this.getKey(providerId);
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Get the masked key string for UI display.
   */
  static getMaskedKey(providerId: SupportedProviderId): string {
    const key = this.getKey(providerId);
    if (!key) return '';
    return this.maskKey(key);
  }

  /**
   * Remove a provider's key.
   */
  static removeKey(providerId: SupportedProviderId): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${providerId}`);
      }
      this.inMemoryFallback.delete(providerId);
    } catch {
      this.inMemoryFallback.delete(providerId);
    }
    this.markProviderConfigured(providerId, false);
  }

  /**
   * List all providers with their configuration status (safe for UI/diagnostics).
   */
  static getProviderSummary(): ProviderCredentialInfo[] {
    const providers: SupportedProviderId[] = [
      'ollama',
      'local_offline',
      'openrouter',
      'grok',
      'gemini',
      'openai',
      'anthropic',
    ];

    return providers.map((id) => {
      const configured = id === 'ollama' || id === 'local_offline' ? true : this.hasKey(id);
      return {
        providerId: id,
        configured,
        maskedKey: this.getMaskedKey(id),
      };
    });
  }

  private static markProviderConfigured(providerId: SupportedProviderId, configured: boolean): void {
    try {
      let list: string[] = [];
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(PROVIDER_METADATA_KEY);
        if (raw) list = JSON.parse(raw);
      }
      const set = new Set(list);
      if (configured) {
        set.add(providerId);
      } else {
        set.delete(providerId);
      }
      const updated = JSON.stringify(Array.from(set));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PROVIDER_METADATA_KEY, updated);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Clear all stored credentials.
   */
  static clearAll(): void {
    const providers: SupportedProviderId[] = [
      'openrouter',
      'grok',
      'gemini',
      'openai',
      'anthropic',
      'ollama',
      'local_offline',
    ];
    providers.forEach((id) => this.removeKey(id));
    this.inMemoryFallback.clear();
  }
}
