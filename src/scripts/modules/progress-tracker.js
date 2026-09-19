(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  // Standard message protocol definition
  const MSG = {
    START: 'START_AUTOMATION',
    STOP: 'STOP_AUTOMATION',
    PROGRESS: 'PROGRESS_UPDATE',
    FORMS_LIST: 'FORMS_LIST',
    REQUEST_FORMS: 'REQUEST_FORMS',
    DOWNLOAD: 'DOWNLOAD_ADMIT_CARD',
    NOTIFY: 'SHOW_NOTIFICATION',
    CAPTCHA_NEEDED: 'CAPTCHA_NEEDED',
    DRY_RUN_RESULT: 'DRY_RUN_RESULT',
    SCAN_FORMS: 'SCAN_FORMS'
  };

  window.FeedbackPro.ProgressTracker = {
    state: {
      completed: 0,
      failed: 0,
      total: 0,
      current: null,
      log: [],
      forms: [],
      running: false
    },
    
    /**
     * Initialize the tracker with a list of forms
     * @param {Array} forms - Array of form objects
     */
    init(forms) {
      this.reset();
      this.state.forms = forms;
      this.state.total = forms.length;
      this.state.completed = forms.filter(f => f.status === 'submitted').length;
      this.state.failed = forms.filter(f => f.status === 'failed').length;
      this.state.running = true;
      this.addLog(`Initialized with ${this.state.total} forms (${this.state.completed} already submitted)`);
      this.sendUpdate();
    },
    
    /**
     * Mark a form as completed
     * @param {string} formId 
     */
    markCompleted(formId) {
      const form = this.state.forms.find(f => f.id === formId);
      if (form && form.status !== 'submitted') {
        form.status = 'submitted';
        this.state.completed++;
        this.addLog(`Successfully submitted feedback for: ${form.subjectName}`, 'success');
        this.sendUpdate();
      }
    },
    
    /**
     * Mark a form as failed
     * @param {string} formId 
     * @param {string} reason 
     */
    markFailed(formId, reason = 'Unknown error') {
      const form = this.state.forms.find(f => f.id === formId);
      if (form) {
        form.status = 'failed';
        this.state.failed++;
        this.addLog(`Failed to submit feedback for ${form.subjectName}: ${reason}`, 'error');
        this.sendUpdate();
      }
    },
    
    /**
     * Mark a form as currently in progress
     * @param {string} formId 
     */
    markInProgress(formId) {
      const form = this.state.forms.find(f => f.id === formId);
      if (form) {
        form.status = 'in-progress';
        this.state.current = form;
        this.addLog(`Started filling feedback for: ${form.subjectName}`);
        this.sendUpdate();
      }
    },
    
    /**
     * Add an entry to the execution log
     * @param {string} message 
     * @param {string} type - 'info', 'success', 'error', 'warning'
     */
    addLog(message, type = 'info') {
      const timestamp = new Date().toISOString();
      const logEntry = { timestamp, message, type };
      this.state.log.push(logEntry);
      console.log(`[fERP Pro][${type.toUpperCase()}] ${message}`);
    },
    
    /**
     * Send progress update to popup/background
     */
    sendUpdate() {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: MSG.PROGRESS,
            payload: {
              completed: this.state.completed,
              failed: this.state.failed,
              total: this.state.total,
              current: this.state.current,
              log: this.state.log,
              running: this.state.running
            }
          }).catch(() => { /* Ignore errors if popup is closed */ });
        }
      } catch (err) {
        console.warn('[fERP Pro] Could not send progress update:', err);
      }
    },
    
    /**
     * Send the full forms list to popup/background
     */
    sendFormsList() {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: MSG.FORMS_LIST,
            payload: {
              forms: this.state.forms
            }
          }).catch(() => { /* Ignore errors if popup is closed */ });
        }
      } catch (err) {
        console.warn('[fERP Pro] Could not send forms list:', err);
      }
    },
    
    /**
     * Reset the tracker state
     */
    reset() {
      this.state = {
        completed: 0,
        failed: 0,
        total: 0,
        current: null,
        log: [],
        forms: [],
        running: false
      };
    },
    
    /**
     * Check if automation is completely done
     * @returns {boolean}
     */
    isComplete() {
      return (this.state.completed + this.state.failed) >= this.state.total;
    },
    
    /**
     * Get forms that failed or are pending for a retry queue
     * @returns {Array} Array of form objects
     */
    getRetryQueue() {
      return this.state.forms.filter(f => f.status === 'failed' || f.status === 'pending');
    }
  };

  console.log('[fERP Pro] ProgressTracker module loaded');
})();
