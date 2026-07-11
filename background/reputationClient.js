// background/reputationClient.js
const BACKEND_URL = 'http://localhost:3000/api/url-reputation'; // Configurable URL
const CLIENT_TIMEOUT_MS = 6000;

async function checkBackendReputation(urlStr) {
  try {
    const data = await chrome.storage.local.get(['vtApiKey']);
    const secret = data.vtApiKey || '';

    if (!secret) {
      return { status: 'error', isSuspicious: true, type: 'warning', reason: 'Missing VirusTotal API Key. Please add it in settings.' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (secret) {
      headers['x-vt-api-key'] = secret;
    }

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ url: urlStr }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Backend responded with status ${response.status}`);
      if (response.status === 401) {
         return { status: 'error', isSuspicious: true, type: 'warning', reason: 'Missing VirusTotal API Key. Please add it in settings.' };
      }
      return { status: 'unavailable', isSuspicious: false, type: 'warning', reason: 'Reputation check unavailable — showing local analysis only.' };
    }

    const json = await response.json();
    
    let isSuspicious = false;
    let type = 'safe';
    let reason = 'No immediate threat detected.';
    let reportUrl = null;

    if (json.virusTotal && json.virusTotal.reportUrl) {
      reportUrl = json.virusTotal.reportUrl;
    }

    if (json.status === 'flagged') {
      isSuspicious = true;
      type = 'danger';
      reason = json.reasons ? json.reasons.join(' ') : 'Flagged by backend reputation engine.';
    } else if (json.status === 'caution') {
      isSuspicious = true; // Caution implies suspiciousness
      type = 'warning';
      reason = json.reasons ? json.reasons.join(' ') : 'Caution advised by backend reputation engine.';
    } else if (json.status === 'safe') {
      isSuspicious = false;
      type = 'safe';
      reason = 'No immediate threat detected.';
    } else if (json.status === 'pending') {
      isSuspicious = false;
      type = 'pending';
      reason = 'Still analyzing...';
    }

    return { 
      status: json.status || 'safe', 
      isSuspicious, 
      type, 
      reason,
      reportUrl
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Backend reputation check timed out.');
    } else {
      console.error('Backend reputation check failed:', error);
    }
    return { status: 'unavailable', isSuspicious: false, type: 'warning', reason: 'Reputation check unavailable — showing local analysis only.' };
  }
}
