use std::sync::Mutex;
use std::thread;
use tauri::{State, Emitter, Manager};
use serialport::SerialPort;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    body: String,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize)]
struct UpdateInfo {
    current_version: String,
    latest_version: String,
    has_update: bool,
    download_url: Option<String>,
    release_notes: String,
}

struct SerialPortState {
    port: Option<Box<dyn SerialPort>>,
    should_close: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

#[tauri::command]
fn list_serial_ports() -> Result<Vec<String>, String> {
    let ports = serialport::available_ports()
        .map_err(|e| e.to_string())?;

    Ok(ports.into_iter()
        .map(|p| p.port_name)
        .collect())
}

#[tauri::command]
fn open_serial_port(
    port_id: String,
    port_name: String,
    baud_rate: u32,
    data_bits: u8,
    stop_bits: u8,
    parity: u8,
    state: State<Mutex<SerialPortState>>,
    app: tauri::AppHandle
) -> Result<(), String> {
    use serialport::{DataBits, StopBits, Parity};

    let data_bits_enum = match data_bits {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        _ => DataBits::Eight,
    };

    let stop_bits_enum = match stop_bits {
        1 => StopBits::One,
        2 => StopBits::Two,
        _ => StopBits::One,
    };

    let parity_enum = match parity {
        0 => Parity::None,
        1 => Parity::Odd,
        2 => Parity::Even,
        _ => Parity::None,
    };

    let port = serialport::new(&port_name, baud_rate)
        .data_bits(data_bits_enum)
        .stop_bits(stop_bits_enum)
        .parity(parity_enum)
        .timeout(std::time::Duration::from_millis(100))
        .open()
        .map_err(|e| e.to_string())?;

    let port_clone = port.try_clone()
        .map_err(|e| e.to_string())?;

    let port_id_clone = port_id.clone();
    let app_clone = app.clone();
    let should_close = {
        let state = state.lock().unwrap();
        state.should_close.store(false, std::sync::atomic::Ordering::SeqCst);
        state.should_close.clone()
    };

    thread::spawn(move || {
        let mut port = port_clone;
        let mut buffer = [0u8; 4096];

        loop {
            if should_close.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }

            match port.read(&mut buffer) {
                Ok(n) => {
                    if n > 0 {
                        let data = buffer[..n].to_vec();
                        let payload = serde_json::json!({
                            "portId": port_id_clone,
                            "data": data
                        });
                        if let Err(e) = app_clone.emit("serial-data", payload) {
                            eprintln!("Failed to emit serial data: {}", e);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(e) => {
                    eprintln!("Serial read error: {}", e);
                    let payload = serde_json::json!({
                        "portId": port_id_clone,
                        "message": e.to_string()
                    });
                    let _ = app_clone.emit("serial-error", payload);
                    break;
                }
            }
        }
    });

    let mut state = state.lock().unwrap();
    state.port = Some(port);

    Ok(())
}

#[tauri::command]
fn close_serial_port(_port_id: String, state: State<Mutex<SerialPortState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    state.should_close.store(true, std::sync::atomic::Ordering::SeqCst);
    state.port = None;
    Ok(())
}

#[tauri::command]
fn write_serial_port(_port_id: String, data: Vec<u8>, state: State<Mutex<SerialPortState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    if let Some(ref mut port) = state.port {
        port.write_all(&data).map_err(|e| e.to_string())?;
        port.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("串口未打开".to_string())
    }
}

#[tauri::command]
fn read_serial_port() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(app_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn ensure_log_directory(base_path: String) -> Result<(), String> {
    let log_dir = PathBuf::from(&base_path).join("logs");
    std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn append_to_log(path: String, content: String) -> Result<(), String> {
    use std::io::Write;

    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;

    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_log_files(base_path: String) -> Result<Vec<String>, String> {
    let log_dir = PathBuf::from(&base_path).join("logs");

    if !log_dir.exists() {
        return Ok(vec![]);
    }

    let mut files = vec![];
    let entries = std::fs::read_dir(&log_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".log") {
                    files.push(name.to_string());
                }
            }
        }
    }

    files.sort();
    files.reverse();
    Ok(files)
}

#[tauri::command]
fn read_log_file(base_path: String, filename: String) -> Result<String, String> {
    let log_path = PathBuf::from(&base_path).join("logs").join(&filename);
    std::fs::read_to_string(&log_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_for_updates(repo_owner: String, repo_name: String, current_version: String) -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/{}/releases/latest", repo_owner, repo_name);

    let client = reqwest::Client::builder()
        .user_agent("tauri-app")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub API 请求失败: {}", response.status()));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let has_update = latest_version != current_version;

    let download_url = if has_update {
        let asset = release.assets.iter().find(|a| a.name.ends_with("setup.exe"));
        asset.map(|a| a.browser_download_url.clone())
    } else {
        None
    };

    Ok(UpdateInfo {
        current_version,
        latest_version,
        has_update,
        download_url,
        release_notes: release.body,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(SerialPortState {
            port: None,
            should_close: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }))
        .invoke_handler(tauri::generate_handler![
            save_file,
            read_file,
            export_binary_file,
            list_serial_ports,
            open_serial_port,
            close_serial_port,
            write_serial_port,
            read_serial_port,
            check_for_updates,
            get_app_data_dir,
            ensure_log_directory,
            append_to_log,
            list_log_files,
            read_log_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
