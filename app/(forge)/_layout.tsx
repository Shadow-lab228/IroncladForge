import { Stack } from 'expo-router';
import { View } from 'react-native';
import { ForgeSidebar } from '../../src/components/layout/ForgeSidebar';
import { colors } from '../../src/theme/tokens';
import { useEngineConnection } from '../../src/hooks/useEngineConnection';

export default function ForgeLayout() {
  // One bounded engine-health monitor for the whole forge section.
  useEngineConnection();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <ForgeSidebar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background, flex: 1 },
        }}
      />
    </View>
  );
}
