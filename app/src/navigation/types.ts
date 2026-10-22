import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  /** `courseId` is set when the screen is opened from a course card. */
  Tasks: { courseId?: number } | undefined;
  Timetable: undefined;
  Courses: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  TaskDetail: { taskId: string };
  TaskForm: { taskId?: string } | undefined;
};
