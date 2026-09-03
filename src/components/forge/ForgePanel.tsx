import React from 'react';
import { StyleSheet, Text, View, ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme';

interface ForgePanelProps extends ViewProps {
  title?: string;
  /** Raised steel surface instead of flat iron. */
  raised?: boolean;
  action?: React.ReactNode;
  /** Applied to the inner body view (e.g. flex to fill the panel). */
  bodyStyle?: StyleProp<ViewStyle>;
}

/** A bordered metal panel with engraved header. */
export function ForgePanel({ title, raised, action, children, style, bodyStyle, ...rest }: ForgePanelProps) {
  return (
    <View
      style={[styles.panel, raised ? styles.raised : null, style]}
      {...rest}
    >
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {action}
        </View>
      ) : null}
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  raised: {
    backgroundColor: colors.surfaceRaised,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    ...typography.label,
    color: colors.textMuted,
  },
  body: {
    padding: spacing.lg,
  },
});
