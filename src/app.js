const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;

let currentTool = 'lcd';
let errorLog = [];

function logError(message, source = '系统') {
  const timestamp = new Date();
  const errorEntry = {
    time: timestamp,
    message: message,
    source: source
  };
  errorLog.push(errorEntry);
  displayError(errorEntry);
  console.error(`[${source}] ${message}`);
}

function displayError(errorEntry) {
  const errorLogContent = document.getElementById('error-log-content');
  if (!errorLogContent) return;

  const emptyMessage = errorLogContent.querySelector('.error-log-empty');
  if (emptyMessage) {
    emptyMessage.remove();
  }

  const entryDiv = document.createElement('div');
  entryDiv.className = 'error-log-entry';

  const timeStr = errorEntry.time.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(errorEntry.time.getMilliseconds()).padStart(3, '0');

  entryDiv.innerHTML = `
    <div class="error-time">[${timeStr}]</div>
    <div class="error-message">${escapeHtml(errorEntry.message)}</div>
    <div class="error-source">来源: ${errorEntry.source}</div>
  `;

  errorLogContent.insertBefore(entryDiv, errorLogContent.firstChild);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function initApp() {
  try {
    const splashScreen = document.getElementById('splash-screen');
    const appContainer = document.getElementById('app-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const splashStatus = document.getElementById('splash-status');

    const errorLogContent = document.getElementById('error-log-content');
    if (errorLogContent) {
      errorLogContent.innerHTML = '<div class="error-log-empty">暂无错误日志</div>';
    }

    const steps = [
      { progress: 10, status: '加载核心模块...' },
      { progress: 30, status: '初始化LCD点阵工具...' },
      { progress: 50, status: '初始化串口调试助手...' },
      { progress: 70, status: '配置事件监听器...' },
      { progress: 90, status: '准备打开应用...' },
      { progress: 100, status: '应用初始化完毕，准备打开应用...' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 300));
      progressBar.style.width = step.progress + '%';
      progressText.textContent = step.progress + '%';
      splashStatus.textContent = step.status;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    splashScreen.classList.add('hidden');
    appContainer.classList.add('visible');

    setTimeout(() => {
      splashScreen.style.display = 'none';
    }, 500);

    initNavigation();
    initToolsAfterSplash();
  } catch (error) {
    console.error('初始化失败:', error);
    const splashStatus = document.getElementById('splash-status');
    if (splashStatus) {
      splashStatus.textContent = '初始化失败: ' + error.message;
      splashStatus.style.color = '#f44336';
    }
    logError('应用初始化失败: ' + error.message, '系统');
  }
}

function initToolsAfterSplash() {
  setTimeout(() => {
    if (typeof initLCDTool === 'function') {
      initLCDTool();
    }
    if (typeof initSerialTool === 'function') {
      initSerialTool();
    }
  }, 600);
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const toolPanels = document.querySelectorAll('.tool-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tool = item.dataset.tool;

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      toolPanels.forEach(panel => panel.classList.remove('active'));
      const targetPanel = document.getElementById(tool + '-tool');
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      currentTool = tool;
    });
  });

  initSettingsBtn();
}

function initSettingsBtn() {
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');

  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => {
      openSettingsPanel();
    });
  }
}

function openSettingsPanel() {
  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'settings-panel-overlay';
  settingsPanel.innerHTML = `
    <div class="settings-header">
      <h2>设置</h2>
      <button class="close-settings-btn">✕</button>
    </div>

    <div class="settings-content">
        <div class="settings-section">
          <h2>窗口设置</h2>
          <div class="setting-item">
            <label>
              <input type="checkbox" id="always-on-top" />
              窗口始终置顶
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h2>关于</h2>
          <div class="setting-item">
            <div class="version-info">
              <span>当前版本: </span>
              <span id="current-version">0.1.0</span>
            </div>
          </div>
          <div class="setting-item">
            <button id="check-update-btn" class="check-update-btn">检查更新</button>
          </div>
        </div>

        <div class="settings-section">
          <h2>错误日志</h2>
          <div class="error-log-header">
            <button id="clear-error-log-btn">清空日志</button>
          </div>
          <div id="error-log-content" class="error-log-content"></div>
        </div>
      </div>
  `;

  document.body.appendChild(settingsPanel);

  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  if (settingsToggleBtn) {
    settingsToggleBtn.classList.add('hidden');
  }

  requestAnimationFrame(() => {
    settingsPanel.classList.add('open');
  });

  const closeSettingsBtn = settingsPanel.querySelector('.close-settings-btn');
  const alwaysOnTopCheckbox = settingsPanel.querySelector('#always-on-top');
  const clearErrorLogBtn = settingsPanel.querySelector('#clear-error-log-btn');
  const checkUpdateBtn = settingsPanel.querySelector('#check-update-btn');

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    setTimeout(() => {
      settingsPanel.remove();
      if (settingsToggleBtn) {
        settingsToggleBtn.classList.remove('hidden');
      }
    }, 300);
  });

  if (alwaysOnTopCheckbox) {
    alwaysOnTopCheckbox.addEventListener('change', (e) => {
      setAlwaysOnTop(e.target.checked);
    });
  }

  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', checkForUpdates);
  }

  if (clearErrorLogBtn) {
    clearErrorLogBtn.addEventListener('click', clearErrorLog);
  }

  const errorLogContent = settingsPanel.querySelector('#error-log-content');
  if (errorLogContent) {
    errorLogContent.innerHTML = '<div class="error-log-empty">暂无错误日志</div>';
    errorLog.forEach(error => displayError(error));
  }
}

function setAlwaysOnTop(enabled) {
  const tauri = window.__TAURI__;
  if (tauri && tauri.window) {
    tauri.window.getCurrentWindow().then(window => {
      window.setAlwaysOnTop(enabled).catch(error => {
        logError('设置窗口置顶失败: ' + error, '设置');
      });
    });
  }
}

function clearErrorLog() {
  errorLog = [];
  const errorLogContent = document.getElementById('error-log-content');
  if (errorLogContent) {
    errorLogContent.innerHTML = '<div class="error-log-empty">暂无错误日志</div>';
  }
}

async function checkForUpdates() {
  const checkUpdateBtn = document.getElementById('check-update-btn');
  const originalText = checkUpdateBtn.textContent;

  try {
    checkUpdateBtn.textContent = '检查中...';
    checkUpdateBtn.disabled = true;

    const currentVersion = document.getElementById('current-version').textContent;

    const updateInfo = await invoke('check_for_updates', {
      repoOwner: 'NotFoundRyan',
      repoName: 'EmbeddedTools',
      currentVersion: currentVersion
    });

    if (updateInfo.has_update) {
      showUpdateDialog(updateInfo);
    } else {
      alert('当前已是最新版本');
    }
  } catch (error) {
    logError('检查更新失败: ' + error, '系统');
    alert('检查更新失败: ' + error);
  } finally {
    checkUpdateBtn.textContent = originalText;
    checkUpdateBtn.disabled = false;
  }
}

function showUpdateDialog(updateInfo) {
  const dialog = document.createElement('div');
  dialog.className = 'update-dialog-overlay';
  dialog.innerHTML = `
    <div class="update-dialog">
      <div class="update-dialog-header">
        <h3>发现新版本</h3>
        <button class="close-dialog-btn">✕</button>
      </div>
      <div class="update-dialog-content">
        <div class="version-comparison">
          <div class="version-item">
            <span class="version-label">当前版本:</span>
            <span class="version-value">${updateInfo.current_version}</span>
          </div>
          <div class="version-item">
            <span class="version-label">最新版本:</span>
            <span class="version-value">${updateInfo.latest_version}</span>
          </div>
        </div>
        <div class="release-notes">
          <h4>更新说明:</h4>
          <pre>${updateInfo.release_notes || '暂无更新说明'}</pre>
        </div>
      </div>
      <div class="update-dialog-footer">
        <button class="download-btn" data-url="${updateInfo.download_url}">下载更新</button>
        <button class="cancel-btn">稍后提醒</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  requestAnimationFrame(() => {
    dialog.classList.add('open');
  });

  const closeDialogBtn = dialog.querySelector('.close-dialog-btn');
  const downloadBtn = dialog.querySelector('.download-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');

  closeDialogBtn.addEventListener('click', () => {
    dialog.classList.remove('open');
    setTimeout(() => dialog.remove(), 300);
  });

  cancelBtn.addEventListener('click', () => {
    dialog.classList.remove('open');
    setTimeout(() => dialog.remove(), 300);
  });

  downloadBtn.addEventListener('click', () => {
    if (updateInfo.download_url) {
      window.open(updateInfo.download_url, '_blank');
    }
  });
}

function invokeWrapper(command, args = {}) {
  return invoke(command, args).catch(error => {
    console.error(`Command ${command} failed:`, error);
    throw error;
  });
}

function listenWrapper(event, callback) {
  return listen(event, callback).catch(error => {
    console.error(`Failed to listen to event ${event}:`, error);
    throw error;
  });
}

document.addEventListener('DOMContentLoaded', initApp);
