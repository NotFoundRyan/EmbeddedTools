let currentTool = 'lcd';
let errorLog = [];

function getTauriAPI() {
  return window.__TAURI__;
}

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

    const totalSteps = 6;
    let currentStep = 0;

    const updateProgress = (progress, status) => {
      const actualProgress = Math.min(Math.max(progress, 0), 100);
      progressBar.style.width = actualProgress + '%';
      progressText.textContent = Math.round(actualProgress) + '%';
      splashStatus.textContent = status;
    };

    const runStep = async (stepName, action, progressValue) => {
      currentStep++;
      const progress = (currentStep / totalSteps) * 100;
      updateProgress(progress, stepName);

      try {
        await action();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`${stepName} 失败:`, error);
        throw error;
      }
    };

    await runStep('初始化应用...', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    }, 16.67);

    await runStep('加载导航系统...', async () => {
      initNavigation();
    }, 33.33);

    await runStep('加载LCD工具...', async () => {
      if (typeof initLCDTool === 'function') {
        initLCDTool();
      }
    }, 50);

    await runStep('加载串口工具...', async () => {
      if (typeof initSerialTool === 'function') {
        initSerialTool();
      }
    }, 66.67);

    await runStep('加载时间戳工具...', async () => {
      if (typeof initTimestampTool === 'function') {
        initTimestampTool();
      }
    }, 83.33);

    await runStep('加载OneNET工具...', async () => {
      if (typeof initOnenetTool === 'function') {
        initOnenetTool();
      }
    }, 100);

    updateProgress(100, '准备就绪');
    await new Promise(resolve => setTimeout(resolve, 200));

    splashScreen.classList.add('hidden');
    appContainer.classList.add('visible');

    setTimeout(() => {
      splashScreen.style.display = 'none';
    }, 500);
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
    <div class="settings-content">
      <div class="settings-header">
        <h2>设置</h2>
      </div>

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
            <span id="current-version">${getFullVersion()}</span>
          </div>
        </div>
        <div class="setting-item">
          <button id="check-update-btn" class="check-update-btn">检查更新</button>
        </div>
        <div class="setting-item">
          <div class="author-info">
            <span>作者: </span>
            <span>${AppConfig.author}</span>
          </div>
        </div>
        <div class="setting-item">
          <div class="tech-stack">
            <h3>技术栈</h3>
            <ul>
              <li>前端框架: 原生 HTML + CSS + JavaScript</li>
              <li>桌面框架: Tauri</li>
              <li>后端语言: Rust</li>
              <li>串口通信: serialport (Rust)</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-header">
          <h2>错误日志</h2>
          <button id="clear-error-log-btn">
            <i class="fas fa-trash-alt"></i>
            清空日志
          </button>
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

  const alwaysOnTopCheckbox = settingsPanel.querySelector('#always-on-top');
  const clearErrorLogBtn = settingsPanel.querySelector('#clear-error-log-btn');
  const checkUpdateBtn = settingsPanel.querySelector('#check-update-btn');
  const settingsContent = settingsPanel.querySelector('.settings-content');

  settingsPanel.addEventListener('click', (e) => {
    if (!settingsContent.contains(e.target)) {
      settingsPanel.classList.remove('open');
      setTimeout(() => {
        settingsPanel.remove();
        if (settingsToggleBtn) {
          settingsToggleBtn.classList.remove('hidden');
        }
      }, 300);
    }
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
  try {
    const tauri = getTauriAPI();
    if (!tauri) {
      logError('Tauri API 不可用', '设置');
      return;
    }
    const currentWindow = tauri.window.getCurrentWindow();
    currentWindow.setAlwaysOnTop(enabled).catch(error => {
      logError('设置窗口置顶失败: ' + error, '设置');
    });
  } catch (error) {
    logError('设置窗口置顶失败: ' + error, '设置');
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
    checkUpdateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
    checkUpdateBtn.disabled = true;

    const currentVersion = getAppVersion();

    const tauri = getTauriAPI();
    if (!tauri) {
      throw new Error('Tauri API 不可用，请确保在应用环境中运行');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const updateInfo = await tauri.core.invoke('check_for_updates', {
        repoOwner: AppConfig.repo.owner,
        repoName: AppConfig.repo.name,
        currentVersion: getFullVersion()
      });

      clearTimeout(timeoutId);

      if (updateInfo.has_update) {
        showUpdateDialog(updateInfo);
      } else {
        showToastMessage('当前已是最新版本，无需更新', 'success');
      }
    } catch (invokeError) {
      clearTimeout(timeoutId);
      throw invokeError;
    }
  } catch (error) {
    let errorMessage = '检查更新失败';
    if (error.message && error.message.includes('network')) {
      errorMessage = '网络连接失败，请检查网络设置';
    } else if (error.message && error.message.includes('timeout')) {
      errorMessage = '请求超时，请稍后重试';
    } else if (error.message) {
      errorMessage = error.message;
    }
    logError('检查更新失败: ' + errorMessage, '系统');
    showToastMessage(errorMessage, 'error');
  } finally {
    checkUpdateBtn.innerHTML = originalText;
    checkUpdateBtn.disabled = false;
  }
}

function showToastMessage(message, type = 'info') {
  const existingToast = document.querySelector('.app-toast-message');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'app-toast-message';
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 10001;
    max-width: 80%;
    text-align: center;
  `;

  if (type === 'success') {
    toast.style.background = '#059669';
    toast.style.color = 'white';
  } else if (type === 'error') {
    toast.style.background = '#dc2626';
    toast.style.color = 'white';
  } else {
    toast.style.background = '#374151';
    toast.style.color = 'white';
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
  const tauri = getTauriAPI();
  if (!tauri) {
    return Promise.reject(new Error('Tauri API 不可用'));
  }
  return tauri.core.invoke(command, args).catch(error => {
    console.error(`Command ${command} failed:`, error);
    throw error;
  });
}

function listenWrapper(event, callback) {
  const tauri = getTauriAPI();
  if (!tauri) {
    return Promise.reject(new Error('Tauri API 不可用'));
  }
  return tauri.event.listen(event, callback).catch(error => {
    console.error(`Failed to listen to event ${event}:`, error);
    throw error;
  });
}

document.addEventListener('DOMContentLoaded', initApp);
