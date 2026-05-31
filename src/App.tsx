import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  GripHorizontal,
  Pause,
  Play,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentSettings } from "./hooks/usePersistentSettings";
import type { PromptState, TimerStatus } from "./types";
import { formatCountdown } from "./utils/time";

const REMINDER_VISIBLE_MS = 7000;

function callTauri(command: string, args: Record<string, unknown>) {
  void invoke(command, args).catch(() => {
    // Browser preview still works; Tauri-only commands are best effort.
  });
}

function startWindowDrag(event: React.PointerEvent<HTMLElement>) {
  if (event.button !== 0) {
    return;
  }

  void getCurrentWindow().startDragging().catch(() => {
    // Dragging only exists inside Tauri.
  });
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
          ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          : "border border-stone-200 bg-white text-slate-700 shadow-sm hover:bg-teal-50 hover:text-teal-800"
      }`}
    >
      {children}
    </button>
  );
}

function DragHandle({ label = "拖动窗口" }: { label?: string }) {
  return (
    <div
      data-tauri-drag-region
      title={label}
      onPointerDown={startWindowDrag}
      className="flex h-7 flex-1 cursor-grab select-none items-center text-slate-300 active:cursor-grabbing"
    >
      <GripHorizontal
        size={18}
        aria-hidden="true"
        className="pointer-events-none"
      />
    </div>
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

function PromptOverlay({
  prompt,
  onClose,
  onContinue,
  onChangeTask,
}: {
  prompt: PromptState | null;
  onClose: () => void;
  onContinue: () => void;
  onChangeTask: () => void;
}) {
  if (!prompt) {
    return null;
  }

  return (
    <div className="absolute inset-x-2 bottom-2 z-20 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-slate-800 shadow-sm">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug">
          {prompt.message}
        </p>
        <button
          type="button"
          title="关闭"
          aria-label="关闭"
          onClick={onClose}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-500 hover:bg-amber-100 hover:text-slate-800"
        >
          <X size={14} />
        </button>
      </div>

      {prompt.kind === "complete" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="h-7 rounded-md bg-teal-700 px-3 text-[12px] font-medium text-white hover:bg-teal-800"
          >
            继续
          </button>
          <button
            type="button"
            onClick={onChangeTask}
            className="h-7 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-stone-50"
          >
            换任务
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  task,
  focusMinutes,
  reminderMinutes,
  alwaysOnTop,
  autostart,
  onTaskChange,
  onFocusMinutesChange,
  onReminderMinutesChange,
  onAlwaysOnTopChange,
  onAutostartChange,
  onClose,
}: {
  task: string;
  focusMinutes: number;
  reminderMinutes: number;
  alwaysOnTop: boolean;
  autostart: boolean;
  onTaskChange: (task: string) => void;
  onFocusMinutesChange: (minutes: number) => void;
  onReminderMinutesChange: (minutes: number) => void;
  onAlwaysOnTopChange: (enabled: boolean) => void;
  onAutostartChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-3 py-2">
      <div className="mb-2 flex h-7 items-center gap-2">
        <DragHandle />
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

        <div
          title="MVP 预留接口"
          className="flex items-center justify-between py-1 text-slate-500"
        >
          <span className="font-medium">开机自启动</span>
          <Toggle
            checked={autostart}
            onChange={onAutostartChange}
            disabled
          />
        </div>
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
    setAutostart,
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
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastInteractionAtRef = useRef(Date.now());
  const lastReminderAtRef = useRef(0);
  const focusLostAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerStatus === "idle") {
      setRemainingSeconds(initialSeconds);
    }
  }, [initialSeconds, timerStatus]);

  useEffect(() => {
    callTauri("set_always_on_top", { enabled: settings.alwaysOnTop });
  }, [settings.alwaysOnTop]);

  useEffect(() => {
    callTauri("set_settings_open", { open: settingsOpen });
  }, [settingsOpen]);

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
          setPrompt({
            kind: "complete",
            message: "这一轮完成了吗？继续当前任务还是换任务？",
          });
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [timerStatus]);

  useEffect(() => {
    if (!prompt || prompt.kind !== "reminder") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPrompt((current) => (current?.kind === "reminder" ? null : current));
    }, REMINDER_VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [prompt]);

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const markFocus = () => {
      focusLostAtRef.current = null;
      markInteraction();
    };

    const markBlur = () => {
      focusLostAtRef.current = Date.now();
    };

    window.addEventListener("pointerdown", markInteraction, true);
    window.addEventListener("keydown", markInteraction, true);
    window.addEventListener("focus", markFocus);
    window.addEventListener("blur", markBlur);

    return () => {
      window.removeEventListener("pointerdown", markInteraction, true);
      window.removeEventListener("keydown", markInteraction, true);
      window.removeEventListener("focus", markFocus);
      window.removeEventListener("blur", markBlur);
    };
  }, []);

  useEffect(() => {
    const checker = window.setInterval(() => {
      if (settingsOpen || editing || prompt?.kind === "complete") {
        return;
      }

      const now = Date.now();
      const reminderMs = settings.reminderMinutes * 60 * 1000;
      const idleTooLong = now - lastInteractionAtRef.current >= reminderMs;
      const focusAwayTooLong =
        focusLostAtRef.current !== null &&
        now - focusLostAtRef.current >= reminderMs;
      const cooldownPassed = now - lastReminderAtRef.current >= reminderMs;

      if ((idleTooLong || focusAwayTooLong) && cooldownPassed) {
        lastReminderAtRef.current = now;
        setPrompt({
          kind: "reminder",
          message: `你现在要做的是：${settings.task}`,
        });
      }
    }, 1000);

    return () => window.clearInterval(checker);
  }, [
    editing,
    prompt?.kind,
    settings.reminderMinutes,
    settings.task,
    settingsOpen,
  ]);

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

    setPrompt(null);
    setTimerStatus("running");
  }

  function resetTimer() {
    setTimerStatus("idle");
    setRemainingSeconds(initialSeconds);
    setPrompt(null);
  }

  function continueTask() {
    setRemainingSeconds(initialSeconds);
    setTimerStatus("running");
    setPrompt(null);
  }

  function changeTaskAfterRound() {
    setPrompt(null);
    setTimerStatus("idle");
    setRemainingSeconds(initialSeconds);
    setEditing(true);
  }

  function handleAlwaysOnTopChange(enabled: boolean) {
    setAlwaysOnTop(enabled);
    callTauri("set_always_on_top", { enabled });
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent p-1.5 font-sans text-slate-900">
      <section className="relative h-full overflow-hidden rounded-xl border border-black/[0.08] bg-white/[0.94] shadow-quiet backdrop-blur-lg">
        {settingsOpen ? (
          <SettingsPanel
            task={settings.task}
            focusMinutes={settings.focusMinutes}
            reminderMinutes={settings.reminderMinutes}
            alwaysOnTop={settings.alwaysOnTop}
            autostart={settings.autostart}
            onTaskChange={setTask}
            onFocusMinutesChange={(minutes) => {
              setTimerStatus("idle");
              setFocusMinutes(minutes);
            }}
            onReminderMinutesChange={setReminderMinutes}
            onAlwaysOnTopChange={handleAlwaysOnTopChange}
            onAutostartChange={setAutostart}
            onClose={() => setSettingsOpen(false)}
          />
        ) : (
          <div className="flex h-full flex-col gap-1.5 px-3 py-2">
            <div className="flex h-6 items-center gap-2">
              <DragHandle />
              <IconButton label="设置" onClick={() => setSettingsOpen(true)} quiet>
                <Settings size={15} />
              </IconButton>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-center">
              {editing ? (
                <div className="space-y-1">
                  <input
                    ref={inputRef}
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
                    className="h-9 w-full rounded-md border border-teal-600 bg-white px-2 text-[15px] font-semibold leading-none text-slate-950 outline-none"
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
                  className="block w-full min-w-0 rounded-md text-left text-slate-950"
                >
                  <span className="block text-[11px] font-medium leading-tight text-teal-800">
                    现在只做：
                  </span>
                  <span className="mt-1 block truncate text-[18px] font-semibold leading-tight">
                    {settings.task}
                  </span>
                </button>
              )}
            </div>

            <div className="flex h-9 items-center justify-between gap-3">
              <div className="tabular-nums text-[22px] font-semibold leading-none text-[#62572f]">
                {formatCountdown(remainingSeconds)}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <IconButton label="重置" onClick={resetTimer} quiet>
                  <RotateCcw size={15} />
                </IconButton>
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
          </div>
        )}

        <PromptOverlay
          prompt={prompt}
          onClose={() => setPrompt(null)}
          onContinue={continueTask}
          onChangeTask={changeTaskAfterRound}
        />
      </section>
    </div>
  );
}
