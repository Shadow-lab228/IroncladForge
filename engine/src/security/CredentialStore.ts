/**
 * Engine CredentialStore — Headless environment support for secure key management.
 */
export type SupportedProviderId =
  | 'openrouter'
  | 'grok'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'local_offline';

export class EngineCredentialStore {
  private static store: Map<string, string> = new Map();

  static maskKey(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.length <= 6) return '••••••••';
    return `••••••••••••${trimmed.slice(-4)}`;
  }

  static saveKey(providerId: SupportedProviderId, apiKey: string): void {
    if (!apiKey || !apiKey.trim()) {
      this.removeKey(providerId);
      return;
    }
    this.store.set(providerId, apiKey.trim());
  }

  static getKey(providerId: SupportedProviderId): string | null {
    return this.store.get(providerId) ?? null;
  }

  static hasKey(providerId: SupportedProviderId): boolean {
    const k = this.getKey(providerId);
    return Boolean(k && k.length > 0);
  }

  static getMaskedKey(providerId: SupportedProviderId): string {
    const k = this.getKey(providerId);
    return k ? this.maskKey(k) : '';
  }

  static removeKey(providerId: SupportedProviderId): void {
    this.store.delete(providerId);
  }

  static clearAll(): void {
    this.store.clear();
  }
}
