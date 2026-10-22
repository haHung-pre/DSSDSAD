import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { services } from './src/app/services';
import { RootNavigator } from './src/navigation/root-navigator';
import { useAutoSync } from './src/presentation/hooks/use-auto-sync';
import { ThemeProvider, useTheme } from './src/presentation/theme/theme-context';

function AppShell() {
  const theme = useTheme();
  useAutoSync();

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider preferences={services.preferences}>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
