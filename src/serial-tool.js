const SERIAL_CONFIG = {
  DEFAULT_BAUD_RATE: 115200,
  DEFAULT_DATA_BITS: 8,
  AUTO_SEND_MIN_INTERVAL: 100,
  AUTO_SEND_MAX_INTERVAL: 10000,
  MAX_RECEIVE_LINES: 1000,
  MAX_HISTORY_ENTRIES: 5000,
  PARITY: {
    NONE: 0,
    ODD: 1,
    EVEN: 2
  }
};

let serialPorts = {};
let serialPortCounter = 0;
let eventUnlisteners = [];
let receiveBuffers = {};
let receiveTimers = {};
let configPresets = [];
let dataHistory = {};
let autoSaveEnabled = true;
let logDirectory = '';

function initSerialTool() {
  setupSerialEventListeners();
  setupTauriEventListeners();
  loadConfigPresets();
  initLogDirectory().catch(err => console.error('初始化日志目录失败:', err));
}

window.initSerialTool = initSerialTool;

function getTauriAPI() {
  return window.__TAURI__;
}

async function invokeTauri(command, args = {}) {
  const tauri = getTauriAPI();
  if (!tauri || !tauri.core) {
    throw new Error('串口功能需要在 Tauri 应用中使用。请使用 npm run tauri dev 启动应用。');
  }
  return await tauri.core.invoke(command, args);
}

function setupSerialEventListeners() {
  const addBtn = document.getElementById('st-add-btn');
  const refreshBtn = document.getElementById('st-refresh-btn');

  if (!addBtn) {
    console.error('未找到 st-add-btn 元素');
    return;
  }

  if (!refreshBtn) {
    console.error('未找到 st-refresh-btn 元素');
    return;
  }

  addBtn.addEventListener('click', addSerialPort);
  refreshBtn.addEventListener('click', refreshAllSerialPorts);

  console.log('串口工具事件监听器已设置');
}

function setupTauriEventListeners() {
  const tauri = getTauriAPI();
  if (tauri && tauri.event) {
    const unlistenData = tauri.event.listen('serial-data', (event) => {
      try {
        const data = event.payload;
        if (data && data.portId && data.data && data.data.length > 0) {
          handleSerialData(data.portId, data.data);
        }
      } catch (error) {
        console.error('Error handling serial-data event:', error);
      }
    });
    unlistenData.then(unlisten => eventUnlisteners.push(unlisten)).catch(error => {
      console.error('Failed to listen to serial-data event:', error);
    });

    const unlistenError = tauri.event.listen('serial-error', (event) => {
      try {
        const error = event.payload;
        if (error && error.portId) {
          logError('串口错误: ' + error.message, '串口工具 ' + error.portId);
        }
      } catch (error) {
        console.error('Error handling serial-error event:', error);
      }
    });
    unlistenError.then(unlisten => eventUnlisteners.push(unlisten)).catch(error => {
      console.error('Failed to listen to serial-error event:', error);
    });
  }
}

function addSerialPort() {
  console.log('addSerialPort 被调用');

  const portId = 'port-' + serialPortCounter++;

  serialPorts[portId] = {
    id: portId,
    name: '串口 ' + (parseInt(portId.split('-')[1]) + 1),
    connected: false,
    rxCount: 0,
    txCount: 0,
    autoSendInterval: null
  };

  const container = document.getElementById('serial-tool-ports-container');
  if (!container) {
    console.error('未找到 serial-tool-ports-container 元素');
    return;
  }

  const portCard = createSerialPortCard(portId);
  container.appendChild(portCard);

  console.log('串口卡片已添加到 DOM:', portId);

  setupPortCardEventListeners(portId);
  console.log('串口卡片事件监听器已设置:', portId);

  updateEmptyPortsMessage();
  refreshSerialPorts(portId);

  console.log('串口卡片创建成功:', portId);
}

function createSerialPortCard(portId) {
  const card = document.createElement('div');
  card.className = 'serial-tool-card';
  card.id = portId + '-card';

  card.innerHTML = `
    <div class="serial-tool-card-header" id="${portId}-header">
      <div class="serial-tool-card-info">
        <span class="serial-tool-port-name">${serialPorts[portId].name}</span>
        <span class="serial-tool-status-badge" id="${portId}-status">未连接</span>
      </div>
      <div class="serial-tool-card-controls">
        <button class="serial-tool-icon-btn" id="${portId}-toggle"><i class="fa-solid fa-chevron-up"></i></button>
        <button class="serial-tool-icon-btn delete" id="${portId}-delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
    <div class="serial-tool-card-body" id="${portId}-content">
      <div class="serial-tool-config-panel">
        <div class="serial-tool-config-toolbar">
          <div class="serial-tool-preset-section">
            <select id="${portId}-preset-select" class="serial-tool-select serial-tool-preset-select">
              <option value="">选择预设...</option>
            </select>
            <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-load-preset-btn" title="加载预设">
              <i class="fa-solid fa-folder-open"></i>
            </button>
            <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-save-preset-btn" title="保存为预设">
              <i class="fa-solid fa-save"></i>
            </button>
            <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-manage-preset-btn" title="管理预设">
              <i class="fa-solid fa-cog"></i>
            </button>
          </div>
        </div>
        <div class="serial-tool-config-grid">
          <div class="serial-tool-form-group">
            <label>端口号</label>
            <select id="${portId}-port-select" class="serial-tool-select">
              <option value="">未选择串口</option>
            </select>
          </div>
          <div class="serial-tool-form-group">
            <label>波特率</label>
            <select id="${portId}-baud-rate" class="serial-tool-select">
              <option value="1200">1200</option>
              <option value="2400">2400</option>
              <option value="4800">4800</option>
              <option value="9600">9600</option>
              <option value="14400">14400</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200" selected>115200</option>
              <option value="230400">230400</option>
              <option value="460800">460800</option>
              <option value="921600">921600</option>
            </select>
          </div>
          <div class="serial-tool-form-group">
            <label>数据位</label>
            <select id="${portId}-data-bits" class="serial-tool-select">
              <option value="7">7</option>
              <option value="8" selected>8</option>
            </select>
          </div>
          <div class="serial-tool-form-group">
            <label>校验位</label>
            <select id="${portId}-parity" class="serial-tool-select">
              <option value="none" selected>None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </select>
          </div>
          <div class="serial-tool-form-group">
            <label>停止位</label>
            <select id="${portId}-stop-bits" class="serial-tool-select">
              <option value="1" selected>1</option>
              <option value="2">2</option>
            </select>
          </div>
          <div class="serial-tool-form-group" style="justify-content: flex-end;">
            <label>&nbsp;</label>
            <button id="${portId}-open-btn" class="serial-tool-btn serial-tool-btn-success">
              <i class="fa-solid fa-link"></i> 打开串口
            </button>
            <button id="${portId}-close-btn" class="serial-tool-btn serial-tool-btn-danger" disabled>
              <i class="fa-solid fa-link-slash"></i> 关闭串口
            </button>
          </div>
        </div>
      </div>

      <div class="serial-tool-data-panel">
        <div class="serial-tool-rx-section">
          <div class="serial-tool-section-header">
            <span class="serial-tool-section-title">接收区 (RX)</span>
            <div class="serial-tool-options-row">
              <label class="serial-tool-checkbox-label">
                <input type="checkbox" id="${portId}-show-hex" /> HEX显示
              </label>
              <label class="serial-tool-checkbox-label">
                <input type="checkbox" id="${portId}-show-time" checked /> 时间戳
              </label>
              <label class="serial-tool-checkbox-label">
                <input type="checkbox" id="${portId}-auto-scroll" checked /> 自动滚动
              </label>
              <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-clear-receive-btn">
                清空
              </button>
            </div>
          </div>
          <div class="serial-tool-terminal-window" id="${portId}-receive-data"></div>
          <div class="serial-tool-rx-actions">
            <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-history-btn" title="历史回溯">
              <i class="fa-solid fa-clock-rotate-left"></i> 历史
            </button>
            <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-export-txt-btn" title="导出TXT">
              <i class="fa-solid fa-file-export"></i> TXT
            </button>
            <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" id="${portId}-export-csv-btn" title="导出CSV">
              <i class="fa-solid fa-file-csv"></i> CSV
            </button>
          </div>
        </div>

        <div class="serial-tool-tx-section">
          <div class="serial-tool-section-header">
            <span class="serial-tool-section-title">发送区 (TX)</span>
            <div class="serial-tool-options-row">
              <label class="serial-tool-checkbox-label">
                <input type="radio" name="${portId}-send-format" value="text" checked /> 文本模式
              </label>
              <label class="serial-tool-checkbox-label">
                <input type="radio" name="${portId}-send-format" value="hex" /> 十六进制
              </label>
              <label class="serial-tool-checkbox-label">
                <input type="checkbox" id="${portId}-auto-send" /> 自动发送
              </label>
              <input type="number" id="${portId}-send-interval" value="1000" min="100" max="10000" style="width: 80px;" />
              <span>ms</span>
            </div>
          </div>
          <textarea id="${portId}-send-data" class="serial-tool-tx-input" placeholder="在此输入要发送的数据..."></textarea>
          <div class="serial-tool-tx-actions">
            <div style="margin-right: auto; font-size: 12px; color: #6b7280;">
              <span id="${portId}-tx-count">TX: 0 Bytes</span>
            </div>
            <button class="serial-tool-btn serial-tool-btn-outline" id="${portId}-clear-send-btn">清除</button>
            <button class="serial-tool-btn serial-tool-btn-primary" id="${portId}-send-btn">
              <i class="fa-solid fa-paper-plane"></i> 发送
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  return card;
}

function setupPortCardEventListeners(portId) {
  document.getElementById(`${portId}-header`).addEventListener('click', (e) => {
    if (!e.target.classList.contains('toggle-btn') && !e.target.closest('.delete')) {
      togglePortCard(portId);
    }
  });

  document.getElementById(`${portId}-toggle`).addEventListener('click', (e) => {
    e.stopPropagation();
    togglePortCard(portId);
  });

  document.getElementById(`${portId}-delete`).addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSerialPort(portId);
  });

  document.getElementById(`${portId}-open-btn`).addEventListener('click', () => openSerialPort(portId));
  document.getElementById(`${portId}-close-btn`).addEventListener('click', () => closeSerialPort(portId));
  document.getElementById(`${portId}-send-btn`).addEventListener('click', () => sendData(portId));
  document.getElementById(`${portId}-clear-send-btn`).addEventListener('click', () => {
    document.getElementById(`${portId}-send-data`).value = '';
  });
  document.getElementById(`${portId}-clear-receive-btn`).addEventListener('click', () => {
    document.getElementById(`${portId}-receive-data`).innerHTML = '';
    serialPorts[portId].rxCount = 0;
    serialPorts[portId].txCount = 0;
    dataHistory[portId] = [];
    updatePortStatus(portId);
  });

  document.getElementById(`${portId}-auto-send`).addEventListener('change', (e) => {
    if (e.target.checked) {
      startAutoSend(portId);
    } else {
      stopAutoSend(portId);
    }
  });

  document.getElementById(`${portId}-show-hex`).addEventListener('change', () => {
    toggleDisplayFormat(portId);
  });

  document.getElementById(`${portId}-load-preset-btn`).addEventListener('click', () => {
    const presetId = document.getElementById(`${portId}-preset-select`).value;
    if (presetId) {
      loadConfigPreset(portId, presetId);
    } else {
      alert('请先选择一个预设！');
    }
  });

  document.getElementById(`${portId}-save-preset-btn`).addEventListener('click', () => {
    saveCurrentConfigAsPreset(portId);
  });

  document.getElementById(`${portId}-manage-preset-btn`).addEventListener('click', () => {
    showPresetManager();
  });

  document.getElementById(`${portId}-history-btn`).addEventListener('click', () => {
    showHistoryBrowser(portId);
  });

  document.getElementById(`${portId}-export-txt-btn`).addEventListener('click', () => {
    exportData(portId, 'txt');
  });

  document.getElementById(`${portId}-export-csv-btn`).addEventListener('click', () => {
    exportData(portId, 'csv');
  });

  updatePresetDropdown(portId);
}

function togglePortCard(portId) {
  const content = document.getElementById(`${portId}-content`);
  const toggleBtn = document.getElementById(`${portId}-toggle`);

  content.classList.toggle('collapsed');
  const icon = toggleBtn.querySelector('i');
  if (content.classList.contains('collapsed')) {
    icon.className = 'fa-solid fa-chevron-down';
  } else {
    icon.className = 'fa-solid fa-chevron-up';
  }
}

function deleteSerialPort(portId) {
  const port = serialPorts[portId];
  if (!port) return;

  if (port.connected) {
    closeSerialPort(portId);
  }

  stopAutoSend(portId);
  delete serialPorts[portId];
  const card = document.getElementById(`${portId}-card`);
  if (card) {
    card.remove();
  }

  if (Object.keys(serialPorts).length === 0) {
    serialPortCounter = 0;
  }

  updateEmptyPortsMessage();
}

function updateEmptyPortsMessage() {
  const container = document.getElementById('serial-tool-ports-container');
  const emptyMessage = document.getElementById('st-empty-message');

  if (container.children.length === 0) {
    emptyMessage.style.display = 'block';
  } else {
    emptyMessage.style.display = 'none';
  }
}

async function refreshAllSerialPorts() {
  for (const portId in serialPorts) {
    await refreshSerialPorts(portId);
  }
}

async function refreshSerialPorts(portId) {
  const portSelect = document.getElementById(`${portId}-port-select`);
  if (!portSelect) return;

  const currentSelection = portSelect.value;

  portSelect.innerHTML = '<option value="">未选择串口</option>';

  try {
    const ports = await invokeTauri('list_serial_ports');

    ports.forEach(portName => {
      const option = document.createElement('option');
      option.value = portName;
      option.textContent = portName;
      portSelect.appendChild(option);
    });

    if (currentSelection) {
      portSelect.value = currentSelection;
    }

    if (ports.length === 0) {
      logError('未检测到串口设备。请确保设备已连接。', '串口工具');
    }
  } catch (error) {
    console.error('获取串口列表失败:', error);
    logError('获取串口列表失败: ' + error.message, '串口工具');
  }
}

async function openSerialPort(portId) {
  const portSelect = document.getElementById(`${portId}-port-select`);
  const selectedPort = portSelect?.value;

  if (!selectedPort) {
    logError('请先选择一个串口！', '串口工具');
    return;
  }

  const port = serialPorts[portId];
  if (!port) return;

  if (port.connected) {
    logError('串口已经打开！', '串口工具');
    return;
  }

  const baudRate = parseInt(document.getElementById(`${portId}-baud-rate`).value);
  const dataBits = parseInt(document.getElementById(`${portId}-data-bits`).value);
  const stopBitsValue = parseInt(document.getElementById(`${portId}-stop-bits`).value);
  const parityValue = document.getElementById(`${portId}-parity`).value;

  let stopBits;
  if (stopBitsValue === 1) {
    stopBits = 1;
  } else if (stopBitsValue === 2) {
    stopBits = 2;
  } else {
    stopBits = 1;
  }

  let parity;
  if (parityValue === 'none') {
    parity = SERIAL_CONFIG.PARITY.NONE;
  } else if (parityValue === 'even') {
    parity = SERIAL_CONFIG.PARITY.EVEN;
  } else if (parityValue === 'odd') {
    parity = SERIAL_CONFIG.PARITY.ODD;
  } else {
    parity = SERIAL_CONFIG.PARITY.NONE;
  }

  try {
    await invokeTauri('open_serial_port', {
      portId: portId,
      portName: selectedPort,
      baudRate: baudRate,
      dataBits: dataBits,
      stopBits: stopBits,
      parity: parity
    });

    port.connected = true;
    port.name = selectedPort;
    updatePortStatus(portId);
    const headerName = document.querySelector(`#${portId}-header .serial-tool-port-name`);
    if (headerName) {
      headerName.textContent = selectedPort;
    }
    document.getElementById(`${portId}-open-btn`).disabled = true;
    document.getElementById(`${portId}-close-btn`).disabled = false;

  } catch (error) {
    console.error('打开串口失败:', error);
    logError('打开串口失败: ' + error.message, '串口工具');
  }
}

async function closeSerialPort(portId) {
  const port = serialPorts[portId];
  if (!port || !port.connected) return;

  try {
    stopAutoSend(portId);

    if (receiveTimers[portId]) {
      clearTimeout(receiveTimers[portId]);
      receiveTimers[portId] = null;
    }

    if (receiveBuffers[portId]) {
      receiveBuffers[portId] = [];
    }

    await invokeTauri('close_serial_port', { portId: portId });

    port.connected = false;
    port.name = '串口 ' + (parseInt(portId.split('-')[1]) + 1);
    updatePortStatus(portId);
    const headerName = document.querySelector(`#${portId}-header .serial-tool-port-name`);
    if (headerName) {
      headerName.textContent = port.name;
    }
    document.getElementById(`${portId}-open-btn`).disabled = false;
    document.getElementById(`${portId}-close-btn`).disabled = true;

  } catch (error) {
    console.error('关闭串口失败:', error);
    logError('关闭串口失败: ' + error.message, '串口工具');
  }
}

async function sendData(portId) {
  const port = serialPorts[portId];
  if (!port || !port.connected) {
    logError('请先打开串口！', '串口工具');
    return;
  }

  const sendDataInput = document.getElementById(`${portId}-send-data`);
  const data = sendDataInput.value;

  if (!data) {
    logError('请输入要发送的数据！', '串口工具');
    return;
  }

  const sendFormat = document.querySelector(`input[name="${portId}-send-format"]:checked`).value;
  let bytesToSend;

  try {
    if (sendFormat === 'hex') {
      bytesToSend = parseHexString(data);
    } else {
      const encoder = new TextEncoder();
      bytesToSend = Array.from(encoder.encode(data));
    }

    await invokeTauri('write_serial_port', { portId: portId, data: bytesToSend });
    port.txCount += bytesToSend.length;
    updatePortStatus(portId);

    recordDataHistory(portId, bytesToSend, 'TX');
  } catch (error) {
    console.error('发送数据失败:', error);
    logError('发送数据失败: ' + error.message, '串口工具');
  }
}

function parseHexString(hexString) {
  const hexStringClean = hexString.replace(/\s+/g, '');
  const bytes = [];

  for (let i = 0; i < hexStringClean.length; i += 2) {
    const hexByte = hexStringClean.substr(i, 2);
    const byteValue = parseInt(hexByte, 16);

    if (isNaN(byteValue)) {
      throw new Error('无效的十六进制数据');
    }

    bytes.push(byteValue);
  }

  return bytes;
}

function startAutoSend(portId) {
  if (serialPorts[portId].autoSendInterval) {
    clearInterval(serialPorts[portId].autoSendInterval);
  }

  let interval = parseInt(document.getElementById(`${portId}-send-interval`).value) || 1000;
  interval = Math.max(SERIAL_CONFIG.AUTO_SEND_MIN_INTERVAL, Math.min(SERIAL_CONFIG.AUTO_SEND_MAX_INTERVAL, interval));

  serialPorts[portId].autoSendInterval = setInterval(() => {
    sendData(portId);
  }, interval);
}

function stopAutoSend(portId) {
  if (serialPorts[portId].autoSendInterval) {
    clearInterval(serialPorts[portId].autoSendInterval);
    serialPorts[portId].autoSendInterval = null;
  }
}

function handleSerialData(portId, data) {
  if (!serialPorts[portId]) return;

  if (!serialPorts[portId].connected) {
    console.log(`串口 ${portId} 已关闭，忽略接收到的数据`);
    return;
  }

  if (!receiveBuffers[portId]) {
    receiveBuffers[portId] = [];
  }

  receiveBuffers[portId].push(...data);
  serialPorts[portId].rxCount += data.length;
  updatePortStatus(portId);

  if (receiveTimers[portId]) {
    clearTimeout(receiveTimers[portId]);
  }

  receiveTimers[portId] = setTimeout(() => {
    if (!serialPorts[portId] || !serialPorts[portId].connected) {
      return;
    }

    const buffer = receiveBuffers[portId] || [];
    if (buffer.length > 0) {
      displayReceivedData(portId, buffer);
      receiveBuffers[portId] = [];
    }
  }, 100);
}

function displayReceivedData(portId, data) {
  const receiveDataDiv = document.getElementById(`${portId}-receive-data`);
  if (!receiveDataDiv) return;

  recordDataHistory(portId, data, 'RX');

  const showHex = document.getElementById(`${portId}-show-hex`)?.checked;
  const showTime = document.getElementById(`${portId}-show-time`)?.checked;
  const autoScroll = document.getElementById(`${portId}-auto-scroll`)?.checked;

  let displayContent = '';

  if (showTime) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    displayContent += `<span class="serial-tool-ts">[${timeStr}]</span> `;
  }

  if (showHex) {
    const hexString = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    displayContent += `<span class="serial-tool-hex">${hexString}</span>`;
  } else {
    let textContent = '';
    for (const byte of data) {
      if (byte >= 32 && byte <= 126) {
        textContent += String.fromCharCode(byte);
      } else if (byte === 9) {
        textContent += '\t';
      } else if (byte === 10) {
        textContent += '\n';
      } else if (byte === 13) {
        textContent += '\r';
      } else {
        textContent += String.fromCharCode(byte);
      }
    }
    displayContent += textContent;
  }

  const dataLine = document.createElement('div');
  dataLine.className = 'serial-tool-log-item';
  dataLine.innerHTML = displayContent;

  receiveDataDiv.appendChild(dataLine);

  while (receiveDataDiv.children.length > SERIAL_CONFIG.MAX_RECEIVE_LINES) {
    receiveDataDiv.removeChild(receiveDataDiv.firstChild);
  }

  if (autoScroll) {
    receiveDataDiv.scrollTop = receiveDataDiv.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updatePortStatus(portId) {
  const statusElement = document.getElementById(`${portId}-status`);
  const port = serialPorts[portId];

  if (!port || !statusElement) return;

  if (port.connected) {
    statusElement.textContent = '已打开';
    statusElement.classList.add('connected');
  } else {
    statusElement.textContent = '未连接';
    statusElement.classList.remove('connected');
  }

  const titleElement = document.querySelector(`#${portId}-header .serial-tool-card-info`);
  if (titleElement) {
    let stats = titleElement.querySelector('.rx-tx-stats');
    if (!stats) {
      stats = document.createElement('span');
      stats.className = 'rx-tx-stats';
      stats.style.fontSize = '0.75rem';
      stats.style.color = '#6b7280';
      stats.style.marginLeft = '12px';
      titleElement.appendChild(stats);
    }
    stats.textContent = `RX: ${port.rxCount} | TX: ${port.txCount}`;
  }

  const txCountElement = document.getElementById(`${portId}-tx-count`);
  if (txCountElement && port) {
    txCountElement.textContent = `TX: ${port.txCount} Bytes`;
  }
}

async function initLogDirectory() {
  try {
    const tauri = getTauriAPI();
    if (tauri && tauri.core) {
      const appDataDir = await tauri.core.invoke('get_app_data_dir');
      logDirectory = appDataDir;
      await tauri.core.invoke('ensure_log_directory', { basePath: appDataDir });
    }
  } catch (error) {
    console.error('初始化日志目录失败:', error);
  }
}

function loadConfigPresets() {
  try {
    const saved = localStorage.getItem('serialConfigPresets');
    if (saved) {
      configPresets = JSON.parse(saved);
    }
  } catch (error) {
    console.error('加载配置预设失败:', error);
    configPresets = [];
  }
}

function saveConfigPresets() {
  try {
    localStorage.setItem('serialConfigPresets', JSON.stringify(configPresets));
  } catch (error) {
    console.error('保存配置预设失败:', error);
  }
}

function saveCurrentConfigAsPreset(portId) {
  const presetName = prompt('请输入配置预设名称:');
  if (!presetName) return;

  const baudRate = document.getElementById(`${portId}-baud-rate`).value;
  const dataBits = document.getElementById(`${portId}-data-bits`).value;
  const parity = document.getElementById(`${portId}-parity`).value;
  const stopBits = document.getElementById(`${portId}-stop-bits`).value;

  const preset = {
    id: Date.now().toString(),
    name: presetName,
    config: {
      baudRate: baudRate,
      dataBits: dataBits,
      parity: parity,
      stopBits: stopBits
    },
    createdAt: new Date().toISOString()
  };

  configPresets.push(preset);
  saveConfigPresets();
  updatePresetDropdown(portId);
  alert('配置预设已保存！');
}

function loadConfigPreset(portId, presetId) {
  const preset = configPresets.find(p => p.id === presetId);
  if (!preset) return;

  document.getElementById(`${portId}-baud-rate`).value = preset.config.baudRate;
  document.getElementById(`${portId}-data-bits`).value = preset.config.dataBits;
  document.getElementById(`${portId}-parity`).value = preset.config.parity;
  document.getElementById(`${portId}-stop-bits`).value = preset.config.stopBits;
}

function deleteConfigPreset(presetId) {
  if (!confirm('确定要删除此配置预设吗？')) return;

  configPresets = configPresets.filter(p => p.id !== presetId);
  saveConfigPresets();
}

function updatePresetDropdown(portId) {
  const select = document.getElementById(`${portId}-preset-select`);
  if (!select) return;

  select.innerHTML = '<option value="">选择预设...</option>';
  configPresets.forEach(preset => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.name} (${preset.config.baudRate})`;
    select.appendChild(option);
  });
}

function toggleDisplayFormat(portId) {
  const showHex = document.getElementById(`${portId}-show-hex`).checked;
  const history = dataHistory[portId];
  if (!history || history.length === 0) return;

  const receiveDataDiv = document.getElementById(`${portId}-receive-data`);
  if (!receiveDataDiv) return;

  receiveDataDiv.innerHTML = '';

  history.forEach(entry => {
    const dataLine = document.createElement('div');
    dataLine.className = 'serial-tool-log-item';

    let displayContent = '';

    if (entry.timestamp) {
      displayContent += `<span class="serial-tool-ts">[${entry.timestamp}]</span> `;
    }

    if (showHex) {
      const hexString = entry.rawData.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      displayContent += `<span class="serial-tool-hex">${hexString}</span>`;
    } else {
      let textContent = '';
      for (const byte of entry.rawData) {
        if (byte >= 32 && byte <= 126) {
          textContent += String.fromCharCode(byte);
        } else if (byte === 9) {
          textContent += '\t';
        } else if (byte === 10) {
          textContent += '\n';
        } else if (byte === 13) {
          textContent += '\r';
        } else {
          textContent += '.';
        }
      }
      displayContent += textContent;
    }

    dataLine.innerHTML = displayContent;
    receiveDataDiv.appendChild(dataLine);
  });

  const autoScroll = document.getElementById(`${portId}-auto-scroll`)?.checked;
  if (autoScroll) {
    receiveDataDiv.scrollTop = receiveDataDiv.scrollHeight;
  }
}

function recordDataHistory(portId, data, direction = 'RX') {
  if (!dataHistory[portId]) {
    dataHistory[portId] = [];
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const entry = {
    timestamp: timeStr,
    fullTimestamp: now.toISOString(),
    rawData: [...data],
    direction: direction,
    length: data.length
  };

  dataHistory[portId].push(entry);

  while (dataHistory[portId].length > SERIAL_CONFIG.MAX_HISTORY_ENTRIES) {
    dataHistory[portId].shift();
  }

  if (autoSaveEnabled && direction === 'RX') {
    autoSaveLogEntry(portId, entry);
  }
}

async function autoSaveLogEntry(portId, entry) {
  if (!logDirectory) return;

  try {
    const port = serialPorts[portId];
    const portName = port ? port.name : portId;
    const safePortName = portName.replace(/[\\/:*?"<>|]/g, '_');

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const logFileName = `${safePortName}_${dateStr}.log`;
    const logPath = `${logDirectory}/logs/${logFileName}`;

    const logLine = `[${entry.timestamp}] [${entry.direction}] ${entry.rawData.map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;

    await invokeTauri('append_to_log', {
      path: logPath,
      content: logLine
    });
  } catch (error) {
    console.error('自动保存日志失败:', error);
  }
}

async function exportData(portId, format = 'txt') {
  const history = dataHistory[portId];
  if (!history || history.length === 0) {
    alert('没有可导出的数据！');
    return;
  }

  const port = serialPorts[portId];
  const portName = port ? port.name : portId;
  const safePortName = portName.replace(/[\\/:*?"<>|]/g, '_');

  let content = '';
  let fileName = '';
  let mimeType = '';

  if (format === 'txt') {
    fileName = `${safePortName}_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    mimeType = 'text/plain';

    content = `串口调试日志导出\n`;
    content += `串口: ${portName}\n`;
    content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `总条目: ${history.length}\n`;
    content += `${'='.repeat(60)}\n\n`;

    history.forEach(entry => {
      const hexStr = entry.rawData.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      let textStr = '';
      for (const byte of entry.rawData) {
        if (byte >= 32 && byte <= 126) {
          textStr += String.fromCharCode(byte);
        } else {
          textStr += '.';
        }
      }
      content += `[${entry.timestamp}] [${entry.direction}] (${entry.length} bytes)\n`;
      content += `  HEX: ${hexStr}\n`;
      content += `  TXT: ${textStr}\n\n`;
    });
  } else if (format === 'csv') {
    fileName = `${safePortName}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    mimeType = 'text/csv';

    content = '时间戳,方向,字节数,十六进制数据,文本数据\n';

    history.forEach(entry => {
      const hexStr = entry.rawData.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      let textStr = '';
      for (const byte of entry.rawData) {
        if (byte >= 32 && byte <= 126) {
          textStr += String.fromCharCode(byte);
        } else {
          textStr += '.';
        }
      }
      content += `"${entry.timestamp}","${entry.direction}",${entry.length},"${hexStr}","${textStr}"\n`;
    });
  }

  try {
    const tauri = getTauriAPI();
    if (tauri && tauri.dialog) {
      const savePath = await tauri.dialog.save({
        defaultPath: fileName,
        filters: [{
          name: format.toUpperCase(),
          extensions: [format]
        }]
      });

      if (savePath) {
        await invokeTauri('save_file', { path: savePath, content: content });
        alert(`数据已成功导出到: ${savePath}`);
      }
    } else {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('导出数据失败:', error);
    alert('导出数据失败: ' + error.message);
  }
}

function showHistoryBrowser(portId) {
  const history = dataHistory[portId];
  if (!history || history.length === 0) {
    alert('没有历史数据可浏览！');
    return;
  }

  let browserModal = document.getElementById('history-browser-modal');
  if (browserModal) {
    browserModal.remove();
  }

  browserModal = document.createElement('div');
  browserModal.id = 'history-browser-modal';
  browserModal.className = 'serial-tool-modal';
  browserModal.innerHTML = `
    <div class="serial-tool-modal-content">
      <div class="serial-tool-modal-header">
        <h3>历史数据回溯 - ${serialPorts[portId]?.name || portId}</h3>
        <button class="serial-tool-modal-close" onclick="this.closest('.serial-tool-modal').remove()">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="serial-tool-modal-body">
        <div class="history-browser-controls">
          <div class="history-search">
            <input type="text" id="history-search-input" placeholder="搜索数据..." />
            <button onclick="searchHistory('${portId}')"><i class="fa-solid fa-search"></i></button>
          </div>
          <div class="history-filter">
            <select id="history-direction-filter">
              <option value="all">全部</option>
              <option value="RX">仅接收</option>
              <option value="TX">仅发送</option>
            </select>
          </div>
          <div class="history-stats">
            共 <span id="history-count">${history.length}</span> 条记录
          </div>
        </div>
        <div class="history-timeline" id="history-timeline">
          ${renderHistoryTimeline(history)}
        </div>
      </div>
      <div class="serial-tool-modal-footer">
        <button class="serial-tool-btn serial-tool-btn-outline" onclick="exportData('${portId}', 'txt')">
          <i class="fa-solid fa-file-export"></i> 导出 TXT
        </button>
        <button class="serial-tool-btn serial-tool-btn-outline" onclick="exportData('${portId}', 'csv')">
          <i class="fa-solid fa-file-csv"></i> 导出 CSV
        </button>
        <button class="serial-tool-btn serial-tool-btn-primary" onclick="this.closest('.serial-tool-modal').remove()">
          关闭
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(browserModal);

  document.getElementById('history-direction-filter').addEventListener('change', () => {
    filterHistoryTimeline(portId);
  });

  document.getElementById('history-search-input').addEventListener('input', () => {
    filterHistoryTimeline(portId);
  });
}

function renderHistoryTimeline(history, filter = 'all', searchTerm = '') {
  let filteredHistory = history;

  if (filter !== 'all') {
    filteredHistory = filteredHistory.filter(entry => entry.direction === filter);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredHistory = filteredHistory.filter(entry => {
      const hexStr = entry.rawData.map(b => b.toString(16).padStart(2, '0')).join(' ').toLowerCase();
      let textStr = '';
      for (const byte of entry.rawData) {
        if (byte >= 32 && byte <= 126) {
          textStr += String.fromCharCode(byte);
        }
      }
      return hexStr.includes(term) || textStr.toLowerCase().includes(term);
    });
  }

  if (filteredHistory.length === 0) {
    return '<div class="history-empty">没有匹配的记录</div>';
  }

  return filteredHistory.map((entry, index) => {
    const hexStr = entry.rawData.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    let textStr = '';
    for (const byte of entry.rawData) {
      if (byte >= 32 && byte <= 126) {
        textStr += String.fromCharCode(byte);
      } else {
        textStr += '.';
      }
    }

    const directionClass = entry.direction === 'RX' ? 'rx' : 'tx';

    return `
      <div class="history-entry ${directionClass}">
        <div class="history-entry-header">
          <span class="history-time">${entry.timestamp}</span>
          <span class="history-direction">${entry.direction}</span>
          <span class="history-length">${entry.length} bytes</span>
        </div>
        <div class="history-entry-data">
          <div class="history-hex">${hexStr}</div>
          <div class="history-text">${textStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterHistoryTimeline(portId) {
  const filter = document.getElementById('history-direction-filter').value;
  const searchTerm = document.getElementById('history-search-input').value;
  const history = dataHistory[portId];

  const timeline = document.getElementById('history-timeline');
  timeline.innerHTML = renderHistoryTimeline(history, filter, searchTerm);

  let filteredCount = history.length;
  if (filter !== 'all' || searchTerm) {
    let filtered = history;
    if (filter !== 'all') {
      filtered = filtered.filter(entry => entry.direction === filter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => {
        const hexStr = entry.rawData.map(b => b.toString(16).padStart(2, '0')).join(' ').toLowerCase();
        let textStr = '';
        for (const byte of entry.rawData) {
          if (byte >= 32 && byte <= 126) {
            textStr += String.fromCharCode(byte);
          }
        }
        return hexStr.includes(term) || textStr.toLowerCase().includes(term);
      });
    }
    filteredCount = filtered.length;
  }

  document.getElementById('history-count').textContent = filteredCount;
}

function searchHistory(portId) {
  filterHistoryTimeline(portId);
}

function showPresetManager() {
  let presetModal = document.getElementById('preset-manager-modal');
  if (presetModal) {
    presetModal.remove();
  }

  presetModal = document.createElement('div');
  presetModal.id = 'preset-manager-modal';
  presetModal.className = 'serial-tool-modal';
  presetModal.innerHTML = `
    <div class="serial-tool-modal-content">
      <div class="serial-tool-modal-header">
        <h3>配置预设管理</h3>
        <button class="serial-tool-modal-close" onclick="this.closest('.serial-tool-modal').remove()">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="serial-tool-modal-body">
        <div class="preset-list" id="preset-list">
          ${renderPresetList()}
        </div>
      </div>
      <div class="serial-tool-modal-footer">
        <button class="serial-tool-btn serial-tool-btn-primary" onclick="this.closest('.serial-tool-modal').remove()">
          关闭
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(presetModal);
}

function renderPresetList() {
  if (configPresets.length === 0) {
    return '<div class="preset-empty">暂无保存的配置预设</div>';
  }

  return configPresets.map(preset => `
    <div class="preset-item" data-preset-id="${preset.id}">
      <div class="preset-info">
        <span class="preset-name">${preset.name}</span>
        <span class="preset-config">${preset.config.baudRate} | ${preset.config.dataBits}位 | ${preset.config.parity} | ${preset.config.stopBits}停止位</span>
        <span class="preset-date">创建于: ${new Date(preset.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      <div class="preset-actions">
        <button class="serial-tool-btn serial-tool-btn-outline serial-tool-btn-sm" onclick="deleteConfigPreset('${preset.id}'); showPresetManager();">
          <i class="fa-solid fa-trash"></i> 删除
        </button>
      </div>
    </div>
  `).join('');
}

window.saveCurrentConfigAsPreset = saveCurrentConfigAsPreset;
window.loadConfigPreset = loadConfigPreset;
window.deleteConfigPreset = deleteConfigPreset;
window.exportData = exportData;
window.showHistoryBrowser = showHistoryBrowser;
window.showPresetManager = showPresetManager;
window.searchHistory = searchHistory;
