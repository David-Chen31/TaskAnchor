use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Emitter, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Default)]
struct AppState {
    idle_watch_alive: Mutex<Option<Arc<AtomicBool>>>,
}

fn place_near_top_right(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };

    let monitor_size = monitor.size();
    let monitor_position = monitor.position();
    let window_size = window.outer_size()?;
    let margin = (16.0 * monitor.scale_factor()) as i32;

    let x = monitor_position.x + monitor_size.width as i32 - window_size.width as i32 - margin;
    let y = monitor_position.y + margin;

    window.set_position(Position::Physical(PhysicalPosition { x, y }))?;
    Ok(())
}

#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .set_size(Size::Logical(LogicalSize { width, height }))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn enable_idle_watch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    idle_ms: u64,
) -> Result<(), String> {
    let mut guard = state.idle_watch_alive.lock().map_err(|error| error.to_string())?;
    if let Some(alive) = guard.as_ref() {
        alive.store(false, Ordering::SeqCst);
    }

    let alive = Arc::new(AtomicBool::new(true));
    *guard = Some(alive.clone());
    drop(guard);

    let app_handle = app.clone();
    let threshold = Duration::from_millis(idle_ms);

    thread::spawn(move || {
        let mut last_outside_start: Option<Instant> = Some(Instant::now());

        while alive.load(Ordering::Relaxed) {
            thread::sleep(Duration::from_millis(50));

            let Some(window) = app_handle.get_webview_window("main") else {
                continue;
            };

            let cursor_pos = match window.cursor_position() {
                Ok(p) => p,
                Err(_) => continue,
            };
            let window_pos = match window.outer_position() {
                Ok(p) => p,
                Err(_) => continue,
            };
            let window_size = match window.outer_size() {
                Ok(s) => s,
                Err(_) => continue,
            };

            let win_x = window_pos.x as f64;
            let win_y = window_pos.y as f64;
            let win_w = window_size.width as f64;
            let win_h = window_size.height as f64;

            let inside = cursor_pos.x >= win_x
                && cursor_pos.x < win_x + win_w
                && cursor_pos.y >= win_y
                && cursor_pos.y < win_y + win_h;

            if inside {
                last_outside_start = None;
            } else {
                if threshold.is_zero() {
                    let _ = window.emit("taskanchor://idle", ());
                    return;
                }

                match last_outside_start {
                    None => last_outside_start = Some(Instant::now()),
                    Some(start) => {
                        if start.elapsed() >= threshold {
                            let _ = window.emit("taskanchor://idle", ());
                            return;
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn disable_idle_watch(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.idle_watch_alive.lock().map_err(|error| error.to_string())?;
    if let Some(alive) = guard.take() {
        alive.store(false, Ordering::SeqCst);
    }
    Ok(())
}

pub fn run() {
    let summon_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyJ);

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &summon_shortcut && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("taskanchor://summon", ());
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let window = app
                .get_webview_window("main")
                .expect("main window should exist");

            place_near_top_right(&window)?;
            app.global_shortcut().register(summon_shortcut)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_always_on_top,
            set_window_size,
            enable_idle_watch,
            disable_idle_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running TaskAnchor");
}
