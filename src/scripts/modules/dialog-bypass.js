(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.DialogBypass = {
    _originalAlert: null,
    _originalConfirm: null,
    
    /**
     * Override window.alert and window.confirm to bypass them
     */
    setup() {
      console.log('[fERP Pro] Setting up dialog bypass...');
      
      // Save original references
      this._originalAlert = window.alert;
      this._originalConfirm = window.confirm;
      
      // Override alert to simply log the message
      window.alert = function(message) {
        console.log(`[fERP Pro] Bypassed alert: ${message}`);
      };
      
      // Override confirm to log and automatically return true (accept)
      window.confirm = function(message) {
        console.log(`[fERP Pro] Bypassed confirm: ${message}`);
        return true;
      };
      
      // Inject into DOM to ensure it affects page scripts if we are in isolated world
      try {
        const script = document.createElement('script');
        script.id = 'ferp-dialog-bypass';
        script.textContent = `
          window._ferpOriginalAlert = window.alert;
          window._ferpOriginalConfirm = window.confirm;
          window.alert = function(msg) { console.log('[fERP Pro Page] Alert bypassed: ' + msg); };
          window.confirm = function(msg) { console.log('[fERP Pro Page] Confirm bypassed: ' + msg); return true; };
        `;
        (document.head || document.documentElement).appendChild(script);
      } catch (err) {
        console.error('[fERP Pro] Failed to inject dialog bypass script into page', err);
      }
    },
    
    /**
     * Restore original window.alert and window.confirm functions
     */
    restore() {
      console.log('[fERP Pro] Restoring original dialog functions...');
      
      if (this._originalAlert) {
        window.alert = this._originalAlert;
      }
      if (this._originalConfirm) {
        window.confirm = this._originalConfirm;
      }
      
      // Remove injected script and restore page-level functions
      try {
        const script = document.createElement('script');
        script.textContent = `
          if (window._ferpOriginalAlert) window.alert = window._ferpOriginalAlert;
          if (window._ferpOriginalConfirm) window.confirm = window._ferpOriginalConfirm;
          const injectedNode = document.getElementById('ferp-dialog-bypass');
          if (injectedNode) injectedNode.remove();
        `;
        (document.head || document.documentElement).appendChild(script);
        setTimeout(() => script.remove(), 100);
      } catch (err) {
        console.error('[fERP Pro] Failed to restore page dialog functions', err);
      }
    }
  };

  console.log('[fERP Pro] DialogBypass module loaded');
})();
