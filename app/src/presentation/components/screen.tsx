import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-context';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  padded?: boolean;
};

/**
 * Screen shell: safe area, background token, optional scroll + pull-to-refresh and a
 * consistent header. Every screen uses this so spacing and typography stay uniform.
 */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  title,
  subtitle,
  headerRight,
  padded = true,
}: ScreenProps) {
  const theme = useTheme();

  const content = (
    <View
      style={[
        styles.inner,
        // Caps the reading width on tablets/landscape/web (docs/ui-design.md §7).
        { width: '100%', maxWidth: theme.layout.maxContentWidth, alignSelf: 'center' },
        padded && { paddingHorizontal: theme.layout.screenPadding },
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  inner: { flex: 1, gap: 16, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 13 },
});
