(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.CaptchaHandler = {
    _enterKeyListener: null,

    /** Find the captcha input field */
    getCaptchaField() {
      let field = document.querySelector('input[name*="captcha" i], input[id*="captcha" i]');
      if (!field) {
        const img = this.getCaptchaImage();
        if (img) {
          const container = img.closest('td, div, form');
          if (container) field = container.querySelector('input[type="text"]');
        }
      }
      return field;
    },

    /** Find the captcha image */
    getCaptchaImage() {
      return document.querySelector(
        'img[src*="captcha" i], img[id*="captcha" i], img[alt*="captcha" i]'
      );
    },

    /**
     * Convert the captcha image to a base64 data URL using a canvas.
     * This is safe to do in content script — no eval involved.
     * @returns {string|null}
     */
    getCaptchaDataUrl() {
      const img = this.getCaptchaImage();
      if (!img) return null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  || img.width  || 150;
        canvas.height = img.naturalHeight || img.height || 50;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      } catch (e) {
        // Cross-origin image — try using src directly
        console.warn('[fERP Pro] Could not canvas-serialize captcha image (cross-origin?), using src');
        return img.src || null;
      }
    },

    /**
     * Ask the background service worker to OCR the captcha image.
     * Background runs Tesseract.js via importScripts (allowed in SW context).
     * @returns {Promise<string|null>} solved text or null
     */
    async solveViaBg() {
      const dataUrl = this.getCaptchaDataUrl();
      if (!dataUrl) return null;

      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { type: 'OCR_CAPTCHA', payload: { dataUrl } },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn('[fERP Pro] BG OCR error:', chrome.runtime.lastError.message);
                resolve(null);
                return;
              }
              if (response && response.success && response.text) {
                resolve(response.text);
              } else {
                resolve(null);
              }
            }
          );
        } catch (e) {
          console.error('[fERP Pro] sendMessage failed:', e);
          resolve(null);
        }
      });
    },

    /**
     * Full auto-captcha: OCR via background → fill → submit.
     * Falls back to manual if OCR fails.
     * @param {boolean} autoSubmit
     * @returns {Promise<boolean>}
     */
    async autoSolveCaptcha(autoSubmit = true) {
      const captchaField = this.getCaptchaField();
      if (!captchaField) return false;

      console.log('[fERP Pro] Sending captcha to background for OCR...');
      const solvedText = await this.solveViaBg();

      if (solvedText && solvedText.length >= 3) {
        console.log(`[fERP Pro] OCR solved: "${solvedText}"`);
        captchaField.value = solvedText;
        captchaField.focus();
        ['input', 'change', 'keyup'].forEach(evt =>
          captchaField.dispatchEvent(new Event(evt, { bubbles: true }))
        );

        if (autoSubmit) {
          await new Promise(r => setTimeout(r, 300));
          const submitBtn = window.FeedbackPro.FormDetector?.getSubmitButton();
          if (submitBtn) {
            console.log('[fERP Pro] Auto-submitting...');
            submitBtn.click();
            return true;
          }
        }
        return true;
      }

      // OCR failed — fall back to manual
      console.log('[fERP Pro] OCR failed, switching to manual captcha mode');
      this.setupManualCaptcha();
      return false;
    },

    /** Manual mode: focus field + Enter-to-submit */
    setupManualCaptcha() {
      this.cleanup();
      const captchaField = this.getCaptchaField();
      if (!captchaField) return false;

      captchaField.focus();
      this._enterKeyListener = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const submitBtn = window.FeedbackPro.FormDetector?.getSubmitButton();
          if (submitBtn) submitBtn.click();
        }
      };
      captchaField.addEventListener('keydown', this._enterKeyListener);
      return true;
    },

    /** Try OCR first, fall back to manual. Notify popup if manual needed. */
    async setupCaptchaInteraction() {
      console.log('[fERP Pro] Setting up CAPTCHA interaction...');
      this.cleanup();

      const autoSolved = await this.autoSolveCaptcha(true);
      if (!autoSolved) {
        this.setupManualCaptcha();
        // Tell popup + send desktop notification
        try {
          chrome.runtime.sendMessage({ type: 'CAPTCHA_NEEDED' });
          chrome.runtime.sendMessage({
            type: 'SHOW_NOTIFICATION',
            payload: {
              title: 'fERP Pro — Action Required',
              message: 'OCR could not solve CAPTCHA. Switch to ERP tab and type it, then press Enter.'
            }
          });
        } catch (_) {}
      }
    },

    /** Check if the page shows a captcha error */
    hasCaptchaError() {
      const t = document.body.innerText.toLowerCase();
      return ['invalid captcha', 'wrong captcha', 'captcha mismatched',
              'incorrect captcha', 'captcha failed', 'captcha error']
        .some(s => t.includes(s));
    },

    /** Remove event listeners */
    cleanup() {
      const f = this.getCaptchaField();
      if (f && this._enterKeyListener) {
        f.removeEventListener('keydown', this._enterKeyListener);
      }
      this._enterKeyListener = null;
    }
  };

  console.log('[fERP Pro] CaptchaHandler loaded (OCR via background worker)');
})();
