import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, Pressable as ReactNativePressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme';
import { ForgeHeader } from '../../src/components/layout/ForgeHeader';
import { ForgeButton, ForgeInput, ForgePanel, ForgeStatus } from '../../src/components/forge';
import { EngineStatusPill } from '../../src/components/forge/EngineStatusPill';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useEngineConnection } from '../../src/hooks/useEngineConnection';
import { useEngineStore } from '../../src/store/engineStore';
import { ROUTING_POLICY_META, ROUTING_POLICIES } from '../../src/forge/router/ModelRouter';
import { buildProviders } from '../../src/forge/providers/registry';

import { OLLAMA_PREFERRED_MODEL } from '../../src/forge/providers/OllamaProvider';

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<string>('Unchecked');
  const [checking, setChecking] = useState(false);
  const engine = useEngineConnection();

  const checkEngine = async () => {
    await engine.retry();
  };

  const checkOllama = async () => {
    setChecking(true);
    setOllamaStatus('Checking…');
    try {
      const providers = buildProviders(settings.providers);
      const ollama = providers.find((p) => p.id === 'ollama');
      if (!ollama) return;
      const ok = await ollama.checkAvailability();
      const models = await ollama.listModels();
      setOllamaStatus(ok ? `Available · ${models.length} models` : 'Unavailable');
      setOllamaModels(models.map((m) => m.id));
    } catch {
      setOllamaStatus('Unavailable');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void checkOllama();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const health = engine.health;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'right']}>
      <ForgeHeader title="Settings" subtitle="AI providers · model selection · appearance" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <ForgePanel title="AI Providers" raised>
          <ProviderRow
            name="Ollama"
            kind="Local"
            enabled={settings.providers.find((p) => p.providerId === 'ollama')?.enabled ?? true}
            onToggle={(v) => settings.updateProvider('ollama', { enabled: v })}
            renderInput={
              <ForgeInput
                label="Base URL"
                value={settings.providers.find((p) => p.providerId === 'ollama')?.baseUrl ?? ''}
                onChangeText={(v) => settings.updateProvider('ollama', { baseUrl: v })}
                hint={ollamaStatus}
              />
            }
            footer={
              <View style={styles.ollamaRow}>
                <ForgeButton
                  title="Check availability"
                  variant="secondary"
                  size="sm"
                  onPress={checkOllama}
                  disabled={checking}
                />
                {settings.providers.find((p) => p.providerId === 'ollama')?.enabled ? (
                  <ForgeStatus state={ollamaStatus.startsWith('Available') ? 'quenched' : 'failed'} label={ollamaStatus} />
                ) : null}
              </View>
            }
          />

          <ProviderRow
            name="OpenRouter"
            kind="Cloud"
            enabled={settings.providers.find((p) => p.providerId === 'openrouter')?.enabled ?? false}
            onToggle={(v) => settings.updateProvider('openrouter', { enabled: v })}
            renderInput={
              <ForgeInput
                label="API key"
                secureTextEntry
                placeholder="sk-or-…"
                value={settings.providers.find((p) => p.providerId === 'openrouter')?.apiKey ?? ''}
                onChangeText={(v) => settings.updateProvider('openrouter', { apiKey: v })}
                hint="Sample any provider, filtering free models via the router."
              />
            }
          />

          <ProviderRow
            name="Grok / xAI"
            kind="Cloud"
            enabled={settings.providers.find((p) => p.providerId === 'grok')?.enabled ?? false}
            onToggle={(v) => settings.updateProvider('grok', { enabled: v })}
            renderInput={
              <ForgeInput
                label="API key"
                secureTextEntry
                placeholder="xai-…"
                value={settings.providers.find((p) => p.providerId === 'grok')?.apiKey ?? ''}
                onChangeText={(v) => settings.updateProvider('grok', { apiKey: v })}
              />
            }
          />
        </ForgePanel>

        <ForgePanel title="Routing Policy">
          {ROUTING_POLICIES.map((p) => {
            const meta = ROUTING_POLICY_META[p];
            const active = settings.routingPolicy === p;
            return (
              <PressableRow key={p} active={active} onPress={() => settings.setRoutingPolicy(p)}>
                <Text style={[styles.policyName, active && styles.policyNameActive]}>{meta.label}</Text>
                <Text style={styles.policyDesc}>{meta.description}</Text>
              </PressableRow>
            );
          })}

          <View style={styles.toggles}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Local-first routing</Text>
              <Switch
                value={settings.routingPolicy === 'LOCAL_FIRST'}
                onValueChange={(v) => settings.setRoutingPolicy(v ? 'LOCAL_FIRST' : 'AUTO')}
                trackColor={{ true: colors.accent, false: colors.dross }}
                thumbColor={colors.accentGold}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Free-only remote fallback</Text>
              <Switch
                value={settings.freeOnlyRemote}
                onValueChange={settings.setFreeOnlyRemote}
                trackColor={{ true: colors.accent, false: colors.dross }}
                thumbColor={colors.accentGold}
              />
            </View>
          </View>
        </ForgePanel>

        <ForgePanel title="Forge Engine">
          <ForgeInput
            label="Engine URL"
            value={settings.engineUrl}
            onChangeText={(v) => {
              settings.setEngineUrl(v);
              useEngineStore.getState().retry();
            }}
            hint="Local Node engine server. Start it with: npm run engine"
            placeholder="http://127.0.0.1:7171"
          />
          <View style={styles.engineRow}>
            <ForgeButton
              title="Check engine"
              variant="secondary"
              size="sm"
              onPress={checkEngine}
              disabled={engine.state === 'connecting'}
            />
            <EngineStatusPill state={engine.state} />
          </View>
          {health ? (
            <View style={styles.diagnostics}>
              <DiagRow k="Version" v={health.version ?? '—'} />
              <DiagRow k="Uptime" v={health.uptimeMs ? `${Math.round(health.uptimeMs / 1000)}s` : '—'} />
              <DiagRow k="Work root" v={health.workRoot ?? '—'} />
              <DiagRow k="OpenCode" v={health.openCodeAvailable ? (health.openCodeVersion ?? 'present') : 'not found'} />
              <DiagRow k="Ollama" v={health.ollamaReachable ? `reachable ${health.defaultModel ? `· ${health.defaultModel}` : ''}` : 'unreachable'} />
              <DiagRow k="Active sessions" v={String(health.activeSessions ?? 0)} />
            </View>
          ) : null}
          {engine.lastError ? <Text style={styles.engineError}>{engine.lastError}</Text> : null}
        </ForgePanel>

        <ForgePanel title="Preferred Local Model">
          {ollamaModels.length > 0 ? (
            <>
              {ollamaModels.map((m) => (
                <PressableRow
                  key={m}
                  active={settings.preferredLocalModel === m}
                  onPress={() => settings.setPreferredLocalModel(m)}
                >
                  <Text style={styles.code}>{m}</Text>
                </PressableRow>
              ))}
            </>
          ) : (
            <Text style={styles.hint}>
              No models detected yet. Start Ollama, or keep the default ({OLLAMA_PREFERRED_MODEL}).
            </Text>
          )}
        </ForgePanel>

        <ForgePanel title="Appearance">
          <View style={styles.appearanceRow}>
            <Feather name="moon" size={18} color={colors.accent} />
            <Text style={styles.body}>Dark forge environment</Text>
            <Text style={styles.hint}>Appearance is locked to the dark workshop for now.</Text>
          </View>
        </ForgePanel>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderRow({
  name,
  kind,
  enabled,
  onToggle,
  renderInput,
  footer,
}: {
  name: string;
  kind: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  renderInput: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.providerRow}>
      <View style={styles.providerHead}>
        <View>
          <Text style={styles.providerName}>{name}</Text>
          <Text style={styles.providerKind}>{kind}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ true: colors.accent, false: colors.dross }}
          thumbColor={colors.accentGold}
        />
      </View>
      {enabled ? renderInput : null}
      {enabled && footer ? footer : null}
    </View>
  );
}

function PressableRow({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <ReactNativePressable
      onPress={onPress}
      style={[styles.pressableRow, active && styles.pressableActive]}
      accessibilityRole="button"
    >
      {children}
    </ReactNativePressable>
  );
}

function DiagRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.diagRow}>
      <Text style={styles.diagKey}>{k}</Text>
      <Text style={styles.diagValue} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.xl,
    maxWidth: 860,
  },
  providerRow: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  providerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerName: {
    ...typography.subheading,
    fontSize: 16,
  },
  providerKind: {
    ...typography.caption,
    color: colors.accentGold,
  },
  ollamaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  diagnostics: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  diagKey: {
    ...typography.caption,
    color: colors.textDim,
  },
  diagValue: {
    ...typography.caption,
    color: colors.text,
    maxWidth: '70%',
  },
  engineError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
  },
  pressableRow: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  pressableActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  policyName: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
  policyNameActive: {
    color: colors.accent,
  },
  policyDesc: {
    ...typography.caption,
    color: colors.textDim,
  },
  toggles: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    ...typography.body,
    fontSize: 14,
  },
  code: {
    ...typography.code,
    color: colors.accentGold,
  },
  hint: {
    ...typography.caption,
    color: colors.textDim,
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  body: {
    ...typography.body,
    fontSize: 14,
  },
});
