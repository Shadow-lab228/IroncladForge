import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme';
import { ForgeHeader } from '../../src/components/layout/ForgeHeader';
import { ForgeButton, ForgeInput, ForgePanel, ForgeStatus } from '../../src/components/forge';
import { EngineStatusPill } from '../../src/components/forge/EngineStatusPill';
import { Ember, Hammer } from '../../src/components/forge/ForgeIcons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useWorkshopStore } from '../../src/store/workshopStore';
import { useForge } from '../../src/hooks/useForge';
import { useEngineConnection } from '../../src/hooks/useEngineConnection';
import { ROUTING_POLICY_META, ROUTING_POLICIES } from '../../src/forge/router/ModelRouter';

export default function ForgeScreen() {
  const workshop = useWorkshopStore();
  const settings = useSettingsStore();
  const engine = useEngineConnection();
  const { run, phase, isForging, session, startError } = useForge();
  const [request, setRequest] = useState('');

  const engineBlocked = engine.state === 'unavailable' || engine.state === 'error';

  const onForge = () => {
    workshop.setBlueprint(request);
    void run();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'right']}>
      <ForgeHeader
        title="Forge"
        subtitle="AI interaction · blueprint → forged software"
        forgeState={session?.state ?? (isForging ? 'forging' : 'idle')}
        right={<EngineStatusPill state={engine.state} />}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          <ForgePanel title="The Requirement" raised style={styles.inputPanel}>
            <ForgeInput
              multiline
              label="Blueprint"
              value={isForging ? workshop.blueprint : request}
              onChangeText={setRequest}
              editable={!isForging}
              placeholder="Describe what you want to forge…"
              style={styles.input}
            />
            <ForgeButton
              title={isForging ? 'FORGING…' : engineBlocked ? 'ENGINE OFFLINE' : 'FORGE FROM THIS'}
              variant="forge"
              icon={<Hammer size={16} color="#231005" />}
              onPress={onForge}
              disabled={!request.trim() || isForging || engineBlocked}
              loading={isForging}
              style={styles.forgeButton}
            />
            {startError ? <Text style={styles.err}>{startError}</Text> : null}
          </ForgePanel>

          <ForgePanel title="Session Status" style={styles.statusPanel}>
            <View style={styles.statusRow}>
              <ForgeStatus state={isForging ? 'forging' : (session?.state ?? 'idle')} />
              <EngineStatusPill state={engine.state} />
              {session?.model ? <Text style={styles.model}>{session.model.modelId}</Text> : null}
            </View>
            <Text style={styles.hint}>{phase}</Text>
            <ForgePanel title="Routing Policy" style={styles.policyPanel}>
              {ROUTING_POLICIES.map((p) => (
                <View key={p} style={styles.policyRow}>
                  <Ember size={12} color={settings.routingPolicy === p ? colors.accent : colors.textDim} />
                  <Text style={[styles.policyText, settings.routingPolicy === p && styles.policyActive]}>
                    {p}
                  </Text>
                </View>
              ))}
              <Text style={styles.policyDesc}>
                {ROUTING_POLICY_META[settings.routingPolicy].description}
              </Text>
            </ForgePanel>
          </ForgePanel>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  grid: {
    gap: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  inputPanel: {
    flex: 1,
    minWidth: 320,
  },
  input: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
  forgeButton: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
  },
  statusPanel: {
    flex: 1,
    minWidth: 280,
    gap: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  model: {
    ...typography.caption,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
  },
  err: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
  },
  policyPanel: {
    backgroundColor: colors.surface,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  policyText: {
    ...typography.caption,
    textTransform: 'none',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  policyActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  policyDesc: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
});
