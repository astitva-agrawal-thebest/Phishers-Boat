document.addEventListener('DOMContentLoaded', async () => {
  const manualScanBtn = document.getElementById('manualScanBtn');
  const statusCard = document.getElementById('statusCard');
  const statusTitle = document.getElementById('statusTitle');
  const statusDesc = document.getElementById('statusDesc');
  const statusIconSvg = document.getElementById('statusIconSvg');
  
  // Stats
  const scannedCountEl = document.getElementById('scannedCount');
  const blockedCountEl = document.getElementById('blockedCount');

  // QR
  const qrDropzone = document.getElementById('qrDropzone');
  const qrUploadInput = document.getElementById('qrUploadInput');
  const scanLine = document.getElementById('scanLine');

  // Manual URL Scanner
  const manualUrlInput = document.getElementById('manualUrlInput');
  const manualUrlBtn = document.getElementById('manualUrlBtn');
  const manualScanResult = document.getElementById('manualScanResult');

  // Settings
  const settingsBtn = document.getElementById('settingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.tab-view');
  
  // History
  const historyList = document.getElementById('historyList');

  // --- TAB NAVIGATION LOGIC ---
  function switchView(targetId) {
    views.forEach(v => v.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    
    document.getElementById(targetId).classList.add('active');
    
    // Update active nav button if it exists
    const btn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
    if (btn) btn.classList.add('active');
    
    if (targetId === 'view-session') {
      renderLists();
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.target));
  });

  settingsBtn.addEventListener('click', () => switchView('view-settings'));

  // --- DATA LOADING ---
  chrome.storage.local.get(['scannedCount', 'blockedCount', 'vtApiKey'], (data) => {
    scannedCountEl.textContent = data.scannedCount || 0;
    blockedCountEl.textContent = data.blockedCount || 0;
    if (data.vtApiKey) {
      apiKeyInput.value = data.vtApiKey;
    }
  });

  // Get current active tab
  const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
  let currentHostname = 'Unknown';
  if (activeTab && activeTab.url) {
    try {
      currentHostname = new URL(activeTab.url).hostname;
    } catch(e) {
      currentHostname = 'Invalid URL';
    }
  }

  // Settings Logic
  const toggleKeyBtn = document.getElementById('toggleKeyBtn');
  const clearKeyBtn = document.getElementById('clearKeyBtn');
  const settingsMsg = document.getElementById('settingsMsg');
  
  toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
  });

  saveSettingsBtn.addEventListener('click', () => {
    const newKey = apiKeyInput.value.trim();
    if (newKey) {
      chrome.storage.local.set({ vtApiKey: newKey }, () => {
        apiKeyInput.style.borderColor = 'var(--border-color)';
        settingsMsg.textContent = 'Saved!';
        settingsMsg.classList.add('show');
        setTimeout(() => settingsMsg.classList.remove('show'), 2000);
      });
    } else {
      apiKeyInput.style.borderColor = 'var(--status-danger)';
    }
  });

  clearKeyBtn.addEventListener('click', () => {
    apiKeyInput.value = '';
    chrome.storage.local.remove('vtApiKey', () => {
      apiKeyInput.style.borderColor = 'var(--border-color)';
      settingsMsg.textContent = 'Cleared!';
      settingsMsg.classList.add('show');
      setTimeout(() => settingsMsg.classList.remove('show'), 2000);
    });
  });

  // Current Tab Status
  if (activeTab && activeTab.id) {
    chrome.runtime.sendMessage({ action: 'getTabStatus', tabId: activeTab.id }, (response) => {
      if (response && response.type === 'pending') {
        setPendingState(response.reason || 'Still analyzing...');
      } else if (response && response.type === 'warning' && response.isSuspicious) {
        setWarningState('Caution', response.reason);
      } else if (response && response.isSuspicious === true) {
        setDangerState(response.reason, response.reportUrl);
      } else if (response && response.isSuspicious === false) {
        setSafeState('All Clear', response.reason || 'No immediate threat detected.');
      }
    });
  }

  // Force Rescan
  const manualScanText = document.getElementById('manualScanText');
  manualScanBtn.addEventListener('click', () => {
    manualScanBtn.classList.add('scanning');
    manualScanText.textContent = 'Scanning...';
    injectPixelMascot('scanning');
    if (activeTab && activeTab.id) {
      const cacheKey = `scan_${activeTab.url}`;
      chrome.storage.session.remove([cacheKey], () => {
        chrome.tabs.sendMessage(activeTab.id, { action: 'requestContentScrape' }).catch(() => {
          manualScanText.textContent = 'Failed to inject';
          manualScanBtn.classList.remove('scanning');
          setTimeout(() => manualScanText.textContent = 'Force Rescan Tab', 2000);
        });
      });
    }
    setTimeout(() => {
      manualScanText.textContent = 'Scan Sent';
      manualScanBtn.classList.remove('scanning');
      setTimeout(() => manualScanText.textContent = 'Force Rescan Tab', 2000);
    }, 800);
  });

  // --- EXTERNAL SCANNERS (MANUAL & QR) ---
  
  function renderInlineScanResult(container, data, rawContent, isUrl) {
    container.classList.remove('hidden');
    let prefix = isUrl ? 'Target URL:' : 'Decoded Text:';
    let contentHtml = `
      <div style="margin-bottom: 4px; font-size: 0.8rem; color: var(--text-muted);">${prefix}</div>
      <div class="inline-scan-raw" style="color: var(--accent-cyan); background: rgba(0,240,255,0.05); border: 1px solid rgba(0,240,255,0.2); padding: 8px; border-radius: 6px; word-break: break-all; margin-bottom: 8px; font-family: monospace;">${rawContent}</div>
    `;
    
    if (!isUrl) {
      container.innerHTML = `
        ${contentHtml}
        <div class="inline-scan-verdict" style="color: var(--text-muted);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          This does not appear to be a URL. Check content before trusting.
        </div>
      `;
      return;
    }
    
    let color = data.type === 'pending' ? '#FFC93C' : (data.isSuspicious ? (data.type === 'piracy' ? '#FF2E88' : (data.type === 'warning' ? '#FFC93C' : '#FF3860')) : '#39FF6A');
    let icon = getIconForType(data.type, data.isSuspicious);
    
    let linkHtml = data.reportUrl ? `<div style="margin-top: 8px;"><a href="${data.reportUrl}" target="_blank" style="color: ${color}; font-size: 0.8rem;">View Full Report</a></div>` : '';

    container.innerHTML = `
      ${contentHtml}
      <div class="inline-scan-verdict" style="color: ${color}">
        ${icon} <span>${data.reason}</span>
        ${linkHtml}
      </div>
      <div class="inline-scan-actions">
        <button class="btn btn-sm btn-action-add" data-url="${rawContent}" data-list="trusted" style="background:rgba(57,255,106,0.1); color:#39FF6A;">Trust</button>
        <button class="btn btn-sm btn-action-add" data-url="${rawContent}" data-list="flagged" style="background:rgba(255,56,96,0.1); color:#FF3860;">Flag</button>
      </div>
    `;
    
    // Bind buttons
    container.querySelectorAll('.btn-action-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        const listName = e.target.dataset.list; // 'trusted' or 'flagged'
        addToCustomList(url, listName);
        e.target.textContent = 'Added!';
        e.target.disabled = true;
      });
    });
  }
  
  function addToCustomList(urlStr, listName) {
    let domain = '';
    try { domain = new URL(urlStr).hostname; } catch(e) { return; }
    const isFlagged = listName === 'flagged';
    
    const newItem = {
      url: urlStr,
      hostname: domain,
      timestamp: Date.now(),
      isSuspicious: isFlagged,
      type: isFlagged ? 'danger' : 'safe',
      reason: 'Added manually from popup scanner',
      manual: true,
      note: ''
    };
    
    chrome.storage.session.get(['sessionNonFlagged', 'sessionFlagged'], (data) => {
      let safeList = (data.sessionNonFlagged || []).filter(i => i.hostname !== domain);
      let flaggedList = (data.sessionFlagged || []).filter(i => i.hostname !== domain);
      
      if (isFlagged) flaggedList.unshift(newItem);
      else safeList.unshift(newItem);
      
      chrome.storage.session.set({ sessionNonFlagged: safeList, sessionFlagged: flaggedList });
    });
  }
  
  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) { return false; }
  }

  // Manual Scanner
  manualUrlBtn.addEventListener('click', () => {
    const urlStr = manualUrlInput.value.trim();
    if (!urlStr) return;
    if (!isValidHttpUrl(urlStr)) {
      renderInlineScanResult(manualScanResult, null, urlStr, false);
      return;
    }
    
    manualUrlBtn.textContent = '...';
    chrome.runtime.sendMessage({ action: 'scanExternalUrl', url: urlStr }, (response) => {
      manualUrlBtn.textContent = 'Scan';
      if (response) {
        renderInlineScanResult(manualScanResult, response, urlStr, true);
      }
    });
  });

  // QR Logic Mock
  qrDropzone.addEventListener('click', () => qrUploadInput.click());
  qrUploadInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      scanLine.classList.remove('hidden');
      setTimeout(() => {
        scanLine.classList.add('hidden');
        setDangerState('Embedded URL in QR code redirects to a known phishing gateway.');
      }, 1500);
    }
  });

  // --- SESSION LISTS LOGIC ---
  let currentListTab = 'flagged'; // 'flagged' or 'non_flagged'
  let listSearchTerm = '';
  
  const customListContainer = document.getElementById('customListContainer');
  const listTabs = document.querySelectorAll('.list-tab');
  const listSearch = document.getElementById('listSearch');
  const clearListBtn = document.getElementById('clearListBtn');
  const clearAllSessionBtn = document.getElementById('clearAllSessionBtn');
  
  listTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      listTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentListTab = tab.dataset.target.replace('list-', '');
      renderLists();
    });
  });
  
  listSearch.addEventListener('input', (e) => {
    listSearchTerm = e.target.value.toLowerCase().trim();
    renderLists();
  });
  
  function getIconForType(type, isSuspicious) {
    if (type === 'piracy') return `<svg class="hist-icon hist-danger" viewBox="0 0 24 24" fill="none" stroke="#FF2E88" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    if (isSuspicious) return `<svg class="hist-icon hist-danger" viewBox="0 0 24 24" fill="none" stroke="#FF3860" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>`;
    return `<svg class="hist-icon hist-safe" viewBox="0 0 24 24" fill="none" stroke="#39FF6A" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  }
  
  function renderLists() {
    chrome.storage.session.get(['sessionFlagged', 'sessionNonFlagged'], (data) => {
      let list = currentListTab === 'flagged' ? (data.sessionFlagged || []) : (data.sessionNonFlagged || []);
      
      const countFlagged = (data.sessionFlagged || []).length;
      const countNonFlagged = (data.sessionNonFlagged || []).length;
      
      document.getElementById('count-flagged').textContent = countFlagged;
      document.getElementById('count-non_flagged').textContent = countNonFlagged;
      
      if (listSearchTerm) {
        list = list.filter(item => item.hostname.toLowerCase().includes(listSearchTerm));
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp); // Newest first
      
      if (list.length === 0) {
        customListContainer.innerHTML = `<div style="text-align:center; padding: 2rem 1rem; color: var(--text-muted);">No items in ${currentListTab} list.</div>`;
        const idleMascots = ['idle', 'idleCat', 'idleBot'];
        const randomIdle = idleMascots[Math.floor(Math.random() * idleMascots.length)];
        injectPixelMascot(randomIdle);
        return;
      }
      
      customListContainer.innerHTML = list.map(item => {
        const dateStr = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
        const icon = getIconForType(item.type || (item.isSuspicious ? 'danger' : 'safe'), item.isSuspicious || item.status === 'flagged');
        const nameColor = (item.isSuspicious || item.status === 'flagged') ? (item.type === 'piracy' ? '#FF2E88' : '#FF3860') : '#39FF6A';
        const overrideBadge = item.manual ? `<span style="font-size: 0.65rem; background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; margin-left: 6px;">Manual</span>` : '';
        const shortReason = (item.reason && item.reason.length > 60) ? item.reason.substring(0, 60) + '...' : (item.reason || 'No reason provided.');
        
        return `
          <div class="list-item-card" data-hostname="${item.hostname}">
            <div class="list-item-top">
              ${icon}
              <div class="list-item-details">
                <span class="list-item-url" style="color: ${nameColor}">${item.hostname} ${overrideBadge}</span>
                <div class="list-item-meta" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                  <span>Score: ${item.riskScore !== undefined ? item.riskScore : 'N/A'} &nbsp;|&nbsp; ${dateStr}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${shortReason}</span>
                </div>
              </div>
            </div>
            <div class="list-item-actions">
              <button class="list-btn move" data-hostname="${item.hostname}" title="Move to ${currentListTab === 'flagged' ? 'Non-Flagged' : 'Flagged'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3v18"></path><path d="M10 14l7 7 7-7"></path><path d="M7 21V3"></path><path d="M14 10L7 3 0 10"></path></svg> Move
              </button>
              <button class="list-btn delete" data-hostname="${item.hostname}" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Remove
              </button>
            </div>
          </div>
        `;
      }).join('');
    });
  }
  
  customListContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button.list-btn');
    if (!btn) return;
    
    const hostname = btn.dataset.hostname;
    
    if (btn.classList.contains('delete')) {
      deleteItem(currentListTab, hostname);
    } else if (btn.classList.contains('move')) {
      moveItem(hostname);
    }
  });
  
  function deleteItem(listType, hostname) {
    const storageKey = listType === 'flagged' ? 'sessionFlagged' : 'sessionNonFlagged';
    chrome.storage.session.get([storageKey], (data) => {
      let list = data[storageKey] || [];
      list = list.filter(i => i.hostname !== hostname);
      chrome.storage.session.set({ [storageKey]: list }, renderLists);
    });
  }
  
  function moveItem(hostname) {
    chrome.storage.session.get(['sessionNonFlagged', 'sessionFlagged'], (data) => {
      let safeList = data.sessionNonFlagged || [];
      let flaggedList = data.sessionFlagged || [];
      
      let item = null;
      if (currentListTab === 'flagged') {
        item = flaggedList.find(i => i.hostname === hostname);
        flaggedList = flaggedList.filter(i => i.hostname !== hostname);
        if (item) {
          item.isSuspicious = false;
          item.status = 'non_flagged';
          item.type = 'safe';
          item.manual = true;
          item.timestamp = Date.now();
          safeList.unshift(item);
        }
      } else {
        item = safeList.find(i => i.hostname === hostname);
        safeList = safeList.filter(i => i.hostname !== hostname);
        if (item) {
          item.isSuspicious = true;
          item.status = 'flagged';
          item.type = 'danger';
          item.manual = true;
          item.timestamp = Date.now();
          flaggedList.unshift(item);
        }
      }
      
      chrome.storage.session.set({ sessionNonFlagged: safeList, sessionFlagged: flaggedList }, renderLists);
    });
  }
  
  // Clear Current View
  clearListBtn.addEventListener('click', () => {
    const listName = currentListTab === 'flagged' ? 'Flagged' : 'Non-Flagged';
    if (confirm(`Clear all items from the current ${listName} list?`)) {
      const storageKey = currentListTab === 'flagged' ? 'sessionFlagged' : 'sessionNonFlagged';
      chrome.storage.session.set({ [storageKey]: [] }, renderLists);
    }
  });
  
  // Clear All Session
  clearAllSessionBtn.addEventListener('click', () => {
    if (confirm(`Wipe all session tracking data completely?`)) {
      chrome.storage.session.set({ sessionFlagged: [], sessionNonFlagged: [] }, renderLists);
    }
  });

  // --- PIXEL MASCOT OVERLAY ---
  const MASCOTS = {
    detective: `<svg viewBox="0 0 16 16" width="32" height="32" fill="#00F0FF"><rect x="6" y="2" width="4" height="4"/><rect x="4" y="6" width="8" height="6"/><rect x="6" y="12" width="2" height="4"/><rect x="10" y="12" width="2" height="4"/><path d="M12 8h2v2h-2z" fill="#fff"/></svg>`,
    happy: `<svg viewBox="0 0 16 16" width="32" height="32" fill="#39FF6A"><rect x="6" y="2" width="4" height="4"/><rect x="4" y="6" width="8" height="6"/><rect x="2" y="4" width="2" height="4"/><rect x="12" y="4" width="2" height="4"/><rect x="6" y="12" width="2" height="4"/><rect x="8" y="12" width="2" height="4"/></svg>`,
    alert: `<svg viewBox="0 0 16 16" width="32" height="32" fill="#FF3860"><rect x="6" y="4" width="4" height="4"/><rect x="4" y="8" width="8" height="6"/><rect x="6" y="14" width="4" height="2"/><rect x="7" y="0" width="2" height="2"/><rect x="7" y="3" width="2" height="1"/></svg>`,
    idle: `<svg viewBox="0 0 16 16" width="32" height="32" fill="#a0a0a0"><rect x="6" y="4" width="4" height="4"/><rect x="5" y="8" width="6" height="4"/><rect x="6" y="12" width="4" height="2"/></svg>`,
    idleCat: `<svg viewBox="0 0 16 16" width="32" height="32" fill="#FFC93C"><rect x="4" y="6" width="8" height="6"/><rect x="4" y="4" width="2" height="2"/><rect x="10" y="4" width="2" height="2"/><rect x="5" y="12" width="2" height="2"/><rect x="9" y="12" width="2" height="2"/><rect x="12" y="8" width="2" height="4"/></svg>`,
    idleBot: `<svg viewBox="0 0 16 16" width="32" height="32" fill="#00F0FF"><path d="M4 4h8v8H4z" fill="#141A24"/><rect x="3" y="3" width="10" height="10" fill="none" stroke="#00F0FF" stroke-width="2"/><rect x="6" y="6" width="4" height="2" fill="#00F0FF"/><rect x="7" y="1" width="2" height="2"/><rect x="6" y="13" width="4" height="2"/></svg>`
  };

  function injectPixelMascot(state) {
    document.querySelectorAll('.pixel-mascot-overlay').forEach(el => el.remove());
    let svg = '', animation = '', container = document.body, style = '';

    if (state === 'scanning') {
      svg = MASCOTS.detective;
      animation = 'pixel-walk 3s infinite steps(6)';
      style = 'bottom: 70px; left: 10px;';
    } else if (state === 'safe') {
      svg = MASCOTS.happy;
      animation = 'pixel-bob 2s infinite steps(2)';
      style = 'top: -10px; right: -10px;';
      container = document.getElementById('statusCard');
    } else if (state === 'danger') {
      svg = MASCOTS.alert;
      animation = 'pixel-alert 1s infinite steps(2)';
      style = 'top: -10px; right: -10px;';
      container = document.getElementById('statusCard');
    } else if (state.startsWith('idle')) {
      svg = MASCOTS[state];
      animation = 'pixel-bob 3s infinite steps(2)';
      style = 'position: relative; margin: 1rem auto; display: block;';
      container = document.getElementById('customListContainer');
    }
    
    if (!container) return;
    const mascot = document.createElement('div');
    mascot.className = 'pixel-mascot-overlay';
    mascot.innerHTML = svg;
    mascot.style.cssText = `${style} animation: ${animation};`;
    container.appendChild(mascot);
  }



  // UI Helpers
  function setDangerState(reason, reportUrl) {
    statusCard.className = 'status-card danger';
    statusTitle.textContent = 'CRITICAL THREAT';
    statusDesc.innerHTML = (reason || 'Suspicious indicators found.') + (reportUrl ? `<br><a href="${reportUrl}" target="_blank" style="color: #FF3860; text-decoration: underline; margin-top: 5px; display: inline-block;">View Full Report</a>` : '');
    statusIconSvg.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
    injectPixelMascot('danger');
  }

  function setSafeState(title, reason) {
    statusCard.className = 'status-card safe';
    statusTitle.textContent = title;
    statusDesc.textContent = reason;
    statusIconSvg.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
    if (title === 'All Clear') injectPixelMascot('safe');
  }

  function setWarningState(title, reason) {
    statusCard.className = 'status-card warning';
    statusTitle.textContent = title;
    statusDesc.textContent = reason;
    statusIconSvg.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
  }

  function setPendingState(reason) {
    statusCard.className = 'status-card warning'; // Use yellow for pending
    statusTitle.textContent = 'Scanning...';
    statusDesc.textContent = reason;
    statusIconSvg.innerHTML = '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
    injectPixelMascot('scanning');
  }
});
