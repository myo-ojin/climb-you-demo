export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  isDummy?: boolean;
}

export interface User {
  id: string;
  name: string;
  level: number;
  progress: number;
}

export type RootStackParamList = {
  Main: undefined;
  Tasks: undefined;
  AddTask: undefined;
  Profile: undefined;
  Settings: undefined;
};