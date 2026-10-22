import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/theme-context';

export type ChipOption<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

/** Horizontal single-select chips (filters, form selectors). */
export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
}) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
        const isSelected = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            aria-pressed={isSelected}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
                minHeight: 36,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? theme.colors.onPrimary : theme.colors.textSecondary },
              ]}
            >
              {option.label}
              {typeof option.count === 'number' ? ` ${option.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2, paddingRight: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});
