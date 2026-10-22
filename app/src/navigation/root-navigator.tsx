import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet } from 'react-native';

import { CoursesScreen } from '../presentation/screens/courses-screen';
import { HomeScreen } from '../presentation/screens/home-screen';
import { SettingsScreen } from '../presentation/screens/settings-screen';
import { TaskDetailScreen } from '../presentation/screens/task-detail-screen';
import { TaskFormScreen } from '../presentation/screens/task-form-screen';
import { TasksScreen } from '../presentation/screens/tasks-screen';
import { TimetableScreen } from '../presentation/screens/timetable-screen';
import { Icon, type IconName } from '../presentation/components/icons';
import { useTheme } from '../presentation/theme/theme-context';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Home: 'home',
  Tasks: 'tasks',
  Timetable: 'calendar',
  Courses: 'book',
  Settings: 'settings',
};

function Tabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <Icon name={TAB_ICONS[route.name]} size={22} color={color} strokeWidth={focused ? 2.1 : 1.7} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Hôm nay' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Công việc' }} />
      <Tab.Screen name="Timetable" component={TimetableScreen} options={{ title: 'Lịch học' }} />
      <Tab.Screen name="Courses" component={CoursesScreen} options={{ title: 'Môn học' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Cài đặt' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const base = theme.isDark ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...base,
        colors: {
          ...base.colors,
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.textPrimary,
          border: theme.colors.border,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: styles.headerTitle,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Chi tiết' }} />
        <Stack.Screen
          name="TaskForm"
          component={TaskFormScreen}
          options={{ title: 'Công việc', presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
});
