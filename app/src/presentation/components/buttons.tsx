import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/theme-context';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Primary action. 44pt minimum touch target (accessibility). */
export function PrimaryButton({ label, onPress, disabled, loading, style }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      // See the note in task-card.tsx: `accessibilityState` alone is invisible on web.
      aria-disabled={Boolean(isDisabled)}
      aria-busy={Boolean(loading)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled ? theme.colors.surfaceMuted : theme.colors.primary,
          opacity: pressed ? 0.85 : 1,
          minHeight: theme.layout.touchTarget,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={theme.colors.onPrimary} /> : null}
        <Text
          style={[styles.label, { color: isDisabled ? theme.colors.textSecondary : theme.colors.onPrimary }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, loading, style }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.primarySoft,
          opacity: pressed ? 0.85 : disabled ? 0.6 : 1,
          minHeight: theme.layout.touchTarget,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
        <Text style={[styles.label, { color: theme.colors.primary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function DangerButton({ label, onPress, disabled, loading, style }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.errorSoft,
          opacity: pressed ? 0.85 : 1,
          minHeight: theme.layout.touchTarget,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.error }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '600' },
});
