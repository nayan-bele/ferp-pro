(function() {
  const FP = window.FeedbackPro;
  
  if (!FP) {
    console.error('[fERP Pro] Modules failed to load properly. Namespace missing.');
    return;
  }

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

  // Main automation controller
  const Controller = {
    config: null,
    running: false,
    _stopRequested: false,
    
    async init() {
      console.log('[fERP Pro] Content script initializing...');
      
      // Attempt to load config from storage
      try {
        if (chrome && chrome.storage) {
          const data = await chrome.storage.sync.get('ferp_config');
          if (data && data.ferp_config) {
            this.config = data.ferp_config;
          }
        }
      } catch (err) {
        console.warn('[fERP Pro] Could not load config from storage', err);
      }

      // Default config fallback
      if (!this.config) {
        this.config = {
          mode: 'cascade',
          sentiment: 'positive',
          perProfessor: {},
          randomize: true,
          autoDownload: true,
          smartDelays: true,
          delayMin: 2000,
          delayMax: 8000,
          dryRun: false,
          customText: ''
        };
      }

      // Set up dialog bypass
      if (FP.DialogBypass) {
        FP.DialogBypass.setup();
      }

      // Listen for messages from popup
      this.setupMessageListener();

      // Initial scan if we are on a relevant page
      if (FP.FormDetector && FP.FormDetector.isListingPage()) {
        console.log('[fERP Pro] Detected feedback listing page.');
        const forms = FP.FormDetector.scanFeedbackList();
        if (FP.ProgressTracker) {
          FP.ProgressTracker.state.forms = forms;
          FP.ProgressTracker.sendFormsList();
        }
      } else if (FP.FormDetector && FP.FormDetector.isFormPage()) {
        console.log('[fERP Pro] Detected active feedback form.');
        // Handle captcha interaction automatically on form pages
        if (FP.CaptchaHandler) {
          await FP.CaptchaHandler.setupCaptchaInteraction();
        }
      }
    },
    
    setupMessageListener() {
      if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;
      
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log(`[fERP Pro] Received message: ${request.type}`);
        
        switch (request.type) {
          case MSG.START:
            this.config = { ...this.config, ...request.payload?.config };
            this.start(this.config.dryRun);
            sendResponse({ status: 'started' });
            break;
            
          case MSG.STOP:
            this.stop();
            sendResponse({ status: 'stopped' });
            break;
            
          case MSG.REQUEST_FORMS:
          case MSG.SCAN_FORMS:
            if (FP.FormDetector) {
              const forms = FP.FormDetector.scanFeedbackList();
              if (FP.ProgressTracker) {
                FP.ProgressTracker.state.forms = forms;
                FP.ProgressTracker.sendFormsList();
              }
              sendResponse({ forms });
            }
            break;
        }
        return true;
      });
    },
    
    async start(dryRun = false) {
      if (this.running) {
        console.warn('[fERP Pro] Automation already running');
        return;
      }
      
      this.running = true;
      this._stopRequested = false;
      
      if (FP.ProgressTracker) {
        FP.ProgressTracker.state.running = true;
        FP.ProgressTracker.sendUpdate();
      }

      try {
        if (FP.FormDetector.isFormPage()) {
          // SELECTIVE MODE (single form page)
          console.log('[fERP Pro] Running in Selective Mode on current form');
          
          if (dryRun) {
            const preview = FP.FormFiller.previewFill(this.config.sentiment, this.config);
            this.sendDryRunResult([preview]);
            this.stop();
            return;
          }
          
          await this.fillSingleForm(null, this.config.sentiment);
          
        } else if (FP.FormDetector.isListingPage()) {
          // CASCADE MODE (listing page)
          console.log('[fERP Pro] Running in Cascade Mode');
          
          const forms = FP.FormDetector.scanFeedbackList();
          const pendingForms = forms.filter(f => f.status === 'pending');
          
          if (FP.ProgressTracker) {
            FP.ProgressTracker.init(forms);
          }

          if (dryRun) {
            const previews = pendingForms.map(f => {
              const sentiment = this.config.perProfessor[f.professorName] || this.config.sentiment;
              return { form: f, expectedSentiment: sentiment };
            });
            this.sendDryRunResult(previews);
            this.stop();
            return;
          }

          if (pendingForms.length === 0) {
            console.log('[fERP Pro] No pending forms found. Auto-downloading admit card if enabled.');
            this.finishCascade();
            return;
          }

          const nextForm = pendingForms[0];
          
          if (FP.ProgressTracker) {
            FP.ProgressTracker.markInProgress(nextForm.id);
          }
          
          console.log(`[fERP Pro] Navigating to form for ${nextForm.subjectName}`);
          
          if (nextForm.element) {
            // Save state to storage before navigation so we can resume
            chrome.storage.local.set({ 
              ferp_cascade_active: true,
              ferp_cascade_current: nextForm.id,
              ferp_config: this.config
            }, () => {
              nextForm.element.click();
            });
          }

        } else {
          console.warn('[fERP Pro] Not on a recognized feedback page.');
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('Not on a recognized feedback page', 'error');
          this.stop();
        }
      } catch (err) {
        console.error('[fERP Pro] Error during execution:', err);
        this.stop();
      }
    },
    
    stop() {
      console.log('[fERP Pro] Stopping automation');
      this.running = false;
      this._stopRequested = true;
      if (FP.ProgressTracker) {
        FP.ProgressTracker.state.running = false;
        FP.ProgressTracker.addLog('Automation stopped by user', 'warning');
        FP.ProgressTracker.sendUpdate();
      }
      
      // Clear cascade state
      if (chrome && chrome.storage) {
        chrome.storage.local.remove(['ferp_cascade_active', 'ferp_cascade_current']);
      }
    },
    
    async fillSingleForm(formContext, sentiment) {
      if (this._stopRequested) return;

      console.log(`[fERP Pro] Filling single form with sentiment: ${sentiment}`);
      if (FP.ProgressTracker) FP.ProgressTracker.addLog(`Filling form fields (${sentiment})...`);

      // Fill the DOM fields
      const success = FP.FormFiller.fillForm(sentiment, {
        randomize: this.config.randomize,
        customText: this.config.customText,
        dryRun: false
      });

      if (!success) {
        console.error('[fERP Pro] Form filling failed - elements not found');
        if (FP.ProgressTracker) {
          FP.ProgressTracker.addLog('Failed to find form elements', 'error');
          if (formContext) FP.ProgressTracker.markFailed(formContext.id, 'Form elements not found');
        }
        return;
      }

      // Handle Captcha — try OCR auto-solve first, fallback to manual
      const captchaField = FP.CaptchaHandler ? FP.CaptchaHandler.getCaptchaField() : null;

      if (captchaField) {
        if (FP.ProgressTracker) FP.ProgressTracker.addLog('CAPTCHA detected — attempting OCR auto-solve...', 'info');

        const autoSolved = await FP.CaptchaHandler.autoSolveCaptcha(true);

        if (autoSolved) {
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('✅ CAPTCHA solved automatically via OCR!', 'success');
          // Form was auto-submitted inside autoSolveCaptcha
        } else {
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('⚠️ OCR failed — manual captcha input required. Type it in the ERP tab and press Enter.', 'warning');
          // setupManualCaptcha + notification already done inside autoSolveCaptcha
        }
      } else {
        // No captcha — apply smart delay then auto-submit
        if (this.config.smartDelays) {
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('Applying smart delay before submit...');
          await this.delay(this.config.delayMin, this.config.delayMax);
        }
        
        if (this._stopRequested) return;

        const submitBtn = FP.FormDetector.getSubmitButton();
        if (submitBtn) {
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('Submitting form...');
          submitBtn.click();
        } else {
          console.error('[fERP Pro] Submit button not found');
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('Submit button not found', 'error');
        }
      }
    },
    
    async delay(min = 2000, max = 5000) {
      const waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log(`[fERP Pro] Delaying for ${waitTime}ms`);
      return new Promise(resolve => setTimeout(resolve, waitTime));
    },

    sendDryRunResult(previewData) {
      if (chrome && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: MSG.DRY_RUN_RESULT,
          payload: { preview: previewData }
        });
      }
      if (FP.ProgressTracker) FP.ProgressTracker.addLog('Dry run complete. Check popup for results.');
    },

    finishCascade() {
      this.running = false;
      if (FP.ProgressTracker) FP.ProgressTracker.state.running = false;
      
      if (this.config.autoDownload && chrome && chrome.runtime) {
        // Find Admit Card link
        const admitCardLink = document.querySelector('a[href*="admitCard"], a[href*="Admit"]');
        if (admitCardLink) {
          if (FP.ProgressTracker) FP.ProgressTracker.addLog('Triggering admit card download...', 'success');
          chrome.runtime.sendMessage({
            type: MSG.DOWNLOAD,
            payload: { url: admitCardLink.href || admitCardLink.getAttribute('onclick') }
          });
        }
      }

      if (this.config.notifications && chrome && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: MSG.NOTIFY,
          payload: { title: 'fERP Pro', message: 'All feedback forms completed successfully!' }
        });
      }
      
      if (FP.ProgressTracker) FP.ProgressTracker.sendUpdate();
    }
  };

  // Check if we are resuming a cascade execution
  if (chrome && chrome.storage) {
    chrome.storage.local.get(['ferp_cascade_active', 'ferp_cascade_current', 'ferp_config'], (data) => {
      Controller.init().then(() => {
        if (data.ferp_cascade_active && FP.FormDetector && FP.FormDetector.isFormPage()) {
          console.log('[fERP Pro] Resuming cascade mode on form page...');
          Controller.config = data.ferp_config || Controller.config;
          Controller.running = true;
          
          // Execute single form logic
          Controller.fillSingleForm({ id: data.ferp_cascade_current }, Controller.config.sentiment);
        }
      });
    });
  } else {
    // Normal init
    Controller.init();
  }

})();
