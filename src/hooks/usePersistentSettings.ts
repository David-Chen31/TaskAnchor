import { useEffect, useMemo, useState } from "react";
import type { AppSettings } from "../types";
import { clampNumber } from "../utils/time";

const STORAGE_KEY = "task-anchor:settings:v1";

export const DEFAULT_SETTINGS: AppSettings = {
  task: "写 A 作业",
  focusMinutes: 25,
  reminderMinutes: 5,
  alwaysOnTop: true,
  expandedWidth: 320,
  expandedHeight: 124,
};

function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  const task = typeof value.task === "string" ? value.task.trim() : "";
  const widthCandidate = Number(value.expandedWidth);
  const heightCandidate = Number(value.expandedHeight);

  return {
    task: task || DEFAULT_SETTINGS.task,
    focusMinutes: clampNumber(Number(value.focusMinutes), 1, 180),
    reminderMinutes: clampNumber(Number(value.reminderMinutes), 1, 60),
    alwaysOnTop:
      typeof value.alwaysOnTop === "boolean"
        ? value.alwaysOnTop
        : DEFAULT_SETTINGS.alwaysOnTop,
    expandedWidth: Number.isFinite(widthCandidate)
      ? clampNumber(widthCandidate, 240, 1200)
      : DEFAULT_SETTINGS.expandedWidth,
    expandedHeight: Number.isFinite(heightCandidate)
      ? clampNumber(heightCandidate, 140, 800)
      : DEFAULT_SETTINGS.expandedHeight,
  };
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function usePersistentSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const api = useMemo(
    () => ({
      setTask(task: string) {
        setSettings((current) => normalizeSettings({ ...current, task }));
      },
      setFocusMinutes(focusMinutes: number) {
        setSettings((current) =>
          normalizeSettings({ ...current, focusMinutes }),
        );
      },
      setReminderMinutes(reminderMinutes: number) {
        setSettings((current) =>
          normalizeSettings({ ...current, reminderMinutes }),
        );
      },
      setAlwaysOnTop(alwaysOnTop: boolean) {
        setSettings((current) =>
          normalizeSettings({ ...current, alwaysOnTop }),
        );
      },
      setExpandedSize(expandedWidth: number, expandedHeight: number) {
        setSettings((current) =>
          normalizeSettings({ ...current, expandedWidth, expandedHeight }),
        );
      },
    }),
    [],
  );

  return { settings, setSettings, ...api };
}
