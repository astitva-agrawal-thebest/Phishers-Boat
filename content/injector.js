let lastScrapeTime = 0;
const DEBOUNCE_MS = 2000;

function scrapeContentAndSend(force = false) {
  const now = Date.now();
  if (!force && now - lastScrapeTime < DEBOUNCE_MS) return;
  lastScrapeTime = now;

  // Extract page text and links
  let textContent = document.body.innerText || "";
  // Get all links, particularly those in forms or pointing outwards
  const links = Array.from(document.querySelectorAll('a[href], form[action]'))
    .map(el => el.href || el.action)
    .filter(url => url && !url.startsWith('javascript:'))
    .slice(0, 20); // Limit to top 20 links to avoid huge payloads

  const payload = {
    action: 'checkPageContent',
    content: `PAGE TEXT:\n${textContent.substring(0, 1000)}\n\nFOUND LINKS:\n${links.join('\n')}`
  };

  try {
    chrome.runtime.sendMessage(payload);
  } catch (error) {
    // This happens if the extension was reloaded/updated but the page wasn't refreshed
    if (error.message.includes('Extension context invalidated')) {
      console.warn('AI Phishing Defense was updated. Please refresh this page to continue scanning.');
    } else {
      console.error('AI Phishing Defense Error:', error);
    }
  }
}

// Listen for direct requests from background (on navigation)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showBanner') {
    injectBanner(request.reason, request.type || 'danger');
  } else if (request.action === 'scanFailed') {
    injectBanner(request.reason, 'warning');
  } else if (request.action === 'requestContentScrape') {
    scrapeContentAndSend(true); // Force bypass debounce on manual request
  }
});

// Setup Targeted SPA Observer for Email Clients (Gmail, Outlook)
const observer = new MutationObserver((mutations) => {
  let shouldScrape = false;
  for (let m of mutations) {
    if (m.addedNodes.length > 0) {
      // Look for Gmail body (.a3s) or Outlook reading pane
      if (m.target.classList && (m.target.classList.contains('a3s') || m.target.classList.contains('ae4') || m.target.getAttribute('aria-label') === 'Message body')) {
        shouldScrape = true;
        break;
      }
    }
  }
  if (shouldScrape) {
    scrapeContentAndSend();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial scrape on load
setTimeout(() => scrapeContentAndSend(), 1000);

function injectBanner(reason, type = 'danger') {
  const existingBanner = document.getElementById('phishing-defender-banner');
  if (existingBanner) {
    existingBanner.remove();
  }
  
  const banner = document.createElement('div');
  banner.id = 'phishing-defender-banner';
  banner.className = `banner-${type}`;
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', type === 'safe' ? 'polite' : 'assertive');
  
  let icon = '';
  let title = '';
  let mascotSvg = '';
  
  if (type === 'danger') {
    icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    title = 'Critical Threat Detected';
    mascotSvg = `<svg class="pixel-mascot" viewBox="0 0 32 32"><rect x="8" y="10" width="16" height="14" fill="#FF3860"/><rect x="10" y="12" width="4" height="4" fill="#fff"/><rect x="18" y="12" width="4" height="4" fill="#fff"/><rect x="12" y="12" width="2" height="2" fill="#000"/><rect x="20" y="12" width="2" height="2" fill="#000"/><rect x="14" y="18" width="4" height="4" fill="#000"/></svg>`; // Alarmed
  } else if (type === 'safe') {
    icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    title = 'Verified Safe';
    mascotSvg = `<svg class="pixel-mascot" viewBox="0 0 32 32"><rect x="8" y="10" width="16" height="14" fill="#39FF6A"/><rect x="10" y="12" width="4" height="4" fill="#fff"/><rect x="18" y="12" width="4" height="4" fill="#fff"/><rect x="12" y="13" width="2" height="2" fill="#000"/><rect x="20" y="13" width="2" height="2" fill="#000"/><rect x="10" y="20" width="12" height="2" fill="#fff"/><rect x="14" y="6" width="4" height="4" fill="#E8ECEF"/><rect x="24" y="14" width="4" height="4" fill="#39FF6A"/><rect x="26" y="10" width="2" height="4" fill="#39FF6A"/></svg>`; // Thumbs up
  } else if (type === 'piracy') {
    icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    title = 'Piracy / Clone Risk';
    mascotSvg = `<svg class="pixel-mascot" viewBox="0 0 32 32"><rect x="8" y="10" width="16" height="14" fill="#FF2E88"/><rect x="10" y="12" width="4" height="4" fill="#fff"/><rect x="18" y="12" width="4" height="4" fill="#fff"/><rect x="12" y="12" width="2" height="2" fill="#000"/><rect x="20" y="12" width="2" height="2" fill="#000"/><rect x="14" y="18" width="4" height="4" fill="#000"/></svg>`; // Alarmed
  } else {
    // Warning / API Error state
    icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    title = 'Scan Failed';
    mascotSvg = `<svg class="pixel-mascot" viewBox="0 0 32 32"><rect x="8" y="10" width="16" height="14" fill="#FFC93C"/><rect x="10" y="12" width="4" height="4" fill="#fff"/><rect x="18" y="12" width="4" height="4" fill="#fff"/><rect x="12" y="14" width="2" height="2" fill="#000"/><rect x="20" y="14" width="2" height="2" fill="#000"/><rect x="14" y="20" width="4" height="2" fill="#000"/></svg>`; // Confused
  }

  // Exact Uniform Layout for ALL states
  banner.innerHTML = `
    <div class="phishing-banner-content">
      <div class="phishing-icon">${icon}</div>
      <div class="phishing-text">
        <strong>${title}</strong>
        <span>${reason}</span>
      </div>
    </div>
    <div class="mascot-container">
      ${mascotSvg}
    </div>
    <button id="phishing-dismiss-btn" aria-label="Dismiss this warning">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  document.body.prepend(banner);
  
  const dismissBtn = document.getElementById('phishing-dismiss-btn');
  dismissBtn.addEventListener('click', () => {
    banner.classList.add('fade-out');
    setTimeout(() => banner.remove(), 400); // Wait for animation
  });
  
  // Auto dismiss for safe banners after 4 seconds
  if (type === 'safe') {
    setTimeout(() => {
      if (document.body.contains(banner)) {
        banner.classList.add('fade-out');
        setTimeout(() => banner.remove(), 400);
      }
    }, 4000);
  } else {
    // Set focus to the banner so keyboard users are aware (only for warnings/dangers)
    banner.setAttribute('tabindex', '-1');
    banner.focus();
  }
}
