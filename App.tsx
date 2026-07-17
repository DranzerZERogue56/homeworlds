import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useGameStore } from './src/store/gameStore';
import { GameScreen } from './src/ui/GameScreen';
import { MenuScreen } from './src/ui/MenuScreen';
import { RulesScreen } from './src/ui/RulesScreen';
import { SettingsScreen } from './src/ui/SettingsScreen';
import { ReplayScreen } from './src/ui/ReplayScreen';
import { theme } from './src/ui/theme';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style="light" />
        {!hydrated ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : screen === 'menu' ? (
          <MenuScreen />
        ) : screen === 'replay' ? (
          <ReplayScreen />
        ) : screen === 'settings' ? (
          <SettingsScreen />
        ) : screen === 'rules' ? (
          <RulesScreen />
        ) : (
          <GameScreen />
        )}
      </View>
    </SafeAreaProvider>
  );
}
