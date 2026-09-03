
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme';
import { ForgeHeader } from '../../src/components/layout/ForgeHeader';
import { ForgeButton, ForgeLog, ForgePanel } from '../../src/components/forge';
import { useWorkshopStore } from '../../src/store/workshopStore';
import type { ActivityEntry } from '../../src/types';

const KIND_ICON: Record<ActivityEntry['kind'], keyof typeof Feather.glyphMap> = {
  forge: 'zap',
  build: 'cpu',
  agent: 'terminal',
  error: 'alert-triangle',
  system: 'info',
};

const SEVERITY_COLOR: Record<ActivityEntry['severity'], string> = {
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
  error: colors.danger,
};

export default function ActivityScreen() {
  const workshop = useWorkshopStore();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'right']}>
      <ForgeHeader
        title="Activity"
        subtitle="Forge activity · build status · agent operations"
        right={
          <ForgeButton
            title="Clear"
            variant="ghost"
            size="sm"
            onPress={workshop.clearActivity}
            disabled={workshop.activity.length === 0}
          />
        }
      />

      <View style={styles.content}>
        <View style={styles.listPanel}>
          <ForgePanel title="Activity Feed" raised style={styles.feed}>
            <FlatList
              data={workshop.activity}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Feather name="activity" size={28} color={colors.textDim} />
                  <Text style={styles.emptyText}>The forge has been quiet.</Text>
                  <Text style={styles.emptySub}>Forge activity, builds, and agent operations appear here.</Text>
                </View>
              }
              renderItem={({ item }) => <EntryRow entry={item} />}
            />
          </ForgePanel>
        </View>

        <ForgePanel title="Operation Log" style={styles.logPanel}>
          <ForgeLog
            lines={workshop.activity
              .filter((a) => a.body)
              .slice(0, 40)
              .map((a) => a.body ?? '')}
            emptyText="No operation output yet. Forge something."
          />
        </ForgePanel>
      </View>
    </SafeAreaView>
  );
}

function EntryRow({ entry }: { entry: ActivityEntry }) {
  const color = SEVERITY_COLOR[entry.severity];
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { borderColor: color }]}>
        <Feather name={KIND_ICON[entry.kind]} size={15} color={color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{entry.title}</Text>
        {entry.body ? <Text style={styles.rowBodyText} numberOfLines={2}>{entry.body}</Text> : null}
      </View>
      <Text style={styles.rowTime}>{time}</Text>
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
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  listPanel: {
    flex: 3,
    minWidth: 300,
  },
  feed: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
  emptySub: {
    ...typography.caption,
    textAlign: 'center',
  },
  logPanel: {
    flex: 2,
    minWidth: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  rowBodyText: {
    ...typography.caption,
    color: colors.textDim,
  },
  rowTime: {
    ...typography.caption,
    color: colors.textDim,
  },
});
