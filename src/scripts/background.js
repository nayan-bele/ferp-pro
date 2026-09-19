/**
 * fERP Pro — Background Service Worker
 * Handles: downloads, notifications, keyboard shortcuts, OCR captcha solving
 *
 * Tesseract.js runs here (service worker context) instead of content scripts
 * to avoid CSP eval/Function-constructor violations in page context.
 */

// Load Tesseract.js into the service worker context
try {
  importScripts('scripts/lib/tesseract.min.js');
  console.log('[fERP Pro BG] Tesseract.js loaded successfully');
} catch (e) {
  console.warn('[fERP Pro BG] Tesseract.js failed to load:', e);
}

const DEFAULT_CONFIG = {
  mode: 'cascade',
  sentiment: 'positive',
  perProfessor: {},
  randomize: true,
  autoDownload: true,
  smartDelays: true,
  delayMin: 2000,
  delayMax: 8000,
  notifications: true,
  dryRun: false,
  customText: '',
  autoRetry: true,
  maxRetries: 3,
  theme: 'system',
  presets: {}
};

// Set default config on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULT_CONFIG), (items) => {
    const toSet = {};
    for (const [key, val] of Object.entries(DEFAULT_CONFIG)) {
      if (!(key in items)) toSet[key] = val;
    }
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
    console.log('[fERP Pro BG] Extension installed, default config applied.');
  });
});

// ─── OCR: solve captcha image via Tesseract.js ───────────────────────────────

/**
 * Preprocess base64 image for better OCR: upscale, binarize, denoise.
 * Runs via OffscreenCanvas (available in service workers in Chrome 109+).
 * @param {string} dataUrl  - base64 PNG/JPEG data URL of the captcha
 * @returns {Promise<string>} - preprocessed data URL
 */
async function preprocessCaptchaImage(dataUrl) {
  try {
    // Fetch the image as a blob, then decode via createImageBitmap
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const scale = 3;
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    // Greyscale
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
      d[i] = d[i+1] = d[i+2] = g;
    }

    // Otsu threshold
    const hist = new Array(256).fill(0);
    const total = d.length / 4;
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;

    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];

    let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) ** 2;
      if (v > maxVar) { maxVar = v; threshold = t; }
    }

    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] < threshold ? 0 : 255;
      d[i] = d[i+1] = d[i+2] = v;
    }

    ctx.putImageData(imageData, 0, 0);

    const outBlob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(outBlob);
    });
  } catch (err) {
    console.warn('[fERP Pro BG] Image preprocessing failed, using raw image:', err);
    return dataUrl; // fall back to raw image
  }
}

/**
 * Run OCR on a captcha image data URL, return cleaned text.
 * @param {string} dataUrl
 * @returns {Promise<string|null>}
 */
async function ocrCaptcha(dataUrl) {
  if (typeof Tesseract === 'undefined') {
    console.warn('[fERP Pro BG] Tesseract not available');
    return null;
  }

  try {
    const processed = await preprocessCaptchaImage(dataUrl);

    const result = await Tesseract.recognize(processed, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`[fERP Pro BG] OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    let text = result.data.text
      .trim()
      .replace(/\s/g, '')
      .replace(/[^a-zA-Z0-9]/g, '');

    // Common captcha font OCR fixes
    text = text
      .replace(/O(?=\d)|(?<=\d)O/g, '0')
      .replace(/[lI](?=\d)|(?<=\d)[lI]/g, '1')
      .replace(/S(?=\d)|(?<=\d)S/g, '5')
      .replace(/B(?=\d)|(?<=\d)B/g, '8');

    console.log(`[fERP Pro BG] OCR result: "${text}"`);
    return text.length >= 3 ? text : null;
  } catch (err) {
    console.error('[fERP Pro BG] OCR error:', err);
    return null;
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message.type;
  console.log(`[fERP Pro BG] Message: ${type}`);

  if (type === 'OCR_CAPTCHA') {
    // Content script sends captcha image as dataUrl, we OCR it and reply
    ocrCaptcha(message.payload.dataUrl)
      .then(text => sendResponse({ success: !!text, text: text || '' }))
      .catch(err => sendResponse({ success: false, text: '', error: String(err) }));
    return true; // keep channel open for async response

  } else if (type === 'DOWNLOAD_ADMIT_CARD') {
    const url = message.payload?.url || message.url;
    if (!url) { console.warn('[fERP Pro BG] No URL for admit card'); return; }
    chrome.downloads.download({ url, filename: 'AdmitCard.pdf', saveAs: true },
      id => console.log(`[fERP Pro BG] Download started: ${id}`));

  } else if (type === 'SHOW_NOTIFICATION') {
    const title = message.payload?.title || 'fERP Pro';
    const msg   = message.payload?.message || '';
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon128.png',
      title,
      message: msg
    }, id => console.log(`[fERP Pro BG] Notification: ${id}`));
  }
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  console.log(`[fERP Pro BG] Command: ${command}`);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    const type = command === 'start-automation' ? 'START_AUTOMATION' : 'STOP_AUTOMATION';
    chrome.tabs.sendMessage(tabs[0].id, { type });
  });
});
