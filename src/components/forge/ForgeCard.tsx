import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme';

interface ForgeCardProps extends ViewProps {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

/** A raised 'steel plate' card used for project/activity summary. */
export function ForgeCard({ icon, title, subtitle, footer, children, style, ...rest }: ForgeCardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      <View style={styles.inner}>
        {icon || title || subtitle ? (
          <View style={styles.head}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            {title ? (
              <View style={styles.textWrap}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {children ? <View style={styles.body}>{children}</View> : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 3,
  },
  inner: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.rivet,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.subheading,
  },
  subtitle: {
    ...typography.caption,
  },
  body: {
    gap: spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
});
