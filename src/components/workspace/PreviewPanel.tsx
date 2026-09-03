/**
 * PreviewPanel — live preview viewport for a forged project (Phase 4).
 *
 * Renders the dev server URL the engine reported (RUNNING only). On web the
 * preview is an inline <iframe>; on native it uses react-native-webview.
 * Provides: Start / Stop / Restart controls, an Open-in-browser escape hatch,
 * honest UNSUPPORTED / ERROR states, and expandable logs ("Inspect Logs").
 */

import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing, type } from '../../theme/tokens';
import { typography } from '../../theme';
import { ForgeButton } from '../forge/ForgeButton';
import type { ProjectPreview } from '../../store/previewStore';

interface PreviewPanelProps {
  preview: ProjectPreview;
  /** Whether a preview action is in-flight (disable controls). */
  busy: boolean;
  projectFramework?: string;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

function statusColor(status: ProjectPreview['status']): string {
  switch (status) {
    case 'RUNNING':
      return colors.success;
    case 'STARTING':
    case 'DETECTING':
      return colors.accent;
    case 'ERROR':
    case 'UNSUPPORTED':
      return colors.danger;
    case 'STOPPED':
    case 'IDLE':
    default:
      return colors.textDim;
  }
}

/** Render an embedded live preview of a running dev server. */
function PreviewFrame({ url }: { url: string }) {
  if (Platform.OS === 'web') {
    return (
      // react-native-web supports iframe directly; sandbox keeps the app's code contained.
      <iframe
        src={url}
        style={{ flex: 1, width: '100%', height: '100%', border: 0, backgroundColor: '#fff' }}
        title="Live preview"
      />
    );
  }
  const { default: WebView } = require('react-native-webview') as typeof import('react-native-webview');
  return <WebView source={{ uri: url }} style={styles.webview} originWhitelist={['*']} />;
}

export function PreviewPanel({ preview, busy, projectFramework, onStart, onStop, onRestart }: PreviewPanelProps) {
  const [showLogs, setShowLogs] = useState(false);
  const color = statusColor(preview.status);
  const running = preview.status === 'RUNNING';
  const starting = preview.status === 'STARTING' || preview.status === 'DETECTING';
  const stop = preview.status === 'STOPPING';

  // Keep a live-refresh poll while a preview is starting (engine warm-up).
  useEffect(() => {
    setShowLogs(false);
  }, [preview.url]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{preview.status}</Text>
          {preview.port ? <Text style={styles.portText}>:{preview.port}</Text> : null}
          {projectFramework ? <Text style={styles.frameText}>{projectFramework}</Text> : null}
        </View>
        {running && preview.url ? (
          <Pressable
            onPress={() => Linking.openURL(preview.url ?? '')}
            accessibilityRole="link"
            style={({ pressed }) => [styles.openBtn, pressed && styles.pressed]}
          >
            <Feather name="external-link" size={13} color={colors.accent} />
            <Text style={styles.openText}>Open</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.viewport}>
        {running && preview.url ? (
          <PreviewFrame url={preview.url} />
        ) : starting ? (
          <View style={styles.center}>
            <Feather name="loader" size={20} color={colors.accent} />
            <Text style={styles.centerTitle}>Igniting the dev server…</Text>
            <Text style={styles.centerSub}>{preview.command}</Text>
          </View>
        ) : preview.status === 'ERROR' ? (
          <View style={styles.center}>
            <Feather name="alert-triangle" size={20} color={colors.danger} />
            <Text style={styles.centerTitle}>{preview.error ?? 'Preview failed to start.'}</Text>
            {preview.exitCode ? <Text style={styles.centerSub}>exit code {preview.exitCode}</Text> : null}
          </View>
        ) : preview.status === 'UNSUPPORTED' ? (
          <View style={styles.center}>
            <Feather name="slash" size={20} color={colors.textDim} />
            <Text style={styles.centerTitle}>
              {preview.error ?? 'This project cannot be previewed on this platform.'}
            </Text>
          </View>
        ) : preview.status === 'STOPPED' ? (
          <View style={styles.center}>
            <Feather name="square" size={18} color={colors.textDim} />
            <Text style={styles.centerTitle}>Preview stopped</Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Feather name="play-circle" size={22} color={colors.textDim} />
            <Text style={styles.centerTitle}>Start the dev server to preview your app.</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {!running && !starting && !stop ? (
          <ForgeButton title="Start Preview" variant="forge" size="sm" icon={<Feather name="play" size={13} color="#231005" />} onPress={onStart} loading={busy} />
        ) : null}
        {running && (
          <ForgeButton title={stop ? 'Stopping…' : 'Stop'} variant="secondary" size="sm" onPress={onStop} disabled={busy} />
        )}
        {running && (
          <ForgeButton title="Restart" variant="ghost" size="sm" icon={<Feather name="refresh-cw" size={13} color={colors.textMuted} />} onPress={onRestart} disabled={busy} />
        )}
        {preview.logs.length > 0 && (
          <Pressable onPress={() => setShowLogs((s) => !s)} style={({ pressed }) => [styles.logsBtn, pressed && styles.pressed]}>
            <Feather name={showLogs ? 'chevrons-up' : 'chevrons-down'} size={13} color={colors.textMuted} />
            <Text style={styles.logsText}>{showLogs ? 'Hide logs' : 'Inspect Logs'}</Text>
          </Pressable>
        )}
      </View>

      {showLogs && (
        <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
          {preview.logs.map((line, i) => (
            <Text key={i} style={styles.logLine} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceRaised,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.label,
    letterSpacing: 1,
  },
  portText: {
    fontFamily: type.mono,
    fontSize: type.scale.xs,
    color: colors.textDim,
  },
  frameText: {
    ...typography.caption,
    color: colors.textDim,
    fontStyle: 'italic',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  openText: {
    ...typography.caption,
    color: colors.accent,
  },
  viewport: {
    flex: 1,
    backgroundColor: '#0d0b09',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  centerTitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
  },
  centerSub: {
    ...typography.caption,
    color: colors.textDim,
    fontFamily: type.mono,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  logsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginLeft: 'auto',
  },
  logsText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  logContainer: {
    maxHeight: 120,
    backgroundColor: '#0a0806',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  logContent: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  logLine: {
    fontFamily: type.mono,
    fontSize: type.scale.xs,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});