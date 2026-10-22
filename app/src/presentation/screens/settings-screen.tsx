import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { services } from '../../app/services';
import type { ThemePreference } from '../../data/local/preferences';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { InlineNotice } from '../components/offline-banner';
import { Screen } from '../components/screen';
import { Card, Divider, Pill, SectionHeader } from '../components/ui';
import { SettingsController } from '../controllers/settings-controller';
import { formatRelativeTime } from '../format';
import { useStore } from '../state/observable-store';
import { useNow } from '../hooks/use-now';
import { useTheme } from '../theme/theme-context';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'Theo hệ thống' },
  { key: 'light', label: 'Sáng' },
  { key: 'dark', label: 'Tối' },
];

export function SettingsScreen() {
  const theme = useTheme();

  const controller = useMemo(
    () =>
      new SettingsController({
        config: services.config,
        taskRepository: services.taskRepository,
        cache: services.cache,
        network: services.network,
        clock: services.clock,
      }),
    [],
  );
  const state = useStore(controller);

  useFocusEffect(
    useCallback(() => {
      void controller.load();
    }, [controller]),
  );

  const now = useNow();

  const row = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  return (
    <Screen title="Cài đặt" subtitle="Giao diện, kết nối và dữ liệu ngoại tuyến">
      <SectionHeader title="Giao diện" />
      <Card style={{ gap: 10 }}>
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
          Chế độ màu được lưu trên thiết bị và giữ nguyên sau khi khởi động lại.
        </Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const selected = theme.preference === option.key;
            return (
              <Text
                key={option.key}
                onPress={() => theme.setPreference(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                aria-pressed={selected}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceMuted,
                    color: selected ? theme.colors.onPrimary : theme.colors.textSecondary,
                  },
                ]}
              >
                {option.label}
              </Text>
            );
          })}
        </View>
      </Card>

      <SectionHeader title="Kết nối & đồng bộ" />
      <Card style={{ gap: 12 }}>
        <View style={styles.statusRow}>
          <Pill
            label={state.online === null ? 'Đang kiểm tra…' : state.online ? '● Trực tuyến' : '● Ngoại tuyến'}
            color={state.online === false ? theme.colors.error : theme.colors.success}
            background={state.online === false ? theme.colors.errorSoft : theme.colors.successSoft}
          />
          <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
            {state.pending > 0 ? `${state.pending} thay đổi chờ đồng bộ` : 'Không có thay đổi chờ'}
          </Text>
        </View>

        <Divider />

        {row('API base URL', state.apiBaseUrl)}
        {row('Môi trường', state.environment)}
        {row('Timeout', `${state.timeoutMs} ms`)}
        {row(
          'Đồng bộ gần nhất',
          state.lastSyncAt ? formatRelativeTime(state.lastSyncAt, now) : 'Chưa đồng bộ trong phiên này',
        )}

        <PrimaryButton
          label="Đồng bộ ngay"
          onPress={() => void controller.syncNow()}
          loading={state.isSyncing}
        />

        {state.message ? (
          <InlineNotice tone="success" message={state.message} onDismiss={controller.dismissMessage} />
        ) : null}
        {state.error ? (
          <InlineNotice
            tone="error"
            message={state.error.userMessage}
            onDismiss={controller.dismissMessage}
          />
        ) : null}
      </Card>

      <SectionHeader title="Dữ liệu ngoại tuyến" />
      <Card style={{ gap: 10 }}>
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
          {state.cachedKeys.length === 0
            ? 'Chưa có dữ liệu nào được lưu trên máy.'
            : `Đang lưu ${state.cachedKeys.length} nhóm dữ liệu: ${state.cachedKeys.join(', ')}.`}
        </Text>
        <SecondaryButton
          label="Xoá dữ liệu lưu offline"
          onPress={() => void controller.clearCache()}
          loading={state.isClearing}
        />
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
          Chỉ xoá bản sao trên thiết bị. Công việc đang chờ đồng bộ vẫn được giữ lại.
        </Text>
      </Card>

      <SectionHeader title="Về ứng dụng" />
      <Card style={{ gap: 6 }}>
        <Text style={[styles.appName, { color: theme.colors.textPrimary }]}>StudyMate 1.0.0</Text>
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
          Đồ án môn Phát triển ứng dụng di động (INT1449) — PTIT. Dữ liệu trong bản demo lấy từ backend mock
          (json-server) trong thư mục backend/.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  helper: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  themeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  appName: { fontSize: 16, fontWeight: '700' },
});
