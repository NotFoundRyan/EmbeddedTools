let autoSendInterval = null;
let rxCount = 0;
let txCount = 0;
let isSerialConnected = false;

function initSerialTool() {
  setupSerialEventListeners();
  setupTauriEventListeners();
  refreshSerialPorts();
}

function getTauriAPI() {
  return window.__TAURI__;
}

function setupSerialEventListeners() {
  document.getElementById('refresh-ports-btn').addEventListener('click', refreshSerialPorts);
  document.getElementById('open-serial-btn').addEventListener('click', openSerialPort);
  document.getElementById('close-serial-btn').addEventListener('click', closeSerialPort);
  document.getElementById('send-btn').addEventListener('click', sendData);
  document.getElementById('clear-send-btn').addEventListener('click', () => {
    document.getElementById('send-data').value = '';
  });
  document.getElementById('clear-receive-btn').addEventListener('click', () => {
    document.getElementById('receive-data').innerHTML = '';
    rxCount = 0;
    txCount = 0;
    updateRxTxCount();
  });

  document.getElementById('auto-send').addEventListener('change', (e) => {
    if (e.target.checked) {
      startAutoSend();
    } else {
      stopAutoSend();
    }
  });
}

function setupTauriEventListeners() {
  const tauri = getTauriAPI();
  if (tauri && tauri.event) {
    tauri.event.listen('serial-data', (event) => {
      const data = event.payload;
      if (data && data.length > 0) {
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(new Uint8Array(data));
        displayReceivedData(text);
        rxCount += data.length;
        updateRxTxCount();
      }
    }).catch(error => {
      console.error('Failed to listen to serial-data event:', error);
    });

    tauri.event.listen('serial-error', (event) => {
      const error = event.payload;
      logError('串口错误: ' + error, '串口工具');
    }).catch(error => {
      console.error('Failed to listen to serial-error event:', error);
    });
  }
}

async function refreshSerialPorts() {
  const portSelect = document.getElementById('serial-port');
  portSelect.innerHTML = '<option value="">未选择串口</option>';

  try {
    const tauri = getTauriAPI();
    if (!tauri || !tauri.core) {
      logError('串口功能需要在 Tauri 应用中使用。请使用 npm run tauri dev 启动应用。', '串口工具');
      return;
    }

    const ports = await tauri.core.invoke('list_serial_ports');

    ports.forEach(portName => {
      const option = document.createElement('option');
      option.value = portName;
      option.textContent = portName;
      portSelect.appendChild(option);
    });

    if (ports.length === 0) {
      logError('未检测到串口设备。请确保设备已连接。', '串口工具');
    }
  } catch (error) {
    console.error('获取串口列表失败:', error);
    if (error.message === 'Tauri API not available') {
      logError('串口功能需要在 Tauri 应用中使用。请使用 npm run tauri dev 启动应用。', '串口工具');
    } else {
      logError('获取串口列表失败: ' + error, '串口工具');
    }
  }
}

async function openSerialPort() {
  const portSelect = document.getElementById('serial-port');
  const selectedPort = portSelect.value;

  if (!selectedPort) {
    logError('请先选择一个串口！', '串口工具');
    return;
  }

  if (isSerialConnected) {
    logError('串口已经打开！', '串口工具');
    return;
  }

  const baudRate = parseInt(document.getElementById('baud-rate').value);
  const dataBits = parseInt(document.getElementById('data-bits').value);
  const stopBitsValue = parseInt(document.getElementById('stop-bits').value);
  const parityValue = document.getElementById('parity').value;

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
    parity = 0;
  } else if (parityValue === 'even') {
    parity = 2;
  } else if (parityValue === 'odd') {
    parity = 1;
  } else {
    parity = 0;
  }

  try {
    const tauri = getTauriAPI();
    if (!tauri || !tauri.core) {
      logError('串口功能需要在 Tauri 应用中使用。请使用 npm run tauri dev 启动应用。', '串口工具');
      return;
    }

    await tauri.core.invoke('open_serial_port', {
      portName: selectedPort,
      baudRate: baudRate,
      dataBits: dataBits,
      stopBits: stopBits,
      parity: parity
    });

    isSerialConnected = true;
    updateConnectionStatus(true);
    document.getElementById('open-serial-btn').disabled = true;
    document.getElementById('close-serial-btn').disabled = false;

  } catch (error) {
    console.error('打开串口失败:', error);
    logError('打开串口失败: ' + error, '串口工具');
  }
}

async function closeSerialPort() {
  if (!isSerialConnected) return;

  try {
    stopAutoSend();

    const tauri = getTauriAPI();
    if (!tauri || !tauri.core) {
      return;
    }

    await tauri.core.invoke('close_serial_port');

    isSerialConnected = false;
    updateConnectionStatus(false);
    document.getElementById('open-serial-btn').disabled = false;
    document.getElementById('close-serial-btn').disabled = true;

  } catch (error) {
    console.error('关闭串口失败:', error);
    logError('关闭串口失败: ' + error, '串口工具');
  }
}

async function sendData() {
  if (!isSerialConnected) {
    logError('请先打开串口！', '串口工具');
    return;
  }

  const sendDataInput = document.getElementById('send-data');
  const data = sendDataInput.value;

  if (!data) {
    logError('请输入要发送的数据！', '串口工具');
    return;
  }

  const sendFormat = document.querySelector('input[name="send-format"]:checked').value;
  let bytesToSend;

  if (sendFormat === 'hex') {
    bytesToSend = parseHexString(data);
  } else {
    const encoder = new TextEncoder();
    bytesToSend = Array.from(encoder.encode(data));
  }

  try {
    const tauri = getTauriAPI();
    if (!tauri || !tauri.core) {
      logError('串口功能需要在 Tauri 应用中使用。请使用 npm run tauri dev 启动应用。', '串口工具');
      return;
    }

    await tauri.core.invoke('write_serial_port', { data: bytesToSend });
    txCount += bytesToSend.length;
    updateRxTxCount();
  } catch (error) {
    console.error('发送数据失败:', error);
    logError('发送数据失败: ' + error, '串口工具');
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

function startAutoSend() {
  if (autoSendInterval) {
    clearInterval(autoSendInterval);
  }

  const interval = parseInt(document.getElementById('send-interval').value) || 1000;

  autoSendInterval = setInterval(() => {
    sendData();
  }, interval);
}

function stopAutoSend() {
  if (autoSendInterval) {
    clearInterval(autoSendInterval);
    autoSendInterval = null;
  }
}

function displayReceivedData(data) {
  const receiveDataDiv = document.getElementById('receive-data');
  const showHex = document.getElementById('show-hex').checked;
  const showTime = document.getElementById('show-time').checked;
  const autoScroll = document.getElementById('auto-scroll').checked;

  let displayContent = '';

  if (showTime) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    displayContent += `<span class="timestamp">[${timeStr}]</span>`;
  }

  if (showHex) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    displayContent += `<span class="data-content hex">${hexString}</span>`;
  } else {
    displayContent += `<span class="data-content">${escapeHtml(data)}</span>`;
  }

  const dataLine = document.createElement('div');
  dataLine.className = 'data-line';
  dataLine.innerHTML = displayContent;

  receiveDataDiv.appendChild(dataLine);

  if (autoScroll) {
    receiveDataDiv.scrollTop = receiveDataDiv.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateConnectionStatus(connected) {
  const statusElement = document.getElementById('connection-status');

  if (connected) {
    statusElement.textContent = '状态: 已连接';
    statusElement.classList.add('connected');
  } else {
    statusElement.textContent = '状态: 未连接';
    statusElement.classList.remove('connected');
  }
}

function updateRxTxCount() {
  const countElement = document.getElementById('rx-tx-count');
  countElement.textContent = `RX: ${rxCount} | TX: ${txCount}`;
}
