import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Anchor,
  Pause,
  Play,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentSettings } from "./hooks/usePersistentSettings";
import type { TimerStatus } from "./types";
import { formatCountdown } from "./utils/time";

const REMINDER_PULSE_MS = 2200;
const COMMITMENT_FLASH_MS = 1500;
const IDLE_COLLAPSE_MS = 0;
const RESIZE_PERSIST_DEBOUNCE_MS = 400;
const SETTINGS_PANEL_HEIGHT = 268;
const COLLAPSED_WIDTH = 240;
const COLLAPSED_HEIGHT = 30;

type Mode = "collapsed" | "expanded";

function callTauri(command: string, args: Record<string, unknown>) {
  void invoke(command, args).catch(() => {});
}

function startWindowDrag(event: React.PointerEvent<HTMLElement>) {
  if (event.button !== 0) {
    return;
  }

  void getCurrentWindow().startDragging().catch(() => {});
}

function DragStrip({ className = "" }: { className?: string }) {
  return (
    <div
      data-tauri-drag-region
      onPointerDown={startWindowDrag}
      title="拖动窗口"
      className={`cursor-grab select-none active:cursor-grabbing ${className}`}
    />
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled = false,
  quiet = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${
        quiet
          ? "text-slate-400 hover:bg-stone-100 hover:text-slate-700"
          : "border border-stone-200 bg-white text-slate-700 shadow-sm hover:bg-teal-50 hover:text-teal-800"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-teal-700" : "bg-stone-300"
      } disabled:opacity-40`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function SettingsPanel({
  task,
  focusMinutes,
  reminderMinutes,
  alwaysOnTop,
  onTaskChange,
  onFocusMinutesChange,
  onReminderMinutesChange,
  onAlwaysOnTopChange,
  onClose,
}: {
  task: string;
  focusMinutes: number;
  reminderMinutes: number;
  alwaysOnTop: boolean;
  onTaskChange: (task: string) => void;
  onFocusMinutesChange: (minutes: number) => void;
  onReminderMinutesChange: (minutes: number) => void;
  onAlwaysOnTopChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-3 py-2">
      <div className="mb-2 flex h-7 items-center gap-2">
        <DragStrip className="flex h-full flex-1" />
        <span className="shrink-0 text-[12px] font-medium text-slate-500">
          设置
        </span>
        <IconButton label="关闭设置" onClick={onClose} quiet>
          <X size={15} />
        </IconButton>
      </div>

      <div className="space-y-2 text-[12px] text-slate-700">
        <label className="block">
          <span className="mb-1 block font-medium">当前任务</span>
          <input
            value={task}
            onChange={(event) => onTaskChange(event.target.value)}
            className="h-8 w-full rounded-md border border-black/[0.08] bg-white px-2 text-[13px] font-medium text-slate-950 outline-none focus:border-teal-600"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block font-medium">专注时长</span>
            <div className="flex h-8 items-center rounded-md border border-black/[0.08] bg-white px-2 focus-within:border-teal-600">
              <input
                type="number"
                min={1}
                max={180}
                value={focusMinutes}
                onChange={(event) =>
                  onFocusMinutesChange(Number(event.target.value))
                }
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <span className="shrink-0 text-[11px] text-slate-500">分钟</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block font-medium">提醒间隔</span>
            <select
              value={reminderMinutes}
              onChange={(event) =>
                onReminderMinutesChange(Number(event.target.value))
              }
              className="h-8 w-full rounded-md border border-black/[0.08] bg-white px-2 text-[13px] outline-none focus:border-teal-600"
            >
              <option value={3}>3 分钟</option>
              <option value={5}>5 分钟</option>
              <option value={10}>10 分钟</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="font-medium">始终置顶</span>
          <Toggle checked={alwaysOnTop} onChange={onAlwaysOnTopChange} />
        </div>

        <p className="pt-1 text-[11px] leading-snug text-slate-400">
          Ctrl+Alt+J 可在任何应用里把窗口召唤到最前。
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const {
    settings,
    setTask,
    setFocusMinutes,
    setReminderMinutes,
    setAlwaysOnTop,
    setExpandedSize,
  } = usePersistentSettings();

  const initialSeconds = useMemo(
    () => settings.focusMinutes * 60,
    [settings.focusMinutes],
  );
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("idle");
  const [editing, setEditing] = useState(false);
  const [draftTask, setDraftTask] = useState(settings.task);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [completePromptOpen, setCompletePromptOpen] = useState(false);
  const [reminderPulse, setReminderPulse] = useState(false);
  const [commitmentFlash, setCommitmentFlash] = useState(false);
  const [mode, setMode] = useState<Mode>("expanded");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextReminderAtRef = useRef<number>(
    Date.now() + settings.reminderMinutes * 60 * 1000,
  );
  const resizePersistTimerRef = useRef<number | null>(null);
  const lastRequestedSizeRef = useRef<{ width: number; height: number }>({
    width: settings.expandedWidth,
    height: settings.expandedHeight,
  });
  const guardRef = useRef(false);

  const guardForceExpanded = editing || settingsOpen || completePromptOpen;
  guardRef.current = guardForceExpanded;

  useEffect(() => {
    if (timerStatus === "idle") {
      setRemainingSeconds(initialSeconds);
    }
  }, [initialSeconds, timerStatus]);

  useEffect(() => {
    callTauri("set_always_on_top", { enabled: settings.alwaysOnTop });
  }, [settings.alwaysOnTop]);

  // Mode → window size sync
  useEffect(() => {
    if (mode === "collapsed") {
      lastRequestedSizeRef.current = {
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
      };
      callTauri("set_window_size", {
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
      });
    } else {
      const height = settingsOpen
        ? SETTINGS_PANEL_HEIGHT
        : settings.expandedHeight;
      lastRequestedSizeRef.current = {
        width: settings.expandedWidth,
        height,
      };
      callTauri("set_window_size", {
        width: settings.expandedWidth,
        height,
      });
    }
  }, [
    mode,
    settings.expandedWidth,
    settings.expandedHeight,
    settingsOpen,
  ]);

  // Idle watch (Rust polls global cursor; emits taskanchor://idle after 1s outside)
  useEffect(() => {
    if (mode === "expanded" && !guardForceExpanded) {
      callTauri("enable_idle_watch", { idleMs: IDLE_COLLAPSE_MS });
    } else {
      callTauri("disable_idle_watch", {});
    }
  }, [mode, guardForceExpanded]);

  // Listen for idle event from Rust polling thread
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen("taskanchor://idle", () => {
      if (guardRef.current) {
        return;
      }
      setMode((current) => (current === "expanded" ? "collapsed" : current));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, []);

  // Force expanded while any modal-like UI is open
  useEffect(() => {
    if (guardForceExpanded && mode !== "expanded") {
      setMode("expanded");
    }
  }, [guardForceExpanded, mode]);

  useEffect(() => {
    if (editing) {
      setDraftTask(settings.task);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, settings.task]);

  useEffect(() => {
    if (timerStatus !== "running") {
      return;
    }

    const tick = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setTimerStatus("finished");
          setCompletePromptOpen(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [timerStatus]);

  function rescheduleNextReminder() {
    nextReminderAtRef.current =
      Date.now() + settings.reminderMinutes * 60 * 1000;
  }

  useEffect(() => {
    rescheduleNextReminder();
  }, [settings.reminderMinutes, settings.task]);

  useEffect(() => {
    const checker = window.setInterval(() => {
      if (settingsOpen || editing || completePromptOpen) {
        return;
      }

      if (Date.now() >= nextReminderAtRef.current) {
        rescheduleNextReminder();
        setReminderPulse(true);
      }
    }, 1000);

    return () => window.clearInterval(checker);
  }, [completePromptOpen, editing, settingsOpen]);

  useEffect(() => {
    if (!reminderPulse) {
      return;
    }

    const timeout = window.setTimeout(
      () => setReminderPulse(false),
      REMINDER_PULSE_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [reminderPulse]);

  useEffect(() => {
    if (!commitmentFlash) {
      return;
    }

    const timeout = window.setTimeout(
      () => setCommitmentFlash(false),
      COMMITMENT_FLASH_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [commitmentFlash]);

  // Global shortcut → expand & focus
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen("taskanchor://summon", () => {
      setMode("expanded");
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, []);

  // Persist user-driven resize of expanded window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    getCurrentWindow()
      .onResized(({ payload }) => {
        if (mode !== "expanded" || settingsOpen) {
          return;
        }

        const scale = window.devicePixelRatio || 1;
        const logicalWidth = payload.width / scale;
        const logicalHeight = payload.height / scale;
        const last = lastRequestedSizeRef.current;

        if (
          Math.abs(logicalWidth - last.width) < 2 &&
          Math.abs(logicalHeight - last.height) < 2
        ) {
          return;
        }

        if (resizePersistTimerRef.current !== null) {
          window.clearTimeout(resizePersistTimerRef.current);
        }

        resizePersistTimerRef.current = window.setTimeout(() => {
          setExpandedSize(
            Math.round(logicalWidth),
            Math.round(logicalHeight),
          );
        }, RESIZE_PERSIST_DEBOUNCE_MS);
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
      if (resizePersistTimerRef.current !== null) {
        window.clearTimeout(resizePersistTimerRef.current);
        resizePersistTimerRef.current = null;
      }
    };
  }, [mode, settingsOpen, setExpandedSize]);

  function commitTask() {
    setTask(draftTask);
    setEditing(false);
  }

  function cancelEditing() {
    setDraftTask(settings.task);
    setEditing(false);
  }

  function startOrPause() {
    if (timerStatus === "running") {
      setTimerStatus("paused");
      return;
    }

    if (remainingSeconds <= 0) {
      setRemainingSeconds(initialSeconds);
    }

    setReminderPulse(false);
    setCommitmentFlash(true);
    rescheduleNextReminder();
    setTimerStatus("running");
  }

  function resetTimer() {
    setTimerStatus("idle");
    setRemainingSeconds(initialSeconds);
    setReminderPulse(false);
    setCompletePromptOpen(false);
    rescheduleNextReminder();
  }

  function continueTask() {
    setRemainingSeconds(initialSeconds);
    setCompletePromptOpen(false);
    rescheduleNextReminder();
    setCommitmentFlash(true);
    setTimerStatus("running");
  }

  function changeTaskAfterRound() {
    setCompletePromptOpen(false);
    setTimerStatus("idle");
    setRemainingSeconds(initialSeconds);
    setEditing(true);
  }

  function handleAlwaysOnTopChange(enabled: boolean) {
    setAlwaysOnTop(enabled);
    callTauri("set_always_on_top", { enabled });
  }

  function collapseIfAllowed() {
    if (mode === "expanded" && !guardRef.current) {
      setMode("collapsed");
    }
  }

  const edgeColor = reminderPulse
    ? "bg-amber-400"
    : timerStatus === "running"
      ? "bg-teal-500"
      : timerStatus === "finished"
        ? "bg-amber-400"
        : timerStatus === "paused"
          ? "bg-stone-400"
          : "bg-stone-200";

  const titleClass = commitmentFlash
    ? "scale-[1.18] text-teal-700"
    : reminderPulse
      ? "scale-[1.03] text-amber-800"
      : "scale-100 text-slate-950";

  if (mode === "collapsed") {
    return (
      <div className="h-screen w-screen overflow-hidden bg-transparent p-[3px] font-sans text-slate-900">
        <section className="relative h-full overflow-hidden rounded-full border border-black/[0.06] bg-stone-50/[0.85] shadow-quiet backdrop-blur-lg">
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-colors duration-500 ${edgeColor}`}
          />
          <div
            className={`flex h-full items-center transition-colors duration-500 ${
              reminderPulse ? "bg-amber-100/60" : "bg-transparent"
            }`}
          >
            <div
              data-tauri-drag-region
              onPointerDown={startWindowDrag}
              title="拖动以移动窗口"
              className="flex h-full w-12 shrink-0 cursor-grab items-center justify-center bg-stone-200/50 transition-colors hover:bg-stone-300/60 active:cursor-grabbing"
            >
              <Anchor
                size={14}
                aria-hidden
                className="pointer-events-none text-teal-700"
              />
            </div>
            <button
              type="button"
              title="点击展开窗口"
              aria-label="展开窗口"
              onClick={() => setMode("expanded")}
              className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left hover:bg-stone-100/40"
            >
              <span
                className={`min-w-0 flex-1 truncate text-[12px] font-medium leading-none transition-colors ${
                  reminderPulse ? "text-amber-800" : "text-slate-700"
                }`}
              >
                {settings.task}
              </span>
              <span className="shrink-0 tabular-nums text-[12px] font-medium leading-none text-[#62572f]">
                {formatCountdown(remainingSeconds)}
              </span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-transparent p-1.5 font-sans text-slate-900"
      onPointerLeave={collapseIfAllowed}
    >
      <section
        className="group relative h-full overflow-hidden rounded-xl border border-black/[0.06] bg-stone-50/[0.85] shadow-quiet backdrop-blur-lg"
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-colors duration-500 ${edgeColor}`}
        />

        {settingsOpen ? (
          <SettingsPanel
            task={settings.task}
            focusMinutes={settings.focusMinutes}
            reminderMinutes={settings.reminderMinutes}
            alwaysOnTop={settings.alwaysOnTop}
            onTaskChange={setTask}
            onFocusMinutesChange={(minutes) => {
              setTimerStatus("idle");
              setFocusMinutes(minutes);
            }}
            onReminderMinutesChange={setReminderMinutes}
            onAlwaysOnTopChange={handleAlwaysOnTopChange}
            onClose={() => setSettingsOpen(false)}
          />
        ) : (
          <div className="relative flex h-full flex-col gap-1 px-3 pb-2 pt-3">
            <DragStrip className="absolute inset-x-0 top-0 h-7" />

            <div className="flex flex-col">
              {editing ? (
                <div className="space-y-1">
                  <input
                    ref={inputRef}
                    aria-label="编辑当前任务"
                    placeholder="写下你现在要做的一件事"
                    value={draftTask}
                    onChange={(event) => setDraftTask(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitTask();
                      }

                      if (event.key === "Escape") {
                        cancelEditing();
                      }
                    }}
                    onBlur={commitTask}
                    className="h-9 w-full rounded-md border border-teal-600 bg-white px-2 text-[18px] font-semibold leading-none text-slate-950 outline-none"
                  />
                  <p className="px-0.5 text-[10px] text-slate-400">
                    Enter 保存 · Esc 取消
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  title="编辑当前任务"
                  onClick={() => setEditing(true)}
                  className={`block w-full min-w-0 origin-left rounded-md text-left transition-all duration-300 ease-out ${titleClass}`}
                >
                  <span className="block truncate text-[22px] font-semibold leading-snug tracking-tight">
                    {settings.task}
                  </span>
                </button>
              )}
            </div>

            <DragStrip className="min-h-[8px] flex-1" />

            <div className="flex h-9 items-center justify-between gap-3">
              <div className="tabular-nums text-[22px] font-semibold leading-none text-[#62572f]">
                {formatCountdown(remainingSeconds)}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {(timerStatus === "paused" ||
                  timerStatus === "finished" ||
                  remainingSeconds !== initialSeconds) && (
                  <IconButton label="重置" onClick={resetTimer} quiet>
                    <RotateCcw size={15} />
                  </IconButton>
                )}
                <button
                  type="button"
                  onClick={startOrPause}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-teal-800"
                >
                  {timerStatus === "running" ? (
                    <>
                      <Pause size={14} />
                      暂停
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      开始
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              title="设置"
              aria-label="设置"
              onClick={() => setSettingsOpen(true)}
              className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded text-slate-300 opacity-50 transition hover:bg-stone-100 hover:text-slate-700 group-hover:opacity-100"
            >
              <Settings size={13} />
            </button>
          </div>
        )}

        {completePromptOpen && (
          <div className="absolute inset-x-2 bottom-2 z-20 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-slate-800 shadow-sm">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug">
                这一轮完成了吗？继续当前任务还是换任务？
              </p>
              <button
                type="button"
                title="关闭"
                aria-label="关闭"
                onClick={() => setCompletePromptOpen(false)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-500 hover:bg-amber-100 hover:text-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={continueTask}
                className="h-7 rounded-md bg-teal-700 px-3 text-[12px] font-medium text-white hover:bg-teal-800"
              >
                继续
              </button>
              <button
                type="button"
                onClick={changeTaskAfterRound}
                className="h-7 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-stone-50"
              >
                换任务
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
