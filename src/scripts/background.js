const DEFAULT_CONFIG = {
  mode: 'cascade',           // 'cascade' | 'selective'
  sentiment: 'positive',     // 'positive' | 'neutral' | 'negative'
  perProfessor: {},           // { professorKey: 'positive'|'neutral'|'negative' }
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
  theme: 'system',           // 'light' | 'dark' | 'system'
  presets: {}                 // { presetName: configObject }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
    chrome.storage.local.set(items, () => {
      console.log('[fERP Pro BG] Extension installed and default config set.');
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_ADMIT_CARD') {
    const url = message.payload?.url || message.url;
    if (!url) {
      console.warn('[fERP Pro BG] No URL provided for admit card download');
      return;
    }
    chrome.downloads.download({
      url: url,
      filename: 'AdmitCard.pdf',
      saveAs: true
    }, (downloadId) => {
      console.log(`[fERP Pro BG] Download started with ID: ${downloadId}`);
    });
  } else if (message.type === 'SHOW_NOTIFICATION') {
    const title = message.payload?.title || message.title || 'fERP Pro';
    const msg = message.payload?.message || message.message || '';
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon128.png',
      title: title,
      message: msg
    }, (notificationId) => {
      console.log(`[fERP Pro BG] Notification shown with ID: ${notificationId}`);
    });
  }
});

chrome.commands.onCommand.addListener((command) => {
  console.log(`[fERP Pro BG] Command received: ${command}`);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    if (command === 'start-automation') {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'START_AUTOMATION' });
    } else if (command === 'stop-automation') {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_AUTOMATION' });
    }
  });
});
