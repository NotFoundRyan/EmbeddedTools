let tokenHistory = [];
let etUpdateTimer = null;

function initOnenetTool() {
  loadTokenHistory();
  setupOnenetEventListeners();
  setDefaultEt();
  startEtUpdateTimer();
}

function setupOnenetEventListeners() {
  const productIdInput = document.getElementById('onenet-product-id');
  const deviceNameInput = document.getElementById('onenet-device-name');
  const accessKeyInput = document.getElementById('onenet-access-key');
  const etDatetimeInput = document.getElementById('onenet-et-datetime');
  const algorithmSelect = document.getElementById('onenet-algorithm');
  const generateBtn = document.getElementById('onenet-generate-btn');
  const clearBtn = document.getElementById('onenet-clear-btn');
  const copyBtn = document.getElementById('onenet-copy-btn');

  if (productIdInput) {
    productIdInput.addEventListener('input', debounce(generateToken, 300));
  }
  if (deviceNameInput) {
    deviceNameInput.addEventListener('input', debounce(generateToken, 300));
  }
  if (accessKeyInput) {
    accessKeyInput.addEventListener('input', debounce(generateToken, 300));
  }
  if (etDatetimeInput) {
    etDatetimeInput.addEventListener('change', () => {
      updateEtInfo();
      generateToken();
    });
  }
  if (algorithmSelect) {
    algorithmSelect.addEventListener('change', generateToken);
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', generateToken);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearForm);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', copyToken);
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function setDefaultEt() {
  setEtPreset(1);
}

function setEtPreset(hours) {
  const etDatetimeInput = document.getElementById('onenet-et-datetime');
  if (!etDatetimeInput) return;

  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const year = future.getFullYear();
  const month = String(future.getMonth() + 1).padStart(2, '0');
  const day = String(future.getDate()).padStart(2, '0');
  const hoursStr = String(future.getHours()).padStart(2, '0');
  const minutes = String(future.getMinutes()).padStart(2, '0');
  const seconds = String(future.getSeconds()).padStart(2, '0');

  etDatetimeInput.value = `${year}-${month}-${day}T${hoursStr}:${minutes}:${seconds}`;

  updateEtInfo();
  generateToken();
}

function getEtTimestamp() {
  const etDatetimeInput = document.getElementById('onenet-et-datetime');
  if (!etDatetimeInput || !etDatetimeInput.value) {
    return 0;
  }

  const date = new Date(etDatetimeInput.value);
  return Math.floor(date.getTime() / 1000);
}

function updateEtInfo() {
  const et = getEtTimestamp();
  const timestampEl = document.getElementById('onenet-et-timestamp');
  const remainingEl = document.getElementById('onenet-et-remaining');

  if (timestampEl) {
    timestampEl.textContent = et > 0 ? et : '-';
  }

  if (remainingEl) {
    if (et > 0) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = et - now;

      if (remaining > 0) {
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;

        let remainingStr = '';
        if (days > 0) remainingStr += `${days}天`;
        if (hours > 0 || days > 0) remainingStr += `${hours}时`;
        remainingStr += `${minutes}分${seconds}秒`;

        remainingEl.textContent = remainingStr;
        remainingEl.style.color = remaining < 300 ? '#ef4444' : '#10b981';
      } else {
        remainingEl.textContent = '已过期';
        remainingEl.style.color = '#ef4444';
      }
    } else {
      remainingEl.textContent = '-';
      remainingEl.style.color = '#6b7280';
    }
  }
}

function startEtUpdateTimer() {
  if (etUpdateTimer) {
    clearInterval(etUpdateTimer);
  }

  etUpdateTimer = setInterval(() => {
    updateEtInfo();
  }, 1000);
}

function clearForm() {
  document.getElementById('onenet-product-id').value = '';
  document.getElementById('onenet-device-name').value = '';
  document.getElementById('onenet-access-key').value = '';
  document.getElementById('onenet-result').value = '';
  setEtPreset(1);
}

async function generateToken() {
  const productId = document.getElementById('onenet-product-id')?.value?.trim() || '';
  const deviceName = document.getElementById('onenet-device-name')?.value?.trim() || '';
  const accessKey = document.getElementById('onenet-access-key')?.value?.trim() || '';
  const et = getEtTimestamp();
  const method = document.getElementById('onenet-algorithm')?.value || 'sha256';

  const resultEl = document.getElementById('onenet-result');

  if (!productId || !deviceName || !accessKey) {
    if (resultEl) {
      resultEl.value = '';
      resultEl.placeholder = '请填写所有必填项...';
    }
    return;
  }

  if (!et || et <= 0) {
    if (resultEl) {
      resultEl.value = '';
      resultEl.placeholder = '请设置有效的过期时间...';
    }
    return;
  }

  try {
    const version = '2018-10-31';

    const res = `products/${productId}/devices/${deviceName}`;

    const key = base64ToArrayBuffer(accessKey);

    const org = `${et}\n${method}\n${res}\n${version}`;

    const sign = await hmacSign(key, org, method);

    const signEncoded = encodeURIComponent(sign);
    const resEncoded = encodeURIComponent(res);

    const token = `version=${version}&res=${resEncoded}&et=${et}&method=${method}&sign=${signEncoded}`;

    if (resultEl) {
      resultEl.value = token;
    }

    saveToHistory(productId, deviceName, accessKey, et, method, token);

    return token;

  } catch (error) {
    console.error('Token generation error:', error);
    if (resultEl) {
      resultEl.value = '生成失败: ' + error.message;
    }
  }
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function hmacSign(key, message, method) {
  const keyArray = new Uint8Array(key);

  if (method === 'md5') {
    return hmacMd5(keyArray, message);
  }

  let algorithm;
  switch (method) {
    case 'sha256':
      algorithm = 'SHA-256';
      break;
    case 'sha1':
      algorithm = 'SHA-1';
      break;
    default:
      algorithm = 'SHA-256';
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);

  const signatureArray = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }

  return btoa(binary);
}

function hmacMd5(key, message) {
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  if (key.length > 64) {
    key = new Uint8Array(md5Hash(key));
  }

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);

  for (let i = 0; i < 64; i++) {
    ipad[i] = (i < key.length ? key[i] : 0) ^ 0x36;
    opad[i] = (i < key.length ? key[i] : 0) ^ 0x5c;
  }

  const innerData = new Uint8Array(64 + messageBytes.length);
  innerData.set(ipad, 0);
  innerData.set(messageBytes, 64);

  const innerHash = md5Hash(innerData);

  const outerData = new Uint8Array(64 + 16);
  outerData.set(opad, 0);
  outerData.set(innerHash, 64);

  const outerHash = md5Hash(outerData);

  let binary = '';
  for (let i = 0; i < outerHash.length; i++) {
    binary += String.fromCharCode(outerHash[i]);
  }

  return btoa(binary);
}

function md5Hash(data) {
  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]);

  const S = new Uint8Array([
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ]);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const originalLength = data.length;
  const paddedLength = Math.ceil((originalLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[originalLength] = 0x80;

  const lengthBits = BigInt(originalLength) * 8n;
  const view = new DataView(padded.buffer);
  view.setBigUint64(paddedLength - 8, lengthBits, true);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(offset + i * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F, g;

      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + leftRotate(F, S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = new Uint8Array(16);
  const resultView = new DataView(result.buffer);
  resultView.setUint32(0, a0, true);
  resultView.setUint32(4, b0, true);
  resultView.setUint32(8, c0, true);
  resultView.setUint32(12, d0, true);

  return result;
}

function leftRotate(x, c) {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

function copyToken() {
  const resultEl = document.getElementById('onenet-result');
  if (!resultEl || !resultEl.value) {
    return;
  }

  navigator.clipboard.writeText(resultEl.value).then(() => {
    showOnenetToast('已复制到剪贴板');
  }).catch(() => {
    resultEl.select();
    document.execCommand('copy');
    showOnenetToast('已复制到剪贴板');
  });
}

function showOnenetToast(message) {
  const toast = document.getElementById('onenet-copy-toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 1500);
  }
}

function saveToHistory(productId, deviceName, accessKey, et, method, token) {
  const entry = {
    id: Date.now(),
    productId,
    deviceName,
    accessKey,
    et,
    method,
    token,
    createdAt: new Date().toLocaleString('zh-CN')
  };

  tokenHistory.unshift(entry);
  if (tokenHistory.length > 10) {
    tokenHistory.pop();
  }

  localStorage.setItem('onenetTokenHistory', JSON.stringify(tokenHistory));
  renderHistory();
}

function loadTokenHistory() {
  try {
    const saved = localStorage.getItem('onenetTokenHistory');
    if (saved) {
      tokenHistory = JSON.parse(saved);
      renderHistory();
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function renderHistory() {
  const container = document.getElementById('onenet-history-list');
  if (!container) return;

  if (tokenHistory.length === 0) {
    container.innerHTML = '<div class="onenet-history-empty">暂无历史记录</div>';
    return;
  }

  container.innerHTML = tokenHistory.map(entry => `
    <div class="onenet-history-item" onclick="loadFromHistory('${entry.id}')">
      <div class="onenet-history-info">
        <span class="onenet-history-name">${entry.productId} / ${entry.deviceName}</span>
        <span class="onenet-history-time">${entry.createdAt}</span>
      </div>
      <div class="onenet-history-actions">
        <button class="onenet-history-btn" onclick="event.stopPropagation(); deleteFromHistory('${entry.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function loadFromHistory(id) {
  const entry = tokenHistory.find(e => e.id === parseInt(id));
  if (!entry) return;

  document.getElementById('onenet-product-id').value = entry.productId;
  document.getElementById('onenet-device-name').value = entry.deviceName;
  document.getElementById('onenet-access-key').value = entry.accessKey;
  document.getElementById('onenet-algorithm').value = entry.method;

  const etDatetimeInput = document.getElementById('onenet-et-datetime');
  if (etDatetimeInput && entry.et) {
    const date = new Date(entry.et * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    etDatetimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  updateEtInfo();
  generateToken();
}

function deleteFromHistory(id) {
  tokenHistory = tokenHistory.filter(e => e.id !== parseInt(id));
  localStorage.setItem('onenetTokenHistory', JSON.stringify(tokenHistory));
  renderHistory();
}

function clearHistory() {
  tokenHistory = [];
  localStorage.removeItem('onenetTokenHistory');
  renderHistory();
}

window.initOnenetTool = initOnenetTool;
window.generateToken = generateToken;
window.copyToken = copyToken;
window.loadFromHistory = loadFromHistory;
window.deleteFromHistory = deleteFromHistory;
window.clearHistory = clearHistory;
window.setEtPreset = setEtPreset;
