/**
 * fERP Pro Popup Script
 * Handles UI interactions, state management, and communication with background/content scripts.
 */

// Initialize namespace
window.FeedbackPro = window.FeedbackPro || {};

(function() {
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

  let currentConfig = { ...DEFAULT_CONFIG };

  // DOM Elements
  const els = {
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    modeInputs: document.querySelectorAll('input[name="mode"]'),
    sentimentInputs: document.querySelectorAll('input[name="sentiment"]'),
    randomizeCheck: document.getElementById('randomize'),
    customText: document.getElementById('customText'),
    startBtn: document.getElementById('startBtn'),
    dryRunBtn: document.getElementById('dryRunBtn'),
    stopBtn: document.getElementById('stopBtn'),
    statusIndicator: document.getElementById('statusIndicator'),
    
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    logArea: document.getElementById('logArea'),
    formsTableBody: document.querySelector('#formsTable tbody'),
    
    smartDelaysCheck: document.getElementById('smartDelays'),
    delaySliders: document.getElementById('delaySliders'),
    delayMinSlider: document.getElementById('delayMin'),
    delayMaxSlider: document.getElementById('delayMax'),
    delayMinVal: document.getElementById('delayMinVal'),
    delayMaxVal: document.getElementById('delayMaxVal'),
    
    autoDownloadCheck: document.getElementById('autoDownload'),
    notificationsCheck: document.getElementById('notifications'),
    
    autoRetryCheck: document.getElementById('autoRetry'),
    maxRetriesRow: document.getElementById('maxRetriesRow'),
    maxRetriesInput: document.getElementById('maxRetries'),
    
    themeInputs: document.querySelectorAll('input[name="theme"]'),
    
    presetSelect: document.getElementById('presetSelect'),
    loadPresetBtn: document.getElementById('loadPresetBtn'),
    presetName: document.getElementById('presetName'),
    savePresetBtn: document.getElementById('savePresetBtn'),
    exportPresetsBtn: document.getElementById('exportPresetsBtn'),
    importPresetsInput: document.getElementById('importPresetsInput')
  };

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (currentConfig.theme === 'system') {
      applyTheme('system');
    }
  });

  /**
   * Applies the theme to the body
   */
  function applyTheme(theme) {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.body.setAttribute('data-theme', theme);
    }
  }

  /**
   * Loads config from storage and populates UI
   */
  async function loadConfig() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn("Chrome extensions API not found. Used fallback.");
      return;
    }
    chrome.storage.local.get(['config', 'status'], (result) => {
      if (result.config) {
        currentConfig = { ...DEFAULT_CONFIG, ...result.config };
      }
      populateUI();
      if (result.status) {
        updateStatus(result.status);
      }
    });
  }

  /**
   * Saves current config to storage
   */
  function saveConfig() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.set({ config: currentConfig });
  }

  /**
   * Populates all UI elements based on currentConfig
   */
  function populateUI() {
    // Mode
    els.modeInputs.forEach(input => {
      input.checked = (input.value === currentConfig.mode);
    });

    // Sentiment
    els.sentimentInputs.forEach(input => {
      input.checked = (input.value === currentConfig.sentiment);
    });

    // Toggles and inputs
    if (els.randomizeCheck) els.randomizeCheck.checked = currentConfig.randomize;
    if (els.customText) els.customText.value = currentConfig.customText || '';
    
    if (els.smartDelaysCheck) {
      els.smartDelaysCheck.checked = currentConfig.smartDelays;
      els.delaySliders.style.display = currentConfig.smartDelays ? 'block' : 'none';
      els.delayMinSlider.value = currentConfig.delayMin;
      els.delayMaxSlider.value = currentConfig.delayMax;
      els.delayMinVal.textContent = (currentConfig.delayMin / 1000).toFixed(1);
      els.delayMaxVal.textContent = (currentConfig.delayMax / 1000).toFixed(1);
    }

    if (els.autoDownloadCheck) els.autoDownloadCheck.checked = currentConfig.autoDownload;
    if (els.notificationsCheck) els.notificationsCheck.checked = currentConfig.notifications;
    
    if (els.autoRetryCheck) {
      els.autoRetryCheck.checked = currentConfig.autoRetry;
      els.maxRetriesRow.style.display = currentConfig.autoRetry ? 'flex' : 'none';
      els.maxRetriesInput.value = currentConfig.maxRetries;
    }

    // Theme
    els.themeInputs.forEach(input => {
      input.checked = (input.value === currentConfig.theme);
    });
    applyTheme(currentConfig.theme);

    // Presets
    populatePresetsDropdown();
  }

  /**
   * Populates the presets dropdown
   */
  function populatePresetsDropdown() {
    if (!els.presetSelect) return;
    els.presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
    if (currentConfig.presets) {
      Object.keys(currentConfig.presets).forEach(presetName => {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        els.presetSelect.appendChild(option);
      });
    }
  }

  /**
   * Sends a message to the active tab
   */
  async function sendMessageToActiveTab(message) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, message).catch(err => {
        console.log("Could not send message to tab. Is the content script injected?", err);
      });
    });
  }

  /**
   * Updates the status indicator
   */
  function updateStatus(status) {
    if (!els.statusIndicator) return;
    if (status === 'running') {
      els.statusIndicator.textContent = 'Automation Running...';
      els.statusIndicator.className = 'status-indicator running';
      els.startBtn.disabled = true;
      els.dryRunBtn.disabled = true;
    } else {
      els.statusIndicator.textContent = 'Idle';
      els.statusIndicator.className = 'status-indicator';
      els.startBtn.disabled = false;
      els.dryRunBtn.disabled = false;
    }
  }

  /**
   * Appends a message to the log area
   */
  function appendLog(message) {
    if (!els.logArea) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    entry.textContent = `[${timestamp}] ${message}`;
    els.logArea.appendChild(entry);
    els.logArea.scrollTop = els.logArea.scrollHeight;
  }

  /**
   * Updates the forms table
   */
  function updateFormsTable(forms) {
    if (!els.formsTableBody) return;
    els.formsTableBody.innerHTML = '';
    forms.forEach(form => {
      const tr = document.createElement('tr');
      
      const tdSub = document.createElement('td');
      tdSub.textContent = form.subjectName || 'Unknown Subject';
      
      const tdProf = document.createElement('td');
      tdProf.textContent = form.professorName || 'Unknown Prof';
      
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${form.status}`;
      badge.textContent = form.status;
      tdStatus.appendChild(badge);

      tr.appendChild(tdSub);
      tr.appendChild(tdProf);
      tr.appendChild(tdStatus);
      els.formsTableBody.appendChild(tr);
    });
  }

  // EVENT LISTENERS

  // Tab switching
  els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      els.tabs.forEach(t => t.classList.remove('active'));
      els.tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      document.getElementById(targetId).classList.add('active');

      if (tab.dataset.tab === 'progress') {
        sendMessageToActiveTab({ type: 'REQUEST_FORMS' });
      }
    });
  });

  // Control inputs
  els.modeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentConfig.mode = e.target.value;
      saveConfig();
    });
  });

  els.sentimentInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentConfig.sentiment = e.target.value;
      saveConfig();
    });
  });

  if (els.randomizeCheck) {
    els.randomizeCheck.addEventListener('change', (e) => {
      currentConfig.randomize = e.target.checked;
      saveConfig();
    });
  }

  if (els.customText) {
    els.customText.addEventListener('input', (e) => {
      currentConfig.customText = e.target.value;
      saveConfig();
    });
  }

  // Action buttons
  if (els.startBtn) {
    els.startBtn.addEventListener('click', () => {
      currentConfig.dryRun = false;
      saveConfig();
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ status: 'running' });
      }
      updateStatus('running');
      appendLog('Starting automation...');
      sendMessageToActiveTab({ type: 'START_AUTOMATION', payload: { config: currentConfig } });
    });
  }

  if (els.dryRunBtn) {
    els.dryRunBtn.addEventListener('click', () => {
      currentConfig.dryRun = true;
      saveConfig();
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ status: 'running' });
      }
      updateStatus('running');
      appendLog('Starting dry run...');
      sendMessageToActiveTab({ type: 'START_AUTOMATION', dryRun: true });
    });
  }

  if (els.stopBtn) {
    els.stopBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ status: 'idle' });
      }
      updateStatus('idle');
      appendLog('Automation stopped by user.');
      sendMessageToActiveTab({ type: 'STOP_AUTOMATION' });
    });
  }

  // Settings inputs
  if (els.smartDelaysCheck) {
    els.smartDelaysCheck.addEventListener('change', (e) => {
      currentConfig.smartDelays = e.target.checked;
      els.delaySliders.style.display = e.target.checked ? 'block' : 'none';
      saveConfig();
    });
  }

  if (els.delayMinSlider) {
    els.delayMinSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      const maxVal = parseInt(els.delayMaxSlider.value);
      if (val >= maxVal) {
        els.delayMaxSlider.value = val + 500;
        currentConfig.delayMax = val + 500;
        els.delayMaxVal.textContent = ((val + 500) / 1000).toFixed(1);
      }
      currentConfig.delayMin = val;
      els.delayMinVal.textContent = (val / 1000).toFixed(1);
      saveConfig();
    });
  }

  if (els.delayMaxSlider) {
    els.delayMaxSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      const minVal = parseInt(els.delayMinSlider.value);
      if (val <= minVal) {
        els.delayMinSlider.value = val > 500 ? val - 500 : 0;
        currentConfig.delayMin = els.delayMinSlider.value;
        els.delayMinVal.textContent = (currentConfig.delayMin / 1000).toFixed(1);
      }
      currentConfig.delayMax = val;
      els.delayMaxVal.textContent = (val / 1000).toFixed(1);
      saveConfig();
    });
  }

  if (els.autoDownloadCheck) {
    els.autoDownloadCheck.addEventListener('change', (e) => {
      currentConfig.autoDownload = e.target.checked;
      saveConfig();
    });
  }

  if (els.notificationsCheck) {
    els.notificationsCheck.addEventListener('change', (e) => {
      currentConfig.notifications = e.target.checked;
      saveConfig();
    });
  }

  if (els.autoRetryCheck) {
    els.autoRetryCheck.addEventListener('change', (e) => {
      currentConfig.autoRetry = e.target.checked;
      els.maxRetriesRow.style.display = e.target.checked ? 'flex' : 'none';
      saveConfig();
    });
  }

  if (els.maxRetriesInput) {
    els.maxRetriesInput.addEventListener('change', (e) => {
      currentConfig.maxRetries = parseInt(e.target.value);
      saveConfig();
    });
  }

  els.themeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentConfig.theme = e.target.value;
      applyTheme(currentConfig.theme);
      saveConfig();
    });
  });

  // Presets management
  if (els.savePresetBtn) {
    els.savePresetBtn.addEventListener('click', () => {
      const name = els.presetName.value.trim();
      if (!name) return alert('Please enter a preset name');
      
      if (!currentConfig.presets) currentConfig.presets = {};
      
      // Save current config excluding presets
      const presetData = { ...currentConfig };
      delete presetData.presets;
      
      currentConfig.presets[name] = presetData;
      saveConfig();
      populatePresetsDropdown();
      els.presetName.value = '';
      alert(`Preset '${name}' saved!`);
    });
  }

  if (els.loadPresetBtn) {
    els.loadPresetBtn.addEventListener('click', () => {
      const name = els.presetSelect.value;
      if (!name) return alert('Please select a preset to load');
      
      if (currentConfig.presets && currentConfig.presets[name]) {
        const presetData = currentConfig.presets[name];
        currentConfig = { ...currentConfig, ...presetData };
        saveConfig();
        populateUI();
        alert(`Preset '${name}' loaded!`);
      }
    });
  }

  if (els.exportPresetsBtn) {
    els.exportPresetsBtn.addEventListener('click', () => {
      if (!currentConfig.presets || Object.keys(currentConfig.presets).length === 0) {
        return alert('No presets to export.');
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig.presets, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "ferp_presets.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });
  }

  if (els.importPresetsInput) {
    els.importPresetsInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedPresets = JSON.parse(event.target.result);
          if (!currentConfig.presets) currentConfig.presets = {};
          
          // Merge presets
          currentConfig.presets = { ...currentConfig.presets, ...importedPresets };
          saveConfig();
          populatePresetsDropdown();
          alert('Presets imported successfully!');
        } catch (err) {
          alert('Invalid JSON file.');
        }
        els.importPresetsInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Listen for messages from background/content
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'PROGRESS_UPDATE') {
        const data = msg.payload || msg;
        const { completed, total, log, running } = data;
        if (total > 0 && els.progressBar && els.progressText) {
          const percentage = Math.round((completed / total) * 100);
          els.progressBar.style.width = `${percentage}%`;
          els.progressText.textContent = `${completed}/${total}`;
        }
        if (Array.isArray(log) && log.length > 0) {
          const lastEntry = log[log.length - 1];
          appendLog(lastEntry.message || lastEntry);
        }
        if (running === false) {
          updateStatus('idle');
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ status: 'idle' });
          }
        }
      } else if (msg.type === 'FORMS_LIST') {
        const forms = msg.payload?.forms || msg.forms || [];
        updateFormsTable(forms);
      } else if (msg.type === 'DRY_RUN_RESULT') {
        updateStatus('idle');
        const preview = msg.payload?.preview || [];
        appendLog(`Dry run complete: ${preview.length} form(s) would be filled.`);
        preview.forEach(p => {
          const label = p.form ? p.form.subjectName : (p.sentiment || 'unknown');
          appendLog(`  → ${label}: sentiment=${p.expectedSentiment || p.sentiment}`);
        });
      } else if (msg.type === 'CAPTCHA_NEEDED') {
        appendLog('⚠️ CAPTCHA detected — switch to ERP tab and type the captcha.');
      }
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', loadConfig);
})();
