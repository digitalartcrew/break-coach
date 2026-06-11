import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Learn: undefined;
  Progress: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Record: { skillId: string };
  Result: { sessionId: string };
};
