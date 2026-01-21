let originalCanvas;
let originalCtx;
let previewCanvas;
let previewCtx;
let loadedImage = null;
let currentDotMatrix = null;
let currentMode = 'image';

function initLCDTool() {
  originalCanvas = document.getElementById('original-canvas');
  originalCtx = originalCanvas.getContext('2d');
  previewCanvas = document.getElementById('preview-canvas');
  previewCtx = previewCanvas.getContext('2d');

  setupLCDEventListeners();
}

function getTauriAPI() {
  return window.__TAURI__;
}

function setupLCDEventListeners() {
  document.getElementById('load-image-btn').addEventListener('click', loadImage);
  document.getElementById('generate-btn').addEventListener('click', generateDotMatrix);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('clear-btn').addEventListener('click', clearAll);

  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  thresholdSlider.addEventListener('input', (e) => {
    thresholdValue.textContent = e.target.value;
  });

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.target.dataset.mode;
      switchMode(mode);
    });
  });
}

function switchMode(mode) {
  currentMode = mode;

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    }
  });

  const modePanels = document.querySelectorAll('.mode-panel');
  modePanels.forEach(panel => {
    panel.classList.remove('active');
    if (panel.id === `${mode}-mode`) {
      panel.classList.add('active');
    }
  });

  clearAll();
}

function loadImage() {
  const fileInput = document.getElementById('image-upload');
  const file = fileInput.files[0];

  if (!file) {
    logError('请先选择一张图片！', 'LCD工具');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;

      const maxWidth = 400;
      const scale = Math.min(maxWidth / img.width, 1);

      originalCanvas.width = img.width * scale;
      originalCanvas.height = img.height * scale;

      originalCtx.drawImage(img, 0, 0, originalCanvas.width, originalCanvas.height);

      logError('图片加载成功！请点击"生成点阵"按钮。', 'LCD工具');
    };
    img.onerror = () => {
      logError('图片加载失败，请重试！', 'LCD工具');
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    logError('文件读取失败，请重试！', 'LCD工具');
  };
  reader.readAsDataURL(file);
}

function generateDotMatrix() {
  if (currentMode === 'image') {
    generateFromImage();
  } else {
    generateFromText();
  }
}

function generateFromImage() {
  if (!loadedImage) {
    logError('请先加载图片！', 'LCD工具');
    return;
  }

  const targetWidth = parseInt(document.getElementById('width-input').value) || 128;
  const targetHeight = parseInt(document.getElementById('height-input').value) || 64;
  const threshold = parseInt(document.getElementById('threshold').value) || 128;
  const invert = document.getElementById('invert').checked;
  const bitDepth = parseInt(document.getElementById('bit-depth').value) || 1;

  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = targetWidth;
  tempCanvas.height = targetHeight;

  tempCtx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);

  const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;
  const pixels = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    let pixelValue;
    if (bitDepth === 1) {
      pixelValue = gray >= threshold ? 1 : 0;
      if (invert) {
        pixelValue = 1 - pixelValue;
      }
    } else {
      const levels = Math.pow(2, bitDepth);
      pixelValue = Math.floor((gray / 255) * (levels - 1));
      if (invert) {
        pixelValue = levels - 1 - pixelValue;
      }
    }

    pixels.push(pixelValue);
  }

  currentDotMatrix = {
    width: targetWidth,
    height: targetHeight,
    pixels: pixels,
    bitDepth: bitDepth
  };

  drawPreview(pixels, targetWidth, targetHeight, bitDepth);

  const outputData = formatOutputData(pixels, targetWidth, targetHeight, bitDepth);
  document.getElementById('output-data').value = outputData;

  const dataSize = calculateDataSize(pixels, bitDepth);
  document.getElementById('data-size').textContent = `数据大小: ${dataSize} 字节`;
  document.getElementById('pixel-count').textContent = `像素数量: ${pixels.length}`;
}

function generateFromText() {
  const text = document.getElementById('text-input').value;
  const fontFamily = document.getElementById('font-family').value;
  const fontWeight = document.getElementById('font-weight').value;
  const fontSize = parseInt(document.getElementById('font-size').value) || 16;
  const targetWidth = parseInt(document.getElementById('width-input').value) || 128;
  const targetHeight = parseInt(document.getElementById('height-input').value) || 64;
  const threshold = parseInt(document.getElementById('threshold').value) || 128;
  const invert = document.getElementById('invert').checked;
  const bitDepth = parseInt(document.getElementById('bit-depth').value) || 1;

  if (!text) {
    logError('请输入文字！', 'LCD工具');
    return;
  }

  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = targetWidth;
  tempCanvas.height = targetHeight;

  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, targetWidth, targetHeight);

  tempCtx.font = `${fontWeight} ${fontSize}px "${fontFamily}", "Microsoft YaHei", sans-serif`;
  tempCtx.textBaseline = 'middle';
  tempCtx.textAlign = 'center';
  tempCtx.fillStyle = '#000000';

  const centerX = targetWidth / 2;
  const centerY = targetHeight / 2;
  tempCtx.fillText(text, centerX, centerY);

  const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;
  const pixels = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    let pixelValue;
    if (bitDepth === 1) {
      pixelValue = gray < threshold ? 1 : 0;
      if (invert) {
        pixelValue = 1 - pixelValue;
      }
    } else {
      const levels = Math.pow(2, bitDepth);
      pixelValue = Math.floor((gray / 255) * (levels - 1));
      if (invert) {
        pixelValue = levels - 1 - pixelValue;
      }
    }

    pixels.push(pixelValue);
  }

  currentDotMatrix = {
    width: targetWidth,
    height: targetHeight,
    pixels: pixels,
    bitDepth: bitDepth
  };

  drawPreview(pixels, targetWidth, targetHeight, bitDepth);

  const outputData = formatOutputData(pixels, targetWidth, targetHeight, bitDepth);
  document.getElementById('output-data').value = outputData;

  const dataSize = calculateDataSize(pixels, bitDepth);
  document.getElementById('data-size').textContent = `数据大小: ${dataSize} 字节`;
  document.getElementById('pixel-count').textContent = `像素数量: ${pixels.length}`;
}

function drawPreview(pixels, width, height, bitDepth) {
  const imageData = previewCtx.createImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < pixels.length; i++) {
    const pixelIndex = i * 4;
    let value;

    if (bitDepth === 1) {
      value = pixels[i] === 1 ? 0 : 255;
    } else {
      const levels = Math.pow(2, bitDepth);
      value = Math.floor((pixels[i] / (levels - 1)) * 255);
    }

    data[pixelIndex] = value;
    data[pixelIndex + 1] = value;
    data[pixelIndex + 2] = value;
    data[pixelIndex + 3] = 255;
  }

  previewCtx.putImageData(imageData, 0, 0);
}

function formatOutputData(pixels, width, height, bitDepth) {
  const format = document.getElementById('output-format').value;
  const byteOrder = document.getElementById('byte-order').value;

  switch (format) {
    case 'hex':
      return formatAsHex(pixels, width, height, bitDepth, byteOrder);
    case 'binary':
      return formatAsBinary(pixels, width, height, bitDepth, byteOrder);
    case 'c':
      return formatAsCArray(pixels, width, height, bitDepth, byteOrder);
    case 'python':
      return formatAsPythonList(pixels, width, height, bitDepth, byteOrder);
    case 'arduino':
      return formatAsArduinoArray(pixels, width, height, bitDepth, byteOrder);
    default:
      return '';
  }
}

function formatAsHex(pixels, width, height, bitDepth, byteOrder) {
  let output = `// LCD点阵数据 - ${width}x${height}, ${bitDepth}位\n`;
  output += `// 字节顺序: ${byteOrder.toUpperCase()}\n\n`;

  const bytes = convertPixelsToBytes(pixels, bitDepth, byteOrder);
  const lineLength = 16;

  for (let i = 0; i < bytes.length; i++) {
    if (i % lineLength === 0) {
      output += `0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    } else {
      output += `, 0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    }

    if ((i + 1) % lineLength === 0) {
      output += ',\n';
    }
  }

  return output;
}

function formatAsBinary(pixels, width, height, bitDepth, byteOrder) {
  let output = `// LCD点阵数据 - ${width}x${height}, ${bitDepth}位\n`;
  output += `// 字节顺序: ${byteOrder.toUpperCase()}\n\n`;

  const bytes = convertPixelsToBytes(pixels, bitDepth, byteOrder);
  const lineLength = 8;

  for (let i = 0; i < bytes.length; i++) {
    const binaryStr = bytes[i].toString(2).padStart(8, '0');

    if (i % lineLength === 0) {
      output += `0b${binaryStr}`;
    } else {
      output += `, 0b${binaryStr}`;
    }

    if ((i + 1) % lineLength === 0) {
      output += ',\n';
    }
  }

  return output;
}

function formatAsCArray(pixels, width, height, bitDepth, byteOrder) {
  let output = `/*\n * LCD点阵数据\n * 分辨率: ${width}x${height}\n`;
  output += ` * 位深: ${bitDepth}位\n * 字节顺序: ${byteOrder.toUpperCase()}\n */\n\n`;

  output += `#include <stdint.h>\n\n`;

  const bytes = convertPixelsToBytes(pixels, bitDepth, byteOrder);
  const dataType = 'uint8_t';

  output += `const ${dataType} lcd_data[${bytes.length}] = {\n`;

  const lineLength = 16;
  for (let i = 0; i < bytes.length; i++) {
    if (i % lineLength === 0) {
      output += `    0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    } else {
      output += `, 0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    }

    if ((i + 1) % lineLength === 0) {
      output += ',\n';
    }
  }

  output += '};\n';

  return output;
}

function formatAsPythonList(pixels, width, height, bitDepth, byteOrder) {
  let output = `# LCD点阵数据\n# 分辨率: ${width}x${height}\n`;
  output += `# 位深: ${bitDepth}位\n# 字节顺序: ${byteOrder.toUpperCase()}\n\n`;

  const bytes = convertPixelsToBytes(pixels, bitDepth, byteOrder);

  output += 'lcd_data = [\n';

  const lineLength = 16;
  for (let i = 0; i < bytes.length; i++) {
    if (i % lineLength === 0) {
      output += `    0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    } else {
      output += `, 0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    }

    if ((i + 1) % lineLength === 0) {
      output += ',\n';
    }
  }

  output += ']\n';

  return output;
}

function formatAsArduinoArray(pixels, width, height, bitDepth, byteOrder) {
  let output = `/*\n * LCD点阵数据\n * 分辨率: ${width}x${height}\n`;
  output += ` * 位深: ${bitDepth}位\n * 字节顺序: ${byteOrder.toUpperCase()}\n */\n\n`;

  const bytes = convertPixelsToBytes(pixels, bitDepth, byteOrder);

  output += `const unsigned char PROGMEM lcd_data[] = {\n`;

  const lineLength = 16;
  for (let i = 0; i < bytes.length; i++) {
    if (i % lineLength === 0) {
      output += `  0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    } else {
      output += `, 0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    }

    if ((i + 1) % lineLength === 0) {
      output += ',\n';
    }
  }

  output += '};\n';

  return output;
}

function convertPixelsToBytes(pixels, bitDepth, byteOrder) {
  const bytes = [];

  if (bitDepth === 1) {
    let currentByte = 0;
    let bitIndex = 0;

    for (let i = 0; i < pixels.length; i++) {
      if (byteOrder === 'msb') {
        currentByte |= (pixels[i] << (7 - bitIndex));
      } else {
        currentByte |= (pixels[i] << bitIndex);
      }

      bitIndex++;

      if (bitIndex === 8) {
        bytes.push(currentByte);
        currentByte = 0;
        bitIndex = 0;
      }
    }

    if (bitIndex > 0) {
      bytes.push(currentByte);
    }
  } else {
    for (let i = 0; i < pixels.length; i++) {
      bytes.push(pixels[i]);
    }
  }

  return bytes;
}

function calculateDataSize(pixels, bitDepth) {
  if (bitDepth === 1) {
    return Math.ceil(pixels.length / 8);
  } else {
    return pixels.length;
  }
}

function exportData() {
  const outputData = document.getElementById('output-data').value;

  if (!outputData) {
    logError('请先生成点阵数据！', 'LCD工具');
    return;
  }

  const format = document.getElementById('output-format').value;
  const width = previewCanvas.width;
  const height = previewCanvas.height;
  const bitDepth = document.getElementById('bit-depth').value;

  let extension = '.txt';
  if (format === 'c') {
    extension = '.c';
  } else if (format === 'python') {
    extension = '.py';
  } else if (format === 'hex') {
    extension = '.hex';
  } else if (format === 'binary') {
    extension = '.bin';
  } else if (format === 'arduino') {
    extension = '.ino';
  }

  const defaultFilename = `lcd_${width}x${height}_${bitDepth}bit${extension}`;

  const blob = new Blob([outputData], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  logError('文件已下载！', 'LCD工具');
}

function clearAll() {
  originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  document.getElementById('output-data').value = '';
  document.getElementById('data-size').textContent = '数据大小: 0 字节';
  document.getElementById('pixel-count').textContent = '像素数量: 0';
  document.getElementById('image-upload').value = '';
  document.getElementById('text-input').value = '你好';
  loadedImage = null;
  currentDotMatrix = null;
}
