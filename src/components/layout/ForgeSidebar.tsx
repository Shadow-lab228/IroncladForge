
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, layout, radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme';
import { Anvil } from '../forge/ForgeIcons';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: keyof typeof Feather.glyphMap;
}

const NAV: NavItem[] = [
  { key: 'workshop', label: 'Workshop', href: '/(forge)/workshop', icon: 'layers' },
  { key: 'forge', label: 'Forge', href: '/(forge)/forge', icon: 'zap' },
  { key: 'project', label: 'Project', href: '/(forge)/project', icon: 'folder' },
  { key: 'activity', label: 'Activity', href: '/(forge)/activity', icon: 'activity' },
  { key: 'settings', label: 'Settings', href: '/(forge)/settings', icon: 'sliders' },
];

/** Left navigation rail + sidebar for the desktop-oriented shell. */
export function ForgeSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <Anvil size={30} color={colors.accent} />
        <View>
          <Text style={styles.brandName}>IRONCLAD</Text>
          <Text style={styles.brandSub}>FORGE</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.nav}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.href as never)}
              style={[styles.navItem, active && styles.navItemActive]}
              accessibilityRole="button"
            >
              <Feather
                name={item.icon}
                size={18}
                color={active ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <View style={styles.foot}>
        <Feather name="github" size={16} color={colors.textDim} />
        <Text style={styles.footText}>LOCAL FIRST</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: layout.sidebarWidth,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  brandName: {
    ...typography.label,
    color: colors.text,
    fontSize: 15,
  },
  brandSub: {
    ...typography.caption,
    color: colors.accentGold,
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  nav: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.rivet,
  },
  navLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
  },
  navLabelActive: {
    color: colors.text,
  },
  spacer: {
    flex: 1,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  footText: {
    ...typography.caption,
    color: colors.textDim,
    letterSpacing: 1.2,
  },
});
