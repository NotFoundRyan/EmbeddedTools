let currentTimestamp = Date.now();
let updateTimer = null;
let currentTimezone = 'local';

const timezones = [
  { id: 'local', name: '本地时间', offset: null },
  { id: 'UTC', name: 'UTC', offset: 0 },
  { id: 'Asia/Shanghai', name: '北京 (UTC+8)', offset: 8 },
  { id: 'Asia/Tokyo', name: '东京 (UTC+9)', offset: 9 },
  { id: 'Asia/Seoul', name: '首尔 (UTC+9)', offset: 9 },
  { id: 'Asia/Singapore', name: '新加坡 (UTC+8)', offset: 8 },
  { id: 'Asia/Hong_Kong', name: '香港 (UTC+8)', offset: 8 },
  { id: 'Asia/Taipei', name: '台北 (UTC+8)', offset: 8 },
  { id: 'America/New_York', name: '纽约 (UTC-5)', offset: -5 },
  { id: 'America/Los_Angeles', name: '洛杉矶 (UTC-8)', offset: -8 },
  { id: 'America/Chicago', name: '芝加哥 (UTC-6)', offset: -6 },
  { id: 'Europe/London', name: '伦敦 (UTC+0)', offset: 0 },
  { id: 'Europe/Paris', name: '巴黎 (UTC+1)', offset: 1 },
  { id: 'Europe/Berlin', name: '柏林 (UTC+1)', offset: 1 },
  { id: 'Europe/Moscow', name: '莫斯科 (UTC+3)', offset: 3 },
  { id: 'Australia/Sydney', name: '悉尼 (UTC+11)', offset: 11 },
  { id: 'Pacific/Auckland', name: '奥克兰 (UTC+13)', offset: 13 },
  { id: 'Asia/Dubai', name: '迪拜 (UTC+4)', offset: 4 },
  { id: 'Asia/Kolkata', name: '孟买 (UTC+5:30)', offset: 5.5 },
];

function initTimestampTool() {
  startLiveUpdate();
  setCurrentTime();
  renderTimezoneSelector();
  setupEventListeners();
}

function setupEventListeners() {
  const timestampInput = document.getElementById('timestamp-input');
  const timestampUnit = document.getElementById('timestamp-unit');
  const dateInput = document.getElementById('date-input');
  const timeInput = document.getElementById('time-input');

  if (timestampInput) {
    timestampInput.addEventListener('input', () => {
      convertFromTimestamp();
    });
    timestampInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        convertFromTimestamp();
      }
    });
  }

  if (timestampUnit) {
    timestampUnit.addEventListener('change', () => {
      convertFromTimestamp();
    });
  }

  if (dateInput) {
    dateInput.addEventListener('change', () => {
      convertFromDate();
    });
  }

  if (timeInput) {
    timeInput.addEventListener('change', () => {
      convertFromDate();
    });
  }
}

function startLiveUpdate() {
  if (updateTimer) {
    clearInterval(updateTimer);
  }

  updateTimer = setInterval(() => {
    currentTimestamp = Date.now();

    const liveEl = document.getElementById('live-timestamp');
    if (liveEl) {
      liveEl.textContent = currentTimestamp;
    }

    const liveDate = new Date(currentTimestamp);

    const liveLocalEl = document.getElementById('live-local-time');
    const liveUtcEl = document.getElementById('live-utc-time');
    const liveSelectedTzEl = document.getElementById('live-selected-tz-time');

    if (liveLocalEl) {
      liveLocalEl.textContent = liveDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }

    if (liveUtcEl) {
      liveUtcEl.textContent = liveDate.toUTCString();
    }

    if (liveSelectedTzEl) {
      liveSelectedTzEl.textContent = formatInTimezone(liveDate, currentTimezone);
    }
  }, 100);
}

function renderTimezoneSelector() {
  const container = document.getElementById('timezone-selector');
  if (!container) return;

  container.innerHTML = timezones.map(tz => `
    <button class="timezone-btn ${tz.id === currentTimezone ? 'active' : ''}"
            onclick="selectTimezone('${tz.id}')"
            title="${tz.name}">
      ${tz.name}
    </button>
  `).join('');
}

function selectTimezone(tzId) {
  currentTimezone = tzId;
  renderTimezoneSelector();
  convertFromTimestamp();

  const liveSelectedTzLabel = document.getElementById('live-selected-tz-label');
  const selectedTz = timezones.find(tz => tz.id === currentTimezone);
  if (liveSelectedTzLabel && selectedTz) {
    liveSelectedTzLabel.textContent = selectedTz.name;
  }
}

function convertFromTimestamp() {
  const input = document.getElementById('timestamp-input');
  const unit = document.getElementById('timestamp-unit');

  if (!input) return;

  let timestamp = parseInt(input.value);

  if (isNaN(timestamp) || input.value === '') {
    const now = Date.now();
    timestamp = now;
  }

  if (unit && unit.value === 's') {
    timestamp = timestamp * 1000;
  }

  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    showError('无效的时间戳');
    return;
  }

  updateResults(date);
}

function convertFromDate() {
  const dateInput = document.getElementById('date-input');
  const timeInput = document.getElementById('time-input');

  if (!dateInput || !timeInput) return;

  const dateStr = `${dateInput.value}T${timeInput.value}`;
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    showError('无效的日期时间');
    return;
  }

  updateResults(date);

  const timestampInput = document.getElementById('timestamp-input');
  const unit = document.getElementById('timestamp-unit');
  if (timestampInput) {
    timestampInput.value = unit && unit.value === 's' ? Math.floor(date.getTime() / 1000) : date.getTime();
  }
}

function formatInTimezone(date, tzId) {
  if (tzId === 'local') {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  try {
    return date.toLocaleString('zh-CN', {
      timeZone: tzId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return date.toLocaleString('zh-CN');
  }
}

function updateResults(date) {
  const localEl = document.getElementById('result-local');
  const utcEl = document.getElementById('result-utc');
  const isoEl = document.getElementById('result-iso');
  const unixSEl = document.getElementById('result-unix-s');
  const unixMsEl = document.getElementById('result-unix-ms');
  const selectedTzEl = document.getElementById('result-selected-tz');
  const selectedTzNameEl = document.getElementById('result-selected-tz-name');

  if (localEl) localEl.textContent = date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  if (utcEl) utcEl.textContent = date.toUTCString();
  if (isoEl) isoEl.textContent = date.toISOString();
  if (unixSEl) unixSEl.textContent = Math.floor(date.getTime() / 1000);
  if (unixMsEl) unixMsEl.textContent = date.getTime();

  const selectedTz = timezones.find(tz => tz.id === currentTimezone);
  if (selectedTzNameEl) selectedTzNameEl.textContent = selectedTz ? selectedTz.name : '本地时间';
  if (selectedTzEl) selectedTzEl.textContent = formatInTimezone(date, currentTimezone);
}

function showError(message) {
  const errorEl = document.getElementById('timestamp-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 3000);
  }
}

function setCurrentTime() {
  const now = new Date();
  const dateInput = document.getElementById('date-input');
  const timeInput = document.getElementById('time-input');
  const timestampInput = document.getElementById('timestamp-input');
  const unit = document.getElementById('timestamp-unit');

  if (dateInput) {
    dateInput.value = now.toISOString().split('T')[0];
  }
  if (timeInput) {
    timeInput.value = now.toTimeString().split(' ')[0];
  }
  if (timestampInput) {
    timestampInput.value = unit && unit.value === 's' ? Math.floor(now.getTime() / 1000) : now.getTime();
  }

  convertFromDate();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showCopySuccess();
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopySuccess();
  });
}

function showCopySuccess() {
  const toast = document.getElementById('copy-toast');
  if (toast) {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 1500);
  }
}

window.initTimestampTool = initTimestampTool;
window.convertFromTimestamp = convertFromTimestamp;
window.convertFromDate = convertFromDate;
window.setCurrentTime = setCurrentTime;
window.copyToClipboard = copyToClipboard;
window.selectTimezone = selectTimezone;
