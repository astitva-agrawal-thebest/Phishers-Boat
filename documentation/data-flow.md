# Data Flow

## Overview
This document describes how data moves through the AI Phishing Defense system, from initial user interaction to final security decision and feedback.

## Data Flow Principles

### 1. Data Minimization
Only the minimum necessary data is collected and transmitted:
- URL of the page being analyzed
- Text content (first 1000 characters)
- Link URLs (first 20 absolute URLs)
- No cookies, local storage data, or personal information

### 2. Privacy by Design
- Sensitive credentials (API keys) never leave the user's controlled environment
- All analysis can occur locally without external communication
- User data is stored only temporarily in session storage
- Clear separation between data used for analysis and data stored for user functionality

### 3. Security Boundaries
- Content scripts operate in page context with limited privileges
- Background service worker has extension privileges but no direct page access
- Communication occurs via validated message passing
- Backend server validates and sanitizes all inputs
- No direct client-to-third-party communication (except for extension updates via browser store)

## Detailed Data Flows

### 1. Initial Data Collection (Content Script → Background)
```
Web Page Content
         ↓
[Content Script] extractPageData()
         ↓
{
  url: "https://example.com/login",
  textContent: "Username: [input] Password: [input] Submit", // first 1000 chars
  links: [
    "https://example.com/",
    "https://example.com/about",
    "https://malicious-site.com/phish"
  ], // first 20 http/https links
  forms: [  // simplified form detection
    {
      action: "/login",
      method: "POST",
      inputs: [{type: "text", name: "username"}, {type: "password", name: "password"}]
    }
  ]
}
         ↓
POST to background service worker via runtime.sendMessage
{
  action: 'checkPageContent',
  content: "URL: https://example.com/login\n\nPAGE TEXT:\nUsername: [input] Password: [input] Submit\n\nFOUND LINKS:\nhttps://example.com/\nhttps://example.com/about\nhttps://malicious-site.com/phish"
}
```

### 2. Local Analysis Pipeline (Background Internal)
```
Input: Content script data package
         ↓
[Feature Extraction Engine]
         ↓
Extract 30+ features including:
- URL-based: length, special chars, subdomain count, HTTPS presence, IP address usage
- Domain-based: length, character distribution, TLD similarity to brands
- Brand similarity: Levenshtein distance to protected brands (PayPal, Google, etc.)
- Content-based: presence of password forms, urgency keywords, brand mentions in text
- Link-based: ratio of external links, link URL eccentricity, URL encoding abnormalities
         ↓
[Scoring Engine]
         ↓
Apply weights from model_weights.json:
  score = Σ(feature_value × weight)
         ↓
[Threshold Decision]
         ↓
if score > 0.3 → suspicious with reason string
else → clean with confidence score
         ↓
Output: {
  isSuspicious: boolean,
  reason: string,
  score: number,
  type: 'local'
}
```

### 3. Secure Communication to Backend (Background → Backend)
```
When cloud analysis needed:
         ↓
Extract clean URL from content data
         ↓
Prepare request to local backend:
  POST http://localhost:3000/api/url-reputation
  Headers:
    Content-Type: application/json
    x-vt-api-key: [from localStorage - NEVER sent to client]
  Body: { "url": "https://example.com/login" }
         ↓
[Transport Layer Security]
         ↓
HTTPS POST to backend server (localhost in dev, remote in prod)
         ↓
[Backend Processing]
         ↓
1. Validate request format and URL
2. Extract API key from server environment variables (NEVER in request)
3. Encode URL for VirusTotal API v3:
   base64url.encode(url) = base64url.encode("https://example.com/login")
   → "aHR0cHM6Ly9leGFtcGxlLmNvbS9sb2dpbg" (without padding)
4. Make GET request to:
   https://www.virustotal.com/api/v3/urls/aHR0cHM6Ly9leGFtcGxlLmNvbS9sb2dpbg
   Headers: { "x-apikey": [SERVER_SIDE_API_KEY] }
         ↓
[VirusTotal Processing]
         ↓
Returns JSON with:
  - last_analysis_stats: { harmless: 45, malicious: 5, suspicious: 2, ... }
  - last_analysis_date: timestamp
  - ... other metadata
         ↓
[Backend Response Formation]
         ↓
Translate VT results to internal format:
  if (malicious + suspicious >= 2) → status: 'flagged'
  else if (malicious + suspicious == 1) → status: 'caution'
  else if (not found in VT DB) → status: 'safe' (with note)
  else → status: 'safe'
         ↓
Add metadata:
  {
    status: 'flagged'|'caution'|'safe',
    isSuspicious: boolean,
    reason: string from VT analysis,
    reportUrl: URL to VT report,
    virusTotal: { stats: {...}, reportUrl: string }
  }
         ↓
Return to extension via HTTP response
```

### 4. Decision Fusion Logic (Background Internal)
```
Input: 
  Local result: { isSuspicious: bool, reason: string, score: num }
  Cloud result: { status: string, isSuspicious: bool, reason: string, reportUrl?: string }

Process:
  1. Priority 1: Local detection of high-threat patterns
     IF local result indicates typosquatting/clone detector triggered → 
        FINAL: { isSuspicious: true, type: 'danger', reason: local.reason }
  
  2. Priority 2: Cloud consensus of malicious activity  
     ELSE IF cloud.status == 'flagged' →
        FINAL: { isSuspicious: true, type: 'danger', reason: cloud.reason }
  
  3. Priority 3: Mixed signals or single vendor flag
     ELSE IF (local.isSuspicious == true) OR (cloud.status == 'caution') →
        FINAL: { isSuspicious: true, type: 'warning', reason: combined reasons }
  
  4. Default: Both systems agree on safety
     ELSE →
        FINAL: { isSuspicious: false, type: 'safe', reason: "No threats detected" }
        
  5. Special cases:
     - Cloud unavailable → Fall back to local result with degraded notice
     - Cloud error → Treat as unavailable (same as above)
     - Timeout → Same as unavailable
```

### 5. Feedback to User (Background → Content Script/Popup)
```
Decision Result → Background Processor
         ↓
[Update Browser Action]
  IF isSuspicious == true:
    badgeText: '!'
    badgeColor: 
      type == 'danger' → red (#FF3860)
      type == 'warning' → yellow (#FFC93C)
      type == 'piracy' → pink (#FF2E88)
  ELSE:
    badgeText: '✓'
    badgeColor: green (#39FF6A)
         ↓
[Update Popup Dashboard]
  Send message with current statistics and status
         ↓
[Inject/Update Security Banner]
  IF isSuspicious == true:
    Create persistent banner with:
      - Icon based on threat type
      - Title: "Critical Threat Detected" or "Caution Advised"
      - Reason: human-readable explanation
      - Action button: "Details" (opens popup) or "Report" (opens VT report)
      - Auto-dismiss: NEVER for threats
  ELSE:
    Create temporary banner (auto-dismiss after 4s) with:
      - Checkmark icon
      - Title: "All Clear" or "Verified Safe"
      - Reason: brief confirmation
         ↓
[Accessibility Features]
  - ARIA role="alert" for threat banners
  - ARIA live="assertive" for threats, live="polite" for safe
  - Programmatic focus management for keyboard users
  - Sufficient color contrast ratios (≥4.5:1)
```

### 6. User Interaction Feedback Loops
#### A. Manual Scan Request
```
User Input (Popup)
         ↓
Validation: Is this a valid HTTP/HTTPS URL?
         ↓
Same flow as steps 1-5 above but:
  - Input source: popup text field
  - Content: "URL: [user_input]\n\nPAGE TEXT:\n[user_input]\n\nFOUND LINKS:\n[user_input]"
  - No link extraction (single URL only)
         ↓
Result displayed in popup with:
  - Large status indicator
  - Detailed explanation
  - Action buttons: Trust / Block for this session
  - Link to full report (if available)
         ↓
User Action
         ↓
If Trust/Block:
  Update session storage lists
  Update badge if current tab affected
```

#### B. Session List Management
```
User Action (Popup Lists View)
         ↓
Click Trust/Block button on list item
         ↓
Message to background: {action: 'updateSessionList', hostname, action: 'trust'|'block'}
         ↓
Background:
  1. Read session flagged/nON-flagged lists from storage
  2. Move item between lists as requested
  3. Update timestamp and add metadata:
     {
       url: "...",
       hostname: "example.com",
       timestamp: 1609459200000,
       isSuspicious: (action == 'block'),
       type: 'danger'|'safe',
       reason: "User manually marked as safe/threat",
       manual: true
     }
  4. Write updated lists back to session storage
  5. Notify popup to refresh list views
  6. IF current tab matches hostname:
       Re-run assessment and update UI accordingly
```

### 7. Data Storage and Privacy Boundaries
```
[Session Storage] - LIFETIME: Browser session
  - sessionFlagged: [{url, hostname, timestamp, isSuspicious, type, reason, manual: bool}]
  - sessionNonFlagged: [{url, hostname, timestamp, isSuspicious, type, reason, manual: bool}]
  - tabStatus_tabId: {isSuspicious, type, reason, timestamp, reportUrl?}
  - scan_URLhash: {result, timestamp}  // 10-minute TTL cache
  - scannedCount: integer
  - blockedCount: integer

[Local Storage] - LIFETIME: Until explicitly cleared
  - vtApiKey: string  // Never transmitted, only used by backend via messaging
  - theme: 'light'|'dark'|'system'
  - notifications: {banners: boolean, sounds: boolean}
  - version: string  // Track last version used for migration

[NO PERSISTENT STORAGE OF]:
  - Browsing history
  - Page content beyond analysis session
  - Form data or credentials
  - Cookie or local storage data from websites
  - IP address or network information beyond what's in URLs
```

### 8. Cross-Component Data Flow Summary
```
1. User Action → Content Script
   - Navigation, DOM change, manual scan request
   
2. Content Script → Background
   - Page data package (URL + text + links)
   - Manual scan requests
   - UI interaction events (banner clicks)
    banner dismissal
   
3. Background → Content Script
   - Security banner display instructions
   - Badge update requests
   - Tab status queries
   
4. Background → Popup
   - Statistics updates
   - Session list changes
   - Settings change confirmation
   - Scan result returns
   
5. Popup → Background
   - User input (manual scan, settings)
   - Control requests ( toggle lists, clear data)
   - Tab status inquiries
   
6. Background ↔ Backend Server
   - HTTPS POST requests for URL reputation
   - JSON responses with analysis results
   
7. Backend Server ←→ VirusTotal API
   - Authenticated API requests
   - JSON threat intelligence responses
   
8. Storage Systems ←→ All Components
   - Read/write session state
   - Read/write user preferences
   - Read API key (background only, for backend communication)
```

## Data Transformation Examples

### Input → Internal Representation
```
Raw Web Page:
  URL: "https://paypa1.com.signin-security.net/login"
  Contains: form with username/password fields
  Text: "Please verify your PayPal account immediately to avoid suspension"
  Links: 
    - "https://paypa1.com.signin-security.net/login"
    - "https://paypa1.com.signin-security.net/help"
    - "https://www.paypal.com/"  // legitimate link for camouflage

Extracted Data Package:
  URL: "https://paypa1.com.signin-security.net/login"
  Text: "Please verify your PayPal account immediately to avoid suspension..."
  Links: ["https://paypa1.com.signin-security.net/login", ...]

Local Analysis Output:
  {
    isSuspicious: true,
    reason: "TYPO-SQUATTING: Domain 'paypa1.com.signin-security.net' closely resembles 'paypal.com' (distance: 2)",
    score: 0.85,
    type: 'local'
  }

Cloud Analysis Output (from VirusTotal):
  {
    status: 'flagged',
    isSuspicious: true,
    reason: "Phishing site impersonating PayPal (detected by 45/70 engines)",
    reportUrl: "https://www.virustotal.com/gui/url/aHR0cHM6Ly9wYXBwYTEuY29tLnNpZ25pbmctc2VjdXJpdHkubmV0L2xvZ2lu",
    virusTotal: {
      stats: { harmless: 10, malicious: 45, suspicious: 2, undetected: 13 },
      reportUrl: "https://www.virustotal.com/gui/url/aHR0cHM6Ly9wYXBwYTEuY29tLnNpZ25pbmctc2VjdXJpdHkubmV0L2xvZ2lu"
    }
  }

Final Decision:
  {
    isSuspicious: true,
    type: 'danger',
    reason: "TYPO-SQUATTING: Domain 'paypa1.com.signin-security.net' closely resembles 'paypal.com' (distance: 2) + Phishing site impersonating PayPal (detected by 45/70 engines)",
    score: 0.85
  }
```

## Data Retention and Deletion Policies

### Automatic Cleanup
- **Session Storage**: Cleared automatically when browser session ends
- **Analysis Cache** (`scan_*` entries): 10-minute TTL prevents indefinite growth
- **Tab Status**: Removed when tab is closed
- **Statistics**: Reset when browser restarts

### User-Initiated Clearing
- **Clear Session Data**: Removes all sessionStorage entries
- **Clear API Key**: Removes vtApiKey from localStorage (requires re-entry)
- **Reset Statistics**: Sets scannedCount and blockedCount to zero

### Compliance with Privacy Regulations
- **GPDR/CCPA**: No personal data collected beyond what's necessary for security function
- **Right to be Forgotten**: All user-controllable data can be deleted via extension interface
- **Data Portability**: Not applicable as no meaningful personal data profile is created
- **Purpose Limitation**: Data used exclusively for security protection functions
- **Storage Limitation**: Strict TTLs and session-bound storage prevent indefinite retention

## Security Considerations in Data Flow

### Input Validation
- All data received from content scripts validated for type and length
- URLs strictly validated before transmission to backend
- Message schemas verified before processing
- Sanitization of user-displayed content to prevent XSS in extension UI

### Output Encoding
- All user-facing text properly escaped before DOM insertion
- URLs in links attribute-separated to prevent accidental navigation
- HTML content in banner templates strictly controlled

### Transmission Security
- Extension-background communication: Message passing (same-origin, encrypted implicitly)
- Extension-backend communication: HTTPS required with certificate validation
- Backend-VirusTotal communication: HTTPS with certificate pinning recommended
- No sensitive data in URLs (API keys in headers, not query params)

### Incident Containment
- Compromised content script cannot access extension APIs or storage
- Malicious backend cannot access client-side data beyond what's sent in requests
- Stolen API key limited to VirusTotal API usage (can be revoked without endpoint change)
- Browser isolation protects between tabs and from other extensions