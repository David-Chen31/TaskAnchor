use tauri::{
    LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow,
};

const COMPACT_WIDTH: f64 = 320.0;
const COMPACT_HEIGHT: f64 = 148.0;
const SETTINGS_HEIGHT: f64 = 268.0;

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
fn set_settings_open(app: tauri::AppHandle, open: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let height = if open {
        SETTINGS_HEIGHT
    } else {
        COMPACT_HEIGHT
    };

    window
        .set_size(Size::Logical(LogicalSize {
            width: COMPACT_WIDTH,
            height,
        }))
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window should exist");

            place_near_top_right(&window)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_always_on_top,
            set_settings_open
        ])
        .run(tauri::generate_context!())
        .expect("error while running TaskAnchor");
}
