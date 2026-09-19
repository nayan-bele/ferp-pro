(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.CaptchaHandler = {
    _enterKeyListener: null,
    _ocrWorker: null,
    _retryCount: 0,

    /**
     * Find the captcha input field
     * @returns {HTMLElement|null}
     */
    getCaptchaField() {
      let field = document.querySelector('input[name*="captcha" i], input[id*="captcha" i]');
      
      if (!field) {
        const img = this.getCaptchaImage();
        if (img) {
          const container = img.closest('td, div, form');
          if (container) {
            field = container.querySelector('input[type="text"]');
          }
        }
      }
      return field;
    },
    
    /**
     * Find the captcha image
     * @returns {HTMLImageElement|null}
     */
    getCaptchaImage() {
      return document.querySelector('img[src*="captcha" i], img[id*="captcha" i], img[alt*="captcha" i]');
    },

    /**
     * Preprocess captcha image for better OCR accuracy.
     * Draws the image onto an offscreen canvas, converts to grayscale,
     * applies a threshold to binarize, and removes noise.
     * @param {HTMLImageElement} img
     * @returns {string} Preprocessed image as data URL
     */
    preprocessImage(img) {
      const canvas = document.createElement('canvas');
      // Scale up for better OCR accuracy
      const scale = 3;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');

      // Draw scaled image with sharpening
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
        data[i] = gray;
        data[i+1] = gray;
        data[i+2] = gray;
      }

      // Apply binary threshold (Otsu-like simple approach)
      // Calculate histogram
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++;
      }
      
      // Find optimal threshold using Otsu's method
      const totalPixels = data.length / 4;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];
      
      let sumB = 0, wB = 0, wF = 0, maxVariance = 0, threshold = 128;
      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = totalPixels - wB;
        if (wF === 0) break;
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const variance = wB * wF * (mB - mF) * (mB - mF);
        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = t;
        }
      }

      // Apply threshold — make text black (0) on white (255) background
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] < threshold ? 0 : 255;
        data[i] = val;
        data[i+1] = val;
        data[i+2] = val;
      }

      // Simple noise removal: if a black pixel has fewer than 2 black neighbors, make it white
      const w = canvas.width;
      const h = canvas.height;
      const cleaned = new Uint8ClampedArray(data);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          if (data[idx] === 0) { // black pixel
            let blackNeighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                const nIdx = ((y + dy) * w + (x + dx)) * 4;
                if (data[nIdx] === 0) blackNeighbors++;
              }
            }
            if (blackNeighbors < 2) {
              cleaned[idx] = 255;
              cleaned[idx+1] = 255;
              cleaned[idx+2] = 255;
            }
          }
        }
      }

      // Write cleaned data back
      const cleanedImageData = new ImageData(cleaned, w, h);
      ctx.putImageData(cleanedImageData, 0, 0);

      return canvas.toDataURL('image/png');
    },

    /**
     * Attempt to solve the captcha using Tesseract.js OCR
     * @returns {Promise<string|null>} The recognized text, or null on failure
     */
    async solveCaptcha() {
      const img = this.getCaptchaImage();
      if (!img) {
        console.warn('[fERP Pro] No captcha image found for OCR');
        return null;
      }

      // Check if Tesseract is available
      if (typeof Tesseract === 'undefined') {
        console.warn('[fERP Pro] Tesseract.js not loaded, falling back to manual captcha');
        return null;
      }

      console.log('[fERP Pro] Running OCR on captcha image...');

      try {
        // Preprocess the image for better accuracy
        const processedDataUrl = this.preprocessImage(img);

        // Run OCR with English language, optimized for single line text
        const result = await Tesseract.recognize(processedDataUrl, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`[fERP Pro] OCR progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        });

        let text = result.data.text.trim();

        // Clean up the OCR result:
        // - Remove whitespace
        // - Remove non-alphanumeric characters (captchas are usually alphanumeric)
        // - Fix common OCR mistakes
        text = text.replace(/\s/g, '');
        text = text.replace(/[^a-zA-Z0-9]/g, '');

        // Common OCR misreads for captcha fonts
        text = text
          .replace(/[oO](?=\d)/g, '0')   // O before digit → 0
          .replace(/(?<=\d)[oO]/g, '0')   // O after digit → 0
          .replace(/[lI](?=\d)/g, '1')    // l/I before digit → 1
          .replace(/(?<=\d)[lI]/g, '1')   // l/I after digit → 1
          .replace(/[S](?=\d)/g, '5')     // S before digit → 5
          .replace(/[B](?=\d)/g, '8');    // B before digit → 8

        console.log(`[fERP Pro] OCR result: "${text}"`);
        return text || null;

      } catch (err) {
        console.error('[fERP Pro] OCR failed:', err);
        return null;
      }
    },

    /**
     * Full auto-captcha flow: solve → fill → submit
     * Falls back to manual mode if OCR fails or is unavailable
     * @param {boolean} autoSubmit - Whether to auto-click submit after filling
     * @returns {Promise<boolean>} Whether captcha was auto-filled
     */
    async autoSolveCaptcha(autoSubmit = true) {
      const captchaField = this.getCaptchaField();
      if (!captchaField) {
        console.warn('[fERP Pro] No captcha field found');
        return false;
      }

      const solvedText = await this.solveCaptcha();

      if (solvedText && solvedText.length >= 3) {
        console.log(`[fERP Pro] Auto-filling captcha with: "${solvedText}"`);

        // Fill the captcha field
        captchaField.value = solvedText;
        captchaField.focus();

        // Dispatch events to trigger ERP validators
        ['input', 'change', 'keyup'].forEach(eventType => {
          captchaField.dispatchEvent(new Event(eventType, { bubbles: true }));
        });

        if (autoSubmit) {
          // Small delay before submitting to let ERP process the input
          await new Promise(r => setTimeout(r, 300));

          const submitBtn = window.FeedbackPro.FormDetector?.getSubmitButton();
          if (submitBtn) {
            console.log('[fERP Pro] Auto-submitting after captcha fill...');
            submitBtn.click();
            return true;
          }
        }
        return true;
      }

      // OCR failed or result too short — fall back to manual mode
      console.log('[fERP Pro] OCR could not solve captcha, switching to manual mode');
      this.setupManualCaptcha();
      return false;
    },

    /**
     * Manual captcha mode: focus field + Enter-to-submit
     */
    setupManualCaptcha() {
      this.cleanup();
      
      const captchaField = this.getCaptchaField();
      if (!captchaField) return false;

      captchaField.focus();

      this._enterKeyListener = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const submitBtn = window.FeedbackPro.FormDetector?.getSubmitButton();
          if (submitBtn) {
            console.log('[fERP Pro] Enter pressed in CAPTCHA, clicking submit...');
            submitBtn.click();
          }
        }
      };

      captchaField.addEventListener('keydown', this._enterKeyListener);
      return true;
    },

    /**
     * Full captcha interaction: tries OCR first, falls back to manual
     */
    async setupCaptchaInteraction() {
      console.log('[fERP Pro] Setting up CAPTCHA interaction...');
      this.cleanup();

      // Try auto-solve first
      const autoSolved = await this.autoSolveCaptcha(true);

      if (!autoSolved) {
        // Fall back to manual: focus field, listen for Enter
        this.setupManualCaptcha();

        // Notify popup/background that manual input is needed
        if (chrome && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'CAPTCHA_NEEDED' }).catch(() => {});
          chrome.runtime.sendMessage({
            type: 'SHOW_NOTIFICATION',
            payload: {
              title: 'fERP Pro',
              message: 'CAPTCHA needs manual input — switch to the ERP tab and type it.'
            }
          }).catch(() => {});
        }
      }
    },

    /**
     * Check if a captcha error occurred (e.g. wrong captcha entered)
     * @returns {boolean}
     */
    hasCaptchaError() {
      const bodyText = document.body.innerText.toLowerCase();
      const errorIndicators = [
        'invalid captcha',
        'wrong captcha',
        'captcha mismatched',
        'incorrect captcha',
        'captcha failed',
        'captcha error'
      ];
      return errorIndicators.some(msg => bodyText.includes(msg));
    },

    /**
     * Clean up event listeners
     */
    cleanup() {
      const captchaField = this.getCaptchaField();
      if (captchaField && this._enterKeyListener) {
        captchaField.removeEventListener('keydown', this._enterKeyListener);
      }
      this._enterKeyListener = null;
    }
  };

  console.log('[fERP Pro] CaptchaHandler module loaded (with OCR support)');
})();
