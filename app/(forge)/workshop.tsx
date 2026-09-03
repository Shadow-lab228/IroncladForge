import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing, type } from '../../src/theme/tokens';
import { typography } from '../../src/theme';
import { ForgeHeader } from '../../src/components/layout/ForgeHeader';
import { ForgeButton, ForgeStatus, ForgePanel, ForgeLog } from '../../src/components/forge';
import { EngineStatusPill } from '../../src/components/forge/EngineStatusPill';
import { Anvil, Hammer } from '../../src/components/forge/ForgeIcons';
import { EmberField, ForgeStriker } from '../../src/animation';
import { useWorkshopStore } from '../../src/store/workshopStore';
import { usePreviewStore } from '../../src/store/previewStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useForge } from '../../src/hooks/useForge';
import { useEngineConnection } from '../../src/hooks/useEngineConnection';
import { ROUTING_POLICY_META } from '../../src/forge/router/ModelRouter';
import type { ForgePreviewStatus } from '../../src/forge/client/ForgeEngineClient';

export default function WorkshopScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const workshop = useWorkshopStore();
  const settings = useSettingsStore();
  const engine = useEngineConnection();
  const { run, cancel, phase, isForging, session, startError } = useForge();
  const [draft, setDraft] = useState('');

  const wide = width >= 900;
  const engineBlocked = engine.state === 'unavailable' || engine.state === 'error';

  const active = workshop.projects.find((p) => p.id === workshop.activeProjectId);
  const quenched = session?.state === 'quenched' && session.result;
  const previewStatus: ForgePreviewStatus = session?.preview?.status ?? 'IDLE';
  const previewable = session?.detection?.previewKind !== 'unsupported';

  const onForge = () => {
    workshop.setBlueprint(draft);
    void run();
  };

  const onCancel = () => {
    void cancel();
  };

  const onOpenProject = () => {
    router.push('/(forge)/project' as never);
  };

  const onViewPreview = () => {
    if (!active || !previewable) {
      router.push('/(forge)/project' as never);
      return;
    }
    const state = usePreviewStore.getState().byProject[active.id];
    if (!state || (state.status !== 'RUNNING' && state.status !== 'STARTING' && state.status !== 'DETECTING')) {
      void usePreviewStore.getState().start(active.id);
    }
    router.push('/(forge)/project' as never);
  };

  const onEngineRetry = async () => {
    const ok = await engine.retry();
    if (!ok) await engine.attemptStart();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'right']}>
      <ForgeHeader
        title="Workshop"
        subtitle="Where software is forged"
        forgeState={session?.state ?? (isForging ? 'forging' : 'idle')}
        right={
          <View style={styles.headerPills}>
            <ForgeStatus state={settings.routingPolicy} label={settings.routingPolicy.replace('_', ' ')} />
            <EngineStatusPill state={engine.state} />
          </View>
        }
      />

      <View style={styles.content}>
        <EmberField count={wide ? 20 : 12} />

        <ScrollView
          contentContainerStyle={[styles.scroll, wide ? styles.scrollWide : null]}
        >
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Ironclad Forge</Text>
            <Text style={styles.heroSub}>
              Describe what you want to build. We&apos;ll forge it into software.
            </Text>
          </View>

          {!isForging && (engineBlocked || startError) ? (
            <EngineNotice
              title={engineBlocked ? (engine.state === 'error' ? 'Forge engine conflict' : 'Awakening the Forge…') : 'Forge could not start'}
              body={startError ?? engine.lastError ?? 'Start the engine on your computer with `npm run engine`, then Retry.'}
              onRetry={() => void onEngineRetry()}
            />
          ) : null}

          <View style={[styles.forgeArea, wide ? styles.forgeAreaWide : null]}>
            <ForgePanel
              title="Blueprint"
              raised
              style={styles.blueprintPanel}
              action={<Anvil size={26} color={colors.anvil} />}
            >
              <TextInput
                multiline
                value={isForging ? workshop.blueprint : draft}
                onChangeText={setDraft}
                editable={!isForging}
                placeholder="Describe what you want to forge…"
                placeholderTextColor={colors.textDim}
                style={[styles.blueprintInput, isForging && styles.blueprintDisabled]}
              />
              <View style={styles.forgeRow}>
                <ForgeButton
                  title={isForging ? 'FORGING…' : engineBlocked ? 'ENGINE OFFLINE' : 'FORGE'}
                  variant="forge"
                  size="lg"
                  icon={<Hammer size={18} color="#231005" />}
                  onPress={onForge}
                  loading={isForging}
                  disabled={!draft.trim() || isForging || engineBlocked}
                  style={styles.forgeButton}
                />
                {isForging && session ? (
                  <ForgeButton title="CANCEL" variant="danger" size="lg" onPress={onCancel} style={styles.cancelButton} />
                ) : null}
                {session ? (
                  <View style={styles.active}>
                    {session.model ? (
                      <>
                        <Text style={styles.phase}>{phase}</Text>
                        <Text style={styles.model}>{session.model.modelName}</Text>
                        <Text style={styles.hint}>{session.model.providerName} · {session.model.policy}</Text>
                      </>
                    ) : session.error ? (
                      <>
                        <Text style={[styles.phase, { color: colors.danger }]}>Forge failed</Text>
                        <Text style={styles.hint} numberOfLines={2}>{session.error}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.phase}>{phase}</Text>
                        <Text style={styles.hint}>Engaging provider…</Text>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.active}>
                    <Text style={styles.hint}>Policy: {ROUTING_POLICY_META[settings.routingPolicy].description}</Text>
                    <Text style={styles.hint}>Engine: {settings.engineUrl}</Text>
                  </View>
                )}
              </View>
            </ForgePanel>

            <View style={styles.strikerWrap}>
              <ForgeStriker active={isForging} size={wide ? 230 : 170} />
            </View>
          </View>

          {(session || workshop.activity.some((a) => a.kind === 'agent')) && (
            <View style={styles.logWrap}>
              {session ? (
                <>
                  {session.workspaceDir ? (
                    <Text style={styles.meta} numberOfLines={1}>Workspace: {session.workspaceDir}</Text>
                  ) : null}
                  {session.buildStatus ? (
                    <Text style={styles.meta}>
                      Temper: {forgeStatusLabel(session.buildStatus)} · {session.buildResults.length} run(s)
                      {session.reforgeCount > 0 ? ` · ${session.reforgeCount} repair(s)` : ''}
                    </Text>
                  ) : null}
                  {session.inspection ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      Inspection: {session.inspection.category ?? 'other'} — {session.inspection.messages.length} problem(s)
                      {session.inspection.affectedFiles.length ? ` · ${session.inspection.affectedFiles.slice(0, 2).join(', ')}` : ''}
                    </Text>
                  ) : null}
                  {session.result ? (
                    <Text style={styles.meta}>
                      Result: {session.result.files.length} files · {session.result.tokens.total} tokens · {session.result.durationMs >= 1000 ? `${(session.result.durationMs / 1000).toFixed(1)}s` : '—'}
                    </Text>
                  ) : null}
                  <ForgeLog lines={session.log.slice(-60)} emptyText="Waiting for the first strike…" />
                </>
              ) : null}
            </View>
          )}

          {quenched && active ? (
            <View style={styles.summary}>
              <View style={styles.summaryHead}>
                <Anvil size={22} color={colors.accentGold} />
                <Text style={styles.summaryTitle}>Forged — {active.name}</Text>
              </View>

              <View style={styles.statusStrip}>
                <StatusRow label="ENGINE" value={engine.state === 'connected' ? 'ONLINE' : engine.state.toUpperCase()} />
                <StatusRow label="FORGE" value={quenched ? 'QUENCHED' : (session.state ?? 'IDLE').toUpperCase()} />
                <StatusRow label="PROJECT" value={(session.detection?.framework ?? active.status).toUpperCase()} />
                <StatusRow label="PREVIEW" value={previewStatus} />
              </View>

              <View style={styles.ctaRow}>
                <ForgeButton
                  title="OPEN PROJECT"
                  size="md"
                  variant="secondary"
                  icon={<Feather name="folder" size={14} color={colors.textMuted} />}
                  onPress={onOpenProject}
                />
                <ForgeButton
                  title={previewable ? 'VIEW PREVIEW' : 'INSPECT FILES'}
                  size="md"
                  variant="forge"
                  icon={<Feather name="eye" size={14} color="#231005" />}
                  onPress={onViewPreview}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function forgeStatusLabel(status: 'pending' | 'pass' | 'fail' | 'skipped' | null): string {
  switch (status) {
    case 'pass': return 'passed';
    case 'fail': return 'failed';
    case 'skipped': return 'skipped';
    case 'pending': return 'pending';
    default: return '—';
  }
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const tone: Record<string, string> = {
    DEFAULT: colors.textMuted,
    ONLINE: colors.success,
    QUENCHED: colors.success,
    RUNNING: colors.success,
    FAILED: colors.danger,
    ERROR: colors.danger,
    UNSUPPORTED: colors.warning,
  };
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color: tone[value] ?? colors.textMuted }]}>{value}</Text>
    </View>
  );
}

function EngineNotice({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <View style={styles.notice}>
      <View style={styles.noticeRow}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Pressable onPress={onRetry} style={styles.noticeButton} accessibilityRole="button">
          <Text style={styles.noticeButtonText}>RETRY</Text>
        </Pressable>
      </View>
      <Text style={styles.noticeBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.xl,
    flexGrow: 1,
  },
  scrollWide: {
    justifyContent: 'center',
  },
  hero: {
    gap: spacing.sm,
  },
  heroTitle: {
    ...typography.display,
    color: colors.text,
    fontSize: 40,
  },
  heroSub: {
    ...typography.bodyMuted,
    fontSize: 16,
  },
  forgeArea: {
    flexDirection: 'column',
    gap: spacing.xl,
    alignItems: 'stretch',
  },
  forgeAreaWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blueprintPanel: {
    flex: 1,
    minWidth: 320,
  },
  blueprintInput: {
    minHeight: 220,
    textAlignVertical: 'top',
    padding: spacing.lg,
    fontSize: type.scale.lg,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.lg,
    lineHeight: type.scale.lg * 1.5,
  },
  blueprintDisabled: {
    opacity: 0.6,
  },
  forgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  forgeButton: {
    minWidth: 180,
  },
  cancelButton: {
    minWidth: 120,
  },
  strikerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  active: {
    flex: 1,
    minWidth: 160,
    gap: spacing.xs,
  },
  phase: {
    ...typography.label,
    color: colors.accent,
  },
  model: {
    ...typography.caption,
  },
  hint: {
    ...typography.caption,
    color: colors.textDim,
  },
  meta: {
    ...typography.caption,
    color: colors.accentGold,
  },
  logWrap: {
    gap: spacing.sm,
  },
  notice: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  noticeTitle: {
    ...typography.label,
    color: colors.danger,
  },
  noticeBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  noticeButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeButtonText: {
    ...typography.label,
    color: colors.danger,
    letterSpacing: 1,
  },
  headerPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.accentGold,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryTitle: {
    ...typography.heading,
    fontSize: 18,
    color: colors.accentGold,
  },
  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  statusLabel: {
    ...typography.caption,
    letterSpacing: 1,
    color: colors.textDim,
  },
  statusValue: {
    ...typography.label,
    letterSpacing: 0.8,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});