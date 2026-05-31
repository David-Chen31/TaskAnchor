export type AppSettings = {
  task: string;
  focusMinutes: number;
  reminderMinutes: number;
  alwaysOnTop: boolean;
  expandedWidth: number;
  expandedHeight: number;
};

export type TimerStatus = "idle" | "running" | "paused" | "finished";
