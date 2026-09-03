import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing } from '../../theme/tokens';
import { typography } from '../../theme';
import { ForgeStatus } from '../forge/ForgeStatus';

interface ForgeHeaderProps {
  title: string;
  subtitle?: string;
  /** Forge engine state shown as a status pill, if provided. */
  forgeState?: string;
  right?: React.ReactNode;
}

/** Top steel rail with the current section title + forge state. */
export function ForgeHeader({ title, subtitle, forgeState, right }: ForgeHeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {forgeState ? <ForgeStatus state={forgeState} /> : null}
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.iron,
  },
  title: {
    ...typography.heading,
    fontSize: 18,
  },
  subtitle: {
    ...typography.caption,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
