(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.CaptchaHandler = {
    _enterKeyListener: null,
    
    /**
     * Find the captcha input field
     * @returns {HTMLElement|null}
     */
    getCaptchaField() {
      // Look for inputs with 'captcha' in id or name, or immediately following a captcha image
      let field = document.querySelector('input[name*="captcha" i], input[id*="captcha" i]');
      
      if (!field) {
        // Fallback: finding input near image
        const img = this.getCaptchaImage();
        if (img) {
          // Look at siblings or parent siblings
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
     * Focus the captcha field and set up Enter-to-submit behavior
     */
    setupCaptchaInteraction() {
      console.log('[fERP Pro] Setting up CAPTCHA interaction...');
      this.cleanup(); // Remove any existing listeners
      
      const captchaField = this.getCaptchaField();
      if (!captchaField) {
        console.warn('[fERP Pro] CAPTCHA field not found');
        return false;
      }
      
      // Auto-focus the captcha field for the user
      captchaField.focus();
      
      // Setup Enter key listener
      this._enterKeyListener = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // Prevent default browser submit
          
          const submitBtn = window.FeedbackPro.FormDetector?.getSubmitButton();
          if (submitBtn) {
            console.log('[fERP Pro] Enter pressed in CAPTCHA, clicking submit...');
            submitBtn.click();
          } else {
            console.error('[fERP Pro] Submit button not found on Enter');
          }
        }
      };
      
      captchaField.addEventListener('keydown', this._enterKeyListener);
      return true;
    },
    
    /**
     * Check if a captcha error occurred (e.g. wrong captcha entered)
     * @returns {boolean}
     */
    hasCaptchaError() {
      // Look for common error messages in the DOM
      const bodyText = document.body.innerText.toLowerCase();
      const errorIndicators = [
        'invalid captcha', 
        'wrong captcha', 
        'captcha mismatched', 
        'incorrect captcha'
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

  console.log('[fERP Pro] CaptchaHandler module loaded');
})();
