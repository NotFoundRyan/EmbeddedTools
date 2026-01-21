use std::sync::Mutex;
use std::thread;
use tauri::{State, Emitter};
use serialport::SerialPort;
use serde::{Deserialize, Serialize};

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

    let app_clone = app.clone();
    thread::spawn(move || {
        let mut port = port_clone;
        let mut buffer = [0u8; 4096];

        loop {
            match port.read(&mut buffer) {
                Ok(n) => {
                    if n > 0 {
                        let data = buffer[..n].to_vec();
                        if let Err(e) = app_clone.emit("serial-data", data) {
                            eprintln!("Failed to emit serial data: {}", e);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(e) => {
                    eprintln!("Serial read error: {}", e);
                    let _ = app_clone.emit("serial-error", e.to_string());
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
fn close_serial_port(state: State<Mutex<SerialPortState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    state.port = None;
    Ok(())
}

#[tauri::command]
fn write_serial_port(data: Vec<u8>, state: State<Mutex<SerialPortState>>) -> Result<(), String> {
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
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo_owner);

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
        .manage(Mutex::new(SerialPortState { port: None }))
        .invoke_handler(tauri::generate_handler![
            save_file,
            read_file,
            export_binary_file,
            list_serial_ports,
            open_serial_port,
            close_serial_port,
            write_serial_port,
            read_serial_port,
            check_for_updates
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
