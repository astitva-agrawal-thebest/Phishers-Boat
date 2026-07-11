// AI Phishing Defense - Background Service Worker (Advanced Hybrid Engine)
importScripts('reputationClient.js');

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEBUG = true; // Set to true to verify pipeline execution

// No hardcoded fallback keys allowed per user instructions

let localModelWeights = null;

// Known Brands for Clone Detection
const KNOWN_BRANDS = [
  "google.com", "accounts.google.com", "microsoft.com", "login.microsoftonline.com",
  "apple.com", "paypal.com", "amazon.com", "facebook.com", "netflix.com", 
  "chase.com", "bankofamerica.com", "wellsfargo.com", "github.com"
];

// Load weights on startup
async function loadLocalModel() {
  try {
    const url = chrome.runtime.getURL('background/model_weights.json');
    const response = await fetch(url);
    localModelWeights = await response.json();
    if (DEBUG) logTrace('Init', 'Local Model Weights loaded successfully.');
  } catch (err) {
    if (DEBUG) logTrace('Error', 'Failed to load local model weights', err);
  }
}
loadLocalModel();



function logTrace(stage, message, data = '') {
  console.log(`[PIPELINE: ${stage}] ${message}`, data);
}

// -------------------------------------------------------------
// MODULE 1: LOCAL HEURISTICS (Math-Based Scoring)
// -------------------------------------------------------------
function extractFeatures(urlStr, content) {
  let url;
  try {
    url = new URL(urlStr);
  } catch(e) { return {}; }
  
  const features = {};
  
  // URL Length (-1 if safe (<54), 0 if suspicious, 1 if phishing (>75))
  if (urlStr.length < 54) features.URLURL_Length = -1;
  else if (urlStr.length > 75) features.URLURL_Length = 1;
  else features.URLURL_Length = 0;
  
  // @ Symbol
  features.having_At_Symbol = urlStr.includes('@') ? 1 : -1;
  
  // // Redirect (last index of // > 7 means it's not the protocol)
  features.double_slash_redirecting = urlStr.lastIndexOf('//') > 7 ? 1 : -1;
  
  // Prefix/Suffix in domain (dash usually means phishing)
  features.Prefix_Suffix = url.hostname.includes('-') ? 1 : -1;
  
  // Subdomains (more than 2 dots in hostname usually bad, ignoring www)
  const dots = url.hostname.replace('www.', '').split('.').length - 1;
  features.having_Sub_Domain = dots > 2 ? 1 : (dots === 2 ? 0 : -1);
  
  // HTTPS token in domain
  features.HTTPS_token = url.hostname.includes('https') ? 1 : -1;
  
  // Length of content/links heuristic
  const links = (content.match(/http/g) || []).length;
  features.Links_pointing_to_page = links > 10 ? 1 : -1;
  
  return features;
}

async function analyzeWithLocalModel(content, url) {
  if (DEBUG) logTrace('Local AI', 'Starting math-based feature extraction for:', url);
  if (!localModelWeights) return { isSuspicious: false, reason: "Local model not loaded." };
  
  const features = extractFeatures(url, content);
  let score = 0;
  
  for (const [feat, val] of Object.entries(features)) {
    if (localModelWeights[feat]) {
      score += (val * localModelWeights[feat]);
    }
  }
  
  const isSuspicious = score > 0.3;
  if (DEBUG) logTrace('Local AI', `Completed. Score: ${score.toFixed(2)}. Suspicious: ${isSuspicious}`);
  return {
    isSuspicious,
    reason: isSuspicious ? `Local heuristics detected structural anomalies (Score: ${score.toFixed(2)})` : `Local heuristics cleared URL structure (Score: ${score.toFixed(2)})`
  };
}

// -------------------------------------------------------------
// MODULE 2: PIRACY & CLONE DETECTION
// -------------------------------------------------------------
// Helper: Levenshtein distance for typosquatting/clone detection
function levenshtein(a, b) {
  const matrix = [];
  let i, j;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  for (i = 0; i <= b.length; i++) matrix[i] = [i];
  for (j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // insertion/deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

async function analyzeForPiracyAndClones(content, urlStr) {
  if (DEBUG) logTrace('Piracy/Clone', 'Starting checks for:', urlStr);
  let url;
  try { url = new URL(urlStr); } catch(e) { return { isSuspicious: false }; }
  
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  
  // 1. Clone Site Typosquatting Check
  for (const brand of KNOWN_BRANDS) {
    if (hostname === brand) break; // It is the legitimate brand
    
    // Check if it's extremely close to a known brand but not exact
    const dist = levenshtein(hostname, brand);
    if (dist > 0 && dist <= 2) {
      if (DEBUG) logTrace('Piracy/Clone', `Clone detected! Distance from ${brand} is ${dist}`);
      return {
        isSuspicious: true,
        type: 'piracy',
        reason: `CLONE SITE: This looks like a deceptive copy of ${brand}. It may exist only to infect your device or steal credentials.`
      };
    }
  }

  // 2. Basic Piracy & Malvertising Heuristics in text
  const lowerContent = content.toLowerCase();
  const piracyKeywords = [
    "download free full version", "free download latest version", "free download", "cracked by", "100% working crack", 
    "keygen", "free movies online no signup", "watch full movie free hd",
    "fitgirl repacks", "repack features", "selective download", "dodi repacks", "empress crack", "skidrow reloaded"
  ];
  
  for (const kw of piracyKeywords) {
    if (lowerContent.includes(kw)) {
      if (DEBUG) logTrace('Piracy/Clone', `Piracy keyword detected: ${kw}`);
      return {
        isSuspicious: true,
        type: 'piracy',
        reason: 'PIRACY & MALWARE RISK: Site exhibits patterns of unlicensed software/media distribution, which often hosts malicious payloads.'
      };
    }
  }

  if (DEBUG) logTrace('Piracy/Clone', 'Cleared.');
  return { isSuspicious: false };
}



// -------------------------------------------------------------
// MAIN PIPELINE EXECUTION
// -------------------------------------------------------------
async function checkCustomLists(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    const data = await chrome.storage.session.get(['sessionNonFlagged', 'sessionFlagged']);
    const safeList = data.sessionNonFlagged || [];
    const flaggedList = data.sessionFlagged || [];
    
    // Check if it's explicitly in safe list
    const safeMatch = safeList.find(i => i.hostname === hostname);
    if (safeMatch && safeMatch.manual) {
      return { override: true, result: { isSuspicious: false, type: 'safe', reason: 'Manually trusted by user.' } };
    }
    
    // Check if it's explicitly in flagged list
    const flaggedMatch = flaggedList.find(i => i.hostname === hostname);
    if (flaggedMatch) {
      return { override: true, result: { isSuspicious: true, type: flaggedMatch.type || 'danger', reason: 'Previously flagged by you. ' + (flaggedMatch.reason || '') } };
    }
    
    return { override: false };
  } catch(e) {
    return { override: false };
  }
}

async function runPipeline(tabId, url, content) {
  if (DEBUG) logTrace('Pipeline', '--- PIPELINE INITIATED ---', url);
  
  if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
    return;
  }

  // Check cache
  const cacheKey = `scan_${url}`;
  const cached = await chrome.storage.session.get([cacheKey]);
  if (cached[cacheKey] && (Date.now() - cached[cacheKey].timestamp < CACHE_TTL_MS)) {
    if (DEBUG) logTrace('Pipeline', 'Cache Hit. Using previous result.');
    handleVerdict(tabId, url, cached[cacheKey].result);
    return;
  }

  chrome.action.setBadgeText({ text: '...', tabId: tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#00F0FF', tabId: tabId });

  try {
    // 1. Run Piracy/Clone Check First (High Severity)
    const piracyResult = await analyzeForPiracyAndClones(content, url);
    if (piracyResult.isSuspicious) {
      if (DEBUG) logTrace('Pipeline', 'Halting: Piracy/Clone detected.');
      await finalizeVerdict(tabId, url, piracyResult, cacheKey);
      return;
    }

    // 2. Run Local Engine immediately
    const localResult = await analyzeWithLocalModel(content, url);
    let currentResult = localResult;

    // Show initial local result
    await finalizeVerdict(tabId, url, currentResult, cacheKey);

    // 3. Fire Backend Engine asynchronously (Non-blocking)
    if (DEBUG) logTrace('Pipeline', 'Firing Backend Engine asynchronously.');
    
    // We update the UI to indicate scanning is ongoing, without removing the current badge if it's already flagged
    if (!currentResult.isSuspicious) {
      chrome.action.setBadgeText({ text: '...', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#FFC93C', tabId: tabId });
    }

    checkBackendReputation(url).then(async (cloudResult) => {
      if (cloudResult.status === 'error') {
        // STRICT FAILURE HANDLING
        const errorResult = { isSuspicious: true, type: 'warning', reason: cloudResult.reason };
        await finalizeVerdict(tabId, url, errorResult, cacheKey);
        chrome.action.setBadgeText({ text: 'ERR', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FFC93C', tabId: tabId });
        chrome.tabs.sendMessage(tabId, { action: 'showBanner', type: 'warning', reason: cloudResult.reason }).catch(() => {});
        return;
      }
      
      if (cloudResult.status === 'unavailable') {
        // Fall back to local silently, just restore previous badge
        if (DEBUG) logTrace('Pipeline', 'Backend unavailable, keeping local result.');
        
        let fallbackResult = { 
          ...currentResult, 
          reason: currentResult.reason + " (Note: " + cloudResult.reason + ")" 
        };
        
        handleVerdict(tabId, url, fallbackResult);
        return;
      }

      let finalResult = { ...currentResult };

      if (currentResult.isSuspicious && cloudResult.isSuspicious) {
         finalResult = { isSuspicious: true, type: 'danger', reason: `Confirmed Threat! Both local and backend flagged this site: ${cloudResult.reason}` };
      } else if (currentResult.isSuspicious) {
         finalResult = currentResult; // Keep local danger
      } else if (cloudResult.isSuspicious) {
         finalResult = { isSuspicious: true, type: cloudResult.type, reason: cloudResult.reason };
      } else if (cloudResult.status === 'pending') {
         finalResult = { isSuspicious: false, type: 'pending', reason: 'Still analyzing...' };
      }

      if (cloudResult.reportUrl) {
         finalResult.reportUrl = cloudResult.reportUrl;
      }

      await finalizeVerdict(tabId, url, finalResult, cacheKey);
    });

  } catch (error) {
    if (DEBUG) logTrace('Pipeline Error', error.message);
    
    chrome.action.setBadgeText({ text: 'ERR', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#FFC93C', tabId: tabId });
    
    chrome.tabs.sendMessage(tabId, {
      action: 'showBanner',
      type: 'warning',
      reason: "Scan failed due to a processing error."
    }).catch(() => {});
  }
}

async function finalizeVerdict(tabId, url, result, cacheKey) {
  if (DEBUG) logTrace('Pipeline Verdict', result.reason);

  await chrome.storage.session.set({
    [cacheKey]: { result, timestamp: Date.now() }
  });

  const { scannedCount = 0, blockedCount = 0 } = await chrome.storage.local.get(['scannedCount', 'blockedCount']);
  const updates = { scannedCount: scannedCount + 1 };
  if (result.isSuspicious) updates.blockedCount = blockedCount + 1;
  await chrome.storage.local.set(updates);

  await updateSessionLists(url, result);

  handleVerdict(tabId, url, result);
}

function handleVerdict(tabId, urlStr, result, isOverride = false) {
  chrome.storage.session.set({ [`tabStatus_${tabId}`]: result });

  if (result.isSuspicious) {
    chrome.action.setBadgeText({ text: '!', tabId: tabId });
    const bgColor = result.type === 'piracy' ? '#FF2E88' : '#FF3860';
    chrome.action.setBadgeBackgroundColor({ color: bgColor, tabId: tabId }); 
    
    chrome.tabs.sendMessage(tabId, {
      action: 'showBanner',
      type: result.type || 'danger',
      reason: result.reason
    }).catch(() => { if (DEBUG) logTrace('Error', 'Content script not ready for banner.'); });
  } else {
    chrome.action.setBadgeText({ text: '✓', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#39FF6A', tabId: tabId });
    
    chrome.tabs.sendMessage(tabId, {
      action: 'showBanner',
      type: 'safe',
      reason: result.reason || 'No threat detected. (Confidence: High)'
    }).catch(() => { if (DEBUG) logTrace('Error', 'Content script not ready for safe banner.'); });
  }
}

async function updateSessionLists(urlStr, result) {
  try {
    const urlObj = new URL(urlStr);
    const hostname = urlObj.hostname;
    
    // Ignore internal pages
    if (!hostname || urlStr.startsWith('chrome://') || urlStr.startsWith('chrome-extension://')) return;

    let { sessionFlagged = [], sessionNonFlagged = [] } = await chrome.storage.session.get(['sessionFlagged', 'sessionNonFlagged']);

    // Remove from both lists to deduplicate
    sessionFlagged = sessionFlagged.filter(item => item.hostname !== hostname);
    sessionNonFlagged = sessionNonFlagged.filter(item => item.hostname !== hostname);

    const newItem = {
      url: urlStr,
      hostname: hostname,
      status: result.isSuspicious ? 'flagged' : 'non_flagged',
      riskScore: result.score || 0,
      reason: result.reason,
      timestamp: Date.now()
    };

    if (result.isSuspicious) {
      sessionFlagged.unshift(newItem); // Add to beginning
    } else {
      sessionNonFlagged.unshift(newItem);
    }

    await chrome.storage.session.set({
      sessionFlagged,
      sessionNonFlagged
    });
  } catch (e) {
    console.error('Error updating session lists:', e);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkPageContent') {
    if (sender.tab && sender.tab.url) {
      runPipeline(sender.tab.id, sender.tab.url, request.content);
    }
  } else if (request.action === 'getTabStatus') {
    const key = `tabStatus_${request.tabId}`;
    chrome.storage.session.get([key], (data) => {
      sendResponse(data[key] || null);
    });
    return true; 
  } else if (request.action === 'scanExternalUrl') {
    (async () => {
      try {
        const urlStr = request.url;
        
        // Mock a basic content string for the local model
        const content = urlStr;
        
        // 2. Run Piracy/Clone Check
        const piracyResult = await analyzeForPiracyAndClones(content, urlStr);
        if (piracyResult.isSuspicious) {
          sendResponse(piracyResult);
          return;
        }

        // 3. Run Hybrid Engine (Non-blocking for manual scan, we wait for both to show final result)
        const localResult = await analyzeWithLocalModel(content, urlStr);
        const cloudResult = await checkBackendReputation(urlStr);

        let finalResult = { isSuspicious: false, type: 'safe', reason: "No threat detected. (Confidence: High)" };
        
        if (cloudResult.status === 'error') {
           finalResult = { isSuspicious: true, type: 'warning', reason: cloudResult.reason };
        } else if (cloudResult.status === 'unavailable') {
           // Fallback to local
           finalResult = {
             ...localResult,
             reason: localResult.reason + "\n\nNote: " + cloudResult.reason
           };
        } else if (localResult.isSuspicious && cloudResult.isSuspicious) {
           finalResult = { isSuspicious: true, type: 'danger', reason: `Confirmed Threat! Both local and backend flagged this site: ${cloudResult.reason}` };
        } else if (localResult.isSuspicious) {
           finalResult = localResult;
        } else if (cloudResult.isSuspicious) {
           finalResult = { isSuspicious: true, type: cloudResult.type, reason: cloudResult.reason };
        } else if (cloudResult.status === 'pending') {
           finalResult = { isSuspicious: false, type: 'pending', reason: 'Still analyzing...' };
        }
        
        if (cloudResult.reportUrl) {
           finalResult.reportUrl = cloudResult.reportUrl;
        }

        sendResponse(finalResult);
      } catch(e) {
        sendResponse({ isSuspicious: true, type: 'warning', reason: "Scan failed due to a processing error." });
      }
    })();
    return true;
  }
});

// Re-show banner when a user switches tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.storage.session.get([`tabStatus_${activeInfo.tabId}`], (data) => {
    const status = data[`tabStatus_${activeInfo.tabId}`];
    if (status) {
      setTimeout(() => {
        chrome.tabs.sendMessage(activeInfo.tabId, {
          action: 'showBanner',
          type: status.type || (status.isSuspicious ? 'danger' : 'safe'),
          reason: status.reason
        }).catch(() => {});
      }, 300);
    }
  });
});

// Detect URL changes in Single Page Apps (SPAs)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'requestContentScrape' }).catch(() => {});
    }, 1500);
  }
});
