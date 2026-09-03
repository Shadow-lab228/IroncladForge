import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme';
import { ForgeHeader } from '../../src/components/layout/ForgeHeader';
import { ForgeButton, ForgePanel } from '../../src/components/forge';
import { FileTree } from '../../src/components/workspace/FileTree';
import { CodeViewer } from '../../src/components/workspace/CodeViewer';
import { PreviewPanel } from '../../src/components/workspace/PreviewPanel';
import { useWorkshopStore } from '../../src/store/workshopStore';
import { useProjectFiles } from '../../src/hooks/useProjectFiles';
import { useProjectPreview } from '../../src/hooks/useProjectPreview';

export default function ProjectScreen() {
  const { width } = useWindowDimensions();
  const workshop = useWorkshopStore();
  const active = workshop.projects.find((p) => p.id === workshop.activeProjectId);
  const projectId = active?.id ?? null;

  const files = useProjectFiles(projectId);
  const preview = useProjectPreview(projectId);

  // Detection comes from the engine session (lazily re-detected server-side).
  const session = workshop.activeSession?.projectId === projectId ? workshop.activeSession : null;
  const detection = session?.detection;

  const wide = width >= 1100;

  const onSelectFile = (path: string) => {
    void files.selectFile(path);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'right']}>
      <ForgeHeader
        title="Project"
        subtitle={active ? active.name : 'No active project'}
        forgeState={active ? (active.status === 'draft' ? 'blueprinted' : active.status) : 'idle'}
        right={
          active ? (
            <View style={styles.detect}>
              <Text style={styles.detectLabel}>PROJECT</Text>
              {detection ? (
                <Text style={styles.detectText} numberOfLines={1}>
                  {detection.framework} · {detection.language} · {detection.packageManager}
                </Text>
              ) : (
                <Text style={styles.detectText} numberOfLines={1}>IDLE</Text>
              )}
            </View>
          ) : null
        }
      />

      {!active ? (
        <View style={styles.empty}>
          <Feather name="folder" size={28} color={colors.textDim} />
          <Text style={styles.emptyText}>No project selected</Text>
          <Text style={styles.emptySub}>Name a blueprint in the Workshop, then quench it before opening the forge.</Text>
        </View>
      ) : (
        <View style={[styles.content, wide ? styles.contentRow : styles.contentColumn]}>
          <View style={[styles.pane, wide && styles.paneWide]}>
            <ForgePanel
              title="Files"
              style={styles.panelFull}
              bodyStyle={styles.panelBody}
              action={
                <ForgeButton
                  title="Refresh"
                  variant="ghost"
                  size="sm"
                  icon={<Feather name="refresh-cw" size={13} color={colors.textMuted} />}
                  onPress={() => void files.reload()}
                  disabled={files.loading}
                />
              }
            >
              <View style={styles.treeBody}>
                <FileTree
                  files={files.files}
                  loading={files.loading}
                  error={files.error}
                  selectedPath={files.selectedPath}
                  onSelect={onSelectFile}
                />
              </View>
            </ForgePanel>
          </View>

          <View style={[styles.pane, styles.paneMain, wide && styles.paneWide]}>
            <ForgePanel title="Editor" style={styles.panelFull} bodyStyle={styles.panelBody}>
              <View style={styles.editorBody}>
                {files.fileLoading ? (
                  <View style={styles.center}>
                    <Text style={styles.muted}>Reading file…</Text>
                  </View>
                ) : files.file ? (
                  <CodeViewer
                    path={files.file.path}
                    content={files.file.content}
                    size={files.file.size}
                    notFound={files.file.content === '' && files.file.size === 0}
                  />
                ) : (
                  <View style={styles.center}>
                    <Feather name="code" size={22} color={colors.textDim} />
                    <Text style={styles.muted}>Select a file to inspect its contents.</Text>
                  </View>
                )}
              </View>
            </ForgePanel>
          </View>

          <View style={[styles.pane, wide && styles.paneWide]}>
            <PreviewPanel
              preview={preview.preview ?? { status: 'IDLE', framework: detection?.framework ?? '', command: null, host: '127.0.0.1', port: null, url: null, error: null, logs: [], exitCode: null, pid: null }}
              busy={preview.busy}
              projectFramework={detection?.framework}
              onStart={() => void preview.start(active.id)}
              onStop={() => void preview.stop(active.id)}
              onRestart={() => void preview.restart(active.id)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  detect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceRaised,
  },
  detectLabel: {
    ...typography.caption,
    color: colors.textDim,
    letterSpacing: 1,
  },
  detectText: {
    ...typography.caption,
    color: colors.accentGold,
    fontFamily: 'Menlo',
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  contentRow: {
    flexDirection: 'row',
  },
  contentColumn: {
    flexDirection: 'column',
  },
  pane: {
    flex: 1,
    minWidth: 260,
  },
  paneWide: {
    minWidth: 280,
  },
  paneMain: {
    flex: 2,
  },
  panelFull: {
    flex: 1,
  },
  treeBody: {
    flex: 1,
  },
  editorBody: {
    flex: 1,
  },
  panelBody: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  muted: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
  emptySub: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});