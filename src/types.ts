export type AppSettings = {
  task: string;
  focusMinutes: number;
  reminderMinutes: number;
  alwaysOnTop: boolean;
  autostart: boolean;
};

export type TimerStatus = "idle" | "running" | "paused" | "finished";

export type PromptState =
  | {
      kind: "reminder";
      message: string;
    }
  | {
      kind: "complete";
      message: string;
    };
