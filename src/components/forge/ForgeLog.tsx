
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, type } from '../../theme/tokens';

interface ForgeLogProps {
  /** Monospace log lines, e.g. forge/build output. */
  lines: string[];
  emptyText?: string;
}

/** Scrollable monospace forge/activity log. */
export function ForgeLog({ lines, emptyText = 'The forge is quiet.' }: ForgeLogProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {lines.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        lines.map((line, i) => (
          <Text key={i} style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0806',
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.md,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  line: {
    fontFamily: type.mono,
    fontSize: type.scale.sm,
    color: colors.textMuted,
  },
  empty: {
    fontFamily: type.mono,
    fontSize: type.scale.sm,
    color: colors.textDim,
    fontStyle: 'italic',
  },
});
