let originalCanvas;
let originalCtx;
let previewCanvas;
let previewCtx;
let loadedImage = null;
let currentDotMatrix = null;
let currentMode = 'image';
let debounceTimer = null;

const PRESETS = [
  { name: '自定义', width: 0, height: 0 },
  { name: 'OLED 128×64', width: 128, height: 64 },
  { name: 'OLED 96×16', width: 96, height: 16 },
  { name: 'TFT 160×128', width: 160, height: 128 },
  { name: 'TFT 240×240', width: 240, height: 240 },
  { name: 'TFT 320×240 (QVGA)', width: 320, height: 240 },
  { name: 'TFT 480×320', width: 480, height: 320 },
  { name: 'LCD 16×2 字符', width: 80, height: 16 },
  { name: 'LCD 20×4 字符', width: 100, height: 32 },
  { name: '电子墨水 200×200', width: 200, height: 200 },
  { name: '电子墨水 400×300', width: 400, height: 300 },
];

function initLCDTool() {
  originalCanvas = document.getElementById('original-canvas');
  originalCtx = originalCanvas.getContext('2d');
  previewCanvas = document.getElementById('preview-canvas');
  previewCtx = previewCanvas.getContext('2d');

  setupLCDEventListeners();
  renderPresets();
}

function getTauriAPI() {
  return window.__TAURI__;
}

function renderPresets() {
  const select = document.getElementById('preset-select');
  if (!select) return;
  
  select.innerHTML = PRESETS.map((p, i) => 
    `<option value="${i}">${p.name}</option>`
  ).join('');
}

function setupLCDEventListeners() {
  const imageUpload = document.getElementById('image-upload');
  if (imageUpload) {
    imageUpload.addEventListener('change', loadImage);
  }

  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', generateDotMatrix);
  }

  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAll);
  }

  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  if (thresholdSlider && thresholdValue) {
    thresholdSlider.addEventListener('input', (e) => {
      thresholdValue.textContent = e.target.value;
      triggerAutoGenerate();
    });
  }

  const widthInput = document.getElementById('width-input');
  const heightInput = document.getElementById('height-input');

  if (widthInput) {
    widthInput.addEventListener('input', () => {
      updateCanvasSize();
      triggerAutoGenerate();
      updatePresetSelection();
    });
  }

  if (heightInput) {
    heightInput.addEventListener('input', () => {
      updateCanvasSize();
      triggerAutoGenerate();
      updatePresetSelection();
    });
  }

  const tabBtns = document.querySelectorAll('.lcd-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.target.dataset.mode;
      switchMode(mode);
    });
  });

  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = '#eff6ff';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      dropZone.style.background = '';

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        document.getElementById('image-upload').files = files;
        loadImage();
      }
    });
  }

  const invertCheckbox = document.getElementById('invert');
  if (invertCheckbox) {
    invertCheckbox.addEventListener('change', triggerAutoGenerate);
  }

  const bitDepthSelect = document.getElementById('bit-depth');
  if (bitDepthSelect) {
    bitDepthSelect.addEventListener('change', triggerAutoGenerate);
  }

  const byteOrderSelect = document.getElementById('byte-order');
  if (byteOrderSelect) {
    byteOrderSelect.addEventListener('change', triggerAutoGenerate);
  }

  const outputFormatSelect = document.getElementById('output-format');
  if (outputFormatSelect) {
    outputFormatSelect.addEventListener('change', () => {
      if (currentDotMatrix) {
        updateOutputFormat();
      }
    });
  }

  const presetSelect = document.getElementById('preset-select');
  if (presetSelect) {
    presetSelect.addEventListener('change', applyPreset);
  }

  const copyBtn = document.getElementById('copy-output-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyOutput);
  }

  const fontSizeInput = document.getElementById('font-size');
  if (fontSizeInput) {
    fontSizeInput.addEventListener('input', triggerAutoGenerate);
  }

  const fontFamilySelect = document.getElementById('font-family');
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener('change', triggerAutoGenerate);
  }

  const fontWeightSelect = document.getElementById('font-weight');
  if (fontWeightSelect) {
    fontWeightSelect.addEventListener('change', triggerAutoGenerate);
  }

  const textInput = document.getElementById('text-input');
  if (textInput) {
    textInput.addEventListener('input', triggerAutoGenerate);
  }
}

function triggerAutoGenerate() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    if (currentMode === 'image' && loadedImage) {
      generateFromImage();
    } else if (currentMode === 'text') {
      const text = document.getElementById('text-input')?.value;
      if (text) {
        generateFromText();
      }
    }
  }, 150);
}

function updatePresetSelection() {
  const width = parseInt(document.getElementById('width-input').value) || 0;
  const height = parseInt(document.getElementById('height-input').value) || 0;
  const presetSelect = document.getElementById('preset-select');
  
  if (!presetSelect) return;
  
  const matchingIndex = PRESETS.findIndex(p => p.width === width && p.height === height);
  presetSelect.value = matchingIndex >= 0 ? matchingIndex : 0;
}

function applyPreset() {
  const presetSelect = document.getElementById('preset-select');
  const index = parseInt(presetSelect.value);
  const preset = PRESETS[index];
  
  if (preset.width > 0 && preset.height > 0) {
    document.getElementById('width-input').value = preset.width;
    document.getElementById('height-input').value = preset.height;
    updateCanvasSize();
    triggerAutoGenerate();
  }
}

function switchMode(mode) {
  currentMode = mode;

  const tabBtns = document.querySelectorAll('.lcd-tab-btn');
  tabBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    }
  });

  const modePanels = document.querySelectorAll('.lcd-mode-panel');
  modePanels.forEach(panel => {
    panel.classList.remove('active');
    if (panel.id === `${mode}-mode`) {
      panel.classList.add('active');
    }
  });

  clearAll();
  updateCanvasSize();
}

function updateCanvasSize() {
  const targetWidth = parseInt(document.getElementById('width-input').value) || 128;
  const targetHeight = parseInt(document.getElementById('height-input').value) || 64;

  originalCanvas.width = targetWidth;
  originalCanvas.height = targetHeight;
  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;

  if (currentMode === 'image' && loadedImage) {
    originalCtx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);
  }
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

      const targetWidth = parseInt(document.getElementById('width-input').value) || 128;
      const targetHeight = parseInt(document.getElementById('height-input').value) || 64;

      originalCanvas.width = targetWidth;
      originalCanvas.height = targetHeight;

      originalCtx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const uploadPlaceholder = document.querySelector('.upload-placeholder');
      const uploadPreviewImg = document.getElementById('upload-preview-img');

      if (uploadPlaceholder) {
        uploadPlaceholder.classList.add('hidden');
      }

      if (uploadPreviewImg) {
        uploadPreviewImg.src = e.target.result;
        uploadPreviewImg.classList.remove('hidden');
      }

      generateFromImage();
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
  updateOutput(pixels, targetWidth, targetHeight, bitDepth);
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
  updateOutput(pixels, targetWidth, targetHeight, bitDepth);
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

function updateOutput(pixels, width, height, bitDepth) {
  const outputData = formatOutputData(pixels, width, height, bitDepth);
  document.getElementById('output-data').value = outputData;

  const dataSize = calculateDataSize(pixels, bitDepth);
  document.getElementById('data-size').textContent = `${dataSize} 字节`;
  document.getElementById('pixel-count').textContent = `${pixels.length} 像素`;
}

function updateOutputFormat() {
  if (!currentDotMatrix) return;
  
  const outputData = formatOutputData(
    currentDotMatrix.pixels, 
    currentDotMatrix.width, 
    currentDotMatrix.height, 
    currentDotMatrix.bitDepth
  );
  document.getElementById('output-data').value = outputData;
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

function copyOutput() {
  const outputData = document.getElementById('output-data');
  if (!outputData || !outputData.value) {
    logError('没有可复制的数据！', 'LCD工具');
    return;
  }
  
  navigator.clipboard.writeText(outputData.value).then(() => {
    showCopyToast();
  }).catch(() => {
    outputData.select();
    document.execCommand('copy');
    showCopyToast();
  });
}

function showCopyToast() {
  const toast = document.getElementById('lcd-copy-toast');
  if (toast) {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 1500);
  }
}

function clearAll() {
  originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  document.getElementById('output-data').value = '';
  document.getElementById('data-size').textContent = '0 字节';
  document.getElementById('pixel-count').textContent = '0 像素';
  document.getElementById('image-upload').value = '';

  const uploadPlaceholder = document.querySelector('.upload-placeholder');
  const uploadPreviewImg = document.getElementById('upload-preview-img');

  if (uploadPlaceholder) {
    uploadPlaceholder.classList.remove('hidden');
  }

  if (uploadPreviewImg) {
    uploadPreviewImg.src = '';
    uploadPreviewImg.classList.add('hidden');
  }

  loadedImage = null;
  currentDotMatrix = null;
}

window.initLCDTool = initLCDTool;
