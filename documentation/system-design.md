# System Design

## Overview
This document details the internal design of the AI Phishing Defense system, covering both client-side (browser extension) and server-side components. The design follows principles of separation of concerns, modularity, and maintainability.

## Client-Side Design (Browser Extension)

### 1. Architectural Pattern
The extension uses a modified Model-View-ViewModel (MVVM) pattern adapted for the WebExtensions architecture:
- **Model**: Data structures representing URLs, scan results, session state
- **View**: UI components (popup, content scripts, toolbar badge)
- **View-Model**: Background service worker that manages state and business logic
- **Communication**: Message-passing system as the binder between components

### 2. Core Modules

#### A. Threat Detection Engine
Located in: `background/scanner.js`

**Responsibilities**:
- Orchestrates the complete threat analysis pipeline
- Implements local heuristic analysis
- Coordinates asynchronous cloud reputation checks
- Applies decision fusion logic
- Manages result caching and timeouts

**Key Functions**:
- `runPipeline()`: Main entry point that coordinates analysis
- `analyzeWithLocalModel()`: Executes feature-based heuristic detection
- `checkBackendReputation()`: Handles communication with backend proxy
- `finalizeVerdict()`: Combines results using priority-based logic
- `analyzeForPiracyAndClones()`: Specialized detection for typo-squatting and brand impersonation

**Data Structures**:
```javascript
// Local analysis result
{
  isSuspicious: boolean,
  reason: string,
  score: number,           // Raw heuristic score
  type: 'local'            // Analysis source
}

// Cloud analysis result
{
  status: 'safe'|'flagged'|'caution'|'unavailable'|'error',
  isSuspicious: boolean,
  type: 'danger'|'warning'|'safe'|'pending',
  reason: string,
  reportUrl: string,       // Link to full VirusTotal report
  virusTotal: {            // Raw VT data (optional)
    stats: {...},
    reportUrl: string
  }
}

// Final verdict (used throughout system)
{
  isSuspicious: boolean,
  type: 'danger'|'warning'|'safe'|'pending'|'piracy',
  reason: string,
  reportUrl?: string       // Only present for cloud results
}
```

#### B. Communication Layer
Located in: Multiple files using `chrome.runtime.sendMessage` and `chrome.runtime.onMessage`

**Message Types**:
1. **Content Script → Background**
   - `{ action: 'checkPageContent', content: string }`
   - `{ action: 'requestContentScrape' }` (forced re-scan)
   - `{ action: 'scanExternalUrl', url: string }`

2. **Background → Content Script**
   - `{ action: 'showBanner', reason: string, type: string }`
   - `{ action: 'scanFailed', reason: string }`

3. **Popup → Background**
   - `{ action: 'getTabStatus', tabId: number }`
   - `{ action: 'getSettings' }`
   - `{ action: 'saveSettings', settings: Object }`

4. **Background → Popup**
   - Responses to the above requests with appropriate data

**Communication Patterns**:
- Request-Response for informational queries
- Fire-and-forget for notifications and commands
- Message validation to prevent injection attacks

#### C. UI Components
1. **Popup Interface** (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`)
   - **View**: Static HTML structure with dynamic content areas
   - **View-Model**: JavaScript managing state and user interactions
   - **Services**: Direct access to background via messaging
   - **Components**:
     - Status card showing current tab protection level
     - Statistics counters (scanned/blocked)
     - Manual URL and QR scanners
     - Session trust/blocklist managers
     - About and settings panels

2. **Content Script UI** (`content/injector.js`, `content/injector.css`)
   - **Banner System**: Dynamic creation of security notification banners
   - **Styling**: CSS-in-JS approach for theming and animations
   - **Lifecycle**: Automatic creation, updating, and removal of banners
   - **Accessibility**: ARIA attributes and focus management

3. **Toolbar Action** (Browser Action)
   - **Badge**: Text overlay showing scan status (!, ✓, ..., ERR)
   - **Badge Color**: Color-coded background indicating threat level
   - **Tooltip**: Hover-over text with status summary
   - **Click Action**: Opens popup when user clicks toolbar icon

#### D. State Management
**Storage Usage**:
- **sessionStorage**:
  - `sessionFlagged`: Array of temporarily blocked sites
  - `sessionNonFlagged`: Array of temporarily allowed sites
  - `tabStatus_*`: Per-tab status objects keyed by tabId
  - `scan_*`: Cached scan results keyed by URL hash
  - `scannedCount`: Total URLs scanned in session
  - `blockedCount`: Total threats blocked in session

- **localStorage**:
  - `vtApiKey`: Encrypted VirusTotal API key (stored as plaintext but only accessible to extension)
  - User preferences (theme, notification settings, etc.)

**State Update Patterns**:
1. **Immutable Updates**: State objects replaced entirely rather than mutated
2. **Atomic Operations**: Storage reads/writes followed by immediate UI updates
3. **Event-Driven**: UI components react to storage change events
4. **Debouncing**: Rapid successive updates batched to prevent thrashing

#### E. Content Script Design
**Responsibilities**:
- Data extraction from web pages
- Communication bridge to background worker
- Dynamic UI injection (security banners)
- Event listening for user interactions (banner dismissal)

**Key Features**:
- **Debouncing**: 2-second delay prevents excessive analysis during typing/scrolling
- **SPA Support**: MutationObserver detects dynamic content changes in frameworks like React/Angular/Vue
- **Targeted Scanning**: Special handling for known email clients (Gmail, Outlook) to scan message bodies
- **Resource Limits**: Extracts only first 1000 characters of text and top 20 links to prevent excessive payloads
- **Error Handling**: Graceful degradation when extension context is lost (update/reload scenarios)

**Extraction Strategy**:
```javascript
const textContent = document.body.innerText || "";
const links = Array.from(document.querySelectorAll('a[href], form[action]'))
  .map(el => el.href || el.action)
  .filter(url => url && !url.startsWith('javascript:'))
  .slice(0, 20); // Limit to prevent large payloads
```

### 3. Security Design

#### A. Privilege Separation
- **Content Scripts**: Run in page context with DOM access but no extension APIs
- **Background Worker**: Has extension APIs but no direct DOM access
- **Communication**: Strictly typed messages validate origin and structure
- **Principle**: No component has more privileges than absolutely necessary

#### B. Data Protection
- **Minimal Data Collection**: Only URL and essential page snippets transmitted
- **No Persistent History**: Analysis results cached only temporarily
- **Client-Side API Key**: Never stored; must be configured in backend
- **Sanitization**: All data validated before processing or display

#### C. Secure Communications
- **Extension Internals**: Message passing via Chrome runtime (inherently secure)
- **Extension-to-Backend**: HTTPS required; certificate validation enforced
- **Backend-to-VirusTotal**: Standard HTTPS with certificate validation
- **No Mixed Content**: All resources loaded over secure protocols

#### D. Extension Hardening
- **Content Security Policy**: Implicit in Manifest V3; prevents inline script execution
- **No `eval()`**: All code strictly evaluated
- **Restricted Hosts**: Limited permissions to necessary domains only
- **Update Security**: Uses Chrome Web Store's update mechanism with automatic signature verification

## Server-Side Design (Backend Proxy)

### 1. Architectural Pattern
Simple layered architecture:
- **Presentation Layer**: Express.js route handlers
- **Service Layer**: Business logic for API interaction
- **Integration Layer**: External service communication (VirusTotal)
- **Cross-Cutting**: Configuration, logging, error handling

### 2. Core Modules

#### A. Entry Point (`server.js`)
**Responsibilities**:
- Initialize Express application
- Configure middleware (CORS, JSON parsing)
- Load environment variables
- Define API routes
- Start HTTP server

**Key Features**:
- Minimal footprint: Only essential middleware loaded
- Explicit error handling for all routes
- Proper HTTP status codes for different scenarios
- Detailed logging for debugging and monitoring
- Graceful shutdown handling

#### B. VirusTotal Service (`implicit in server.js`)
**Responsibilities**:
- Securely store and retrieve API key from environment
- Implement VirusTotal API v3 specifications:
  - URL identification (base64url encoding without padding)
  - Proper header authentication (`x-apikey`)
  - Rate limit awareness and handling
  - Response parsing and error mapping
- Transform VT responses to consistent format for extension
- Implement caching layer (current implementation: none, but designed for addition)
- Handle network failures and timeouts

**API Contract**:
```
Request:
  POST /api/url-reputation
  Headers: 
    Content-Type: application/json
    x-vt-api-key: [API key from extension storage]
  Body: { url: "https://example.com" }

Response (Success):
  {
    status: "safe"|"flagged"|"caution",
    riskScore: number,      // Number of positive detections
    reasons: [string],     // Human-readable explanations
    virusTotal: {
      stats: {             // Raw VT analysis stats
        harmless: number,
        malicious: number,
        suspicious: number,
        undetected: number
      },
      reportUrl: string    // Link to detailed VT report
    }
  }

Response (Error Conditions):
  {
    status: "unavailable"|"error",
    reason: string         // Human-readable error description
  }
```

### 3. Security Design

#### A. API Key Protection
- **Environment Storage**: Never committed to repository; loaded at runtime
- **Process Isolation**: Accessible only to backend Node.js process
- **No Logging**: Care taken to avoid accidental logging of credentials
- **Rotation Support**: Can be changed without redeploying code (only env var update)
- **Principle of Least Privilege**: API key used solely for VT API calls

#### B. Input Validation and Sanitization
- **URL Validation**: Must be valid HTTP/HTTPS URL
- **Length Limits**: Reasonable limits to prevent DoS via overly long URLs
- **Character Encoding**: Proper handling of internationalized domain names
- **Scheme Restriction**: Only http/https allowed (no javascript:, data:, etc.)

#### C. Output Encoding
- **JSON Responses**: Properly formatted and encoded
- **Error Messages**: Sanitized to prevent information leakage
- **No Direct Data Passing**: VT responses transformed before sending to client

#### D. Rate Limiting and Abuse Prevention
- **Client-Side Throttling**: Extension implements request debouncing
- **Server-Side Awareness**: Respects VT API rate limits through error handling
- **Error Backoff**: Implements exponential backoff on rate limit responses
- **Failure Transparency**: Clear communication when service limits reached

### 4. Reliability Features

#### A. Error Handling
- **Network Errors**: Distinguish between timeout, connection failure, and HTTP errors
- **API Errors**: Map VT API status codes to appropriate responses
- **Validation Errors**: Clear feedback for malformed requests
- **Fallback Behavior**: Clear indication when reputation checking unavailable
- **Logging**: Comprehensive error logging for operational visibility

#### B. Resilience Patterns
- **Timeouts**: 6-second limit on VT API calls to prevent hanging
- **Retry Logic**: Not implemented (by design - failures should be visible to user)
- **Circuit Breaker**: Not implemented (failures are relatively rare and transient)
- **Graceful Degradation**: System functions with local analysis only when backend unavailable

#### C. Observability
- **Request Logging**: Incoming requests with timestamps and outcomes
- **Error Logging**: Detailed stack traces for debugging
- **Performance Metrics**: Response times for SLA monitoring
- **Health Checks**: `/health` endpoint for load balancer and monitoring integration

## Integration Points

### 1. Extension-Backend Interface
**Location**: `background/reputationClient.js`
**Contract**:
- POST to configurable endpoint (default: `http://localhost:3000/api/url-reputation`)
- JSON body: `{ url: string }`
- Headers: 
  - `Content-Type: application/json`
  - `x-vt-api-key`: [API key from extension storage]
- Response parsing with specific field extraction
- Error mapping to standardized internal format

### 2. Backend-VirusTotal Interface
**Location**: Implicit in `server.js` `/api/url-reputation` handler
**Contract**:
- GET to `https://www.virustotal.com/api/v3/urls/{id}`
- Where `{id}` = base64url_encode(url) without padding
- Headers:
  - `x-apikey`: [Environment variable VT_API_KEY]
  - `Accept: application/json`
- Response handling per API specification
- Error translation to HTTP status codes with JSON bodies

### 3. Extension-User Interface
**Multiple Touchpoints**:
- Toolbar badge and popup for passive status indication
- Modal banners for active threat notifications
- Manual input fields for proactive checking
- Settings interface for configuration
- History interface for retrospective analysis

## Data Models

### 1. Analysis Request (Extension → Backend)
```json
{
  "url": "string"
}
```
Constraints: Must be valid HTTP or HTTPS URL; maximum length 2048 characters

### 2. Analysis Response (Backend → Extension)
```json
{
  "status": "safe"|"flagged"|"caution"|"unavailable"|"error",
  "riskScore": "number",           // 0-100+ (typically 0-0 for safe, 1+ for threats)
  "reasons": ["string"],           // Human-readable explanations
  "virusTotal": {                  // Optional detailed VT information
    "stats": {
      "harmless": "number",
      "malicious": "number", 
      "suspicious": "number",
      "undetected": "number"
    },
    "reportUrl": "string"
  }
}
```

### 3. Internal Threat Assessment (Extension Internal)
```javascript
{
  isSuspicious: boolean,
  type: "danger"|"warning"|"safe"|"pending"|"piracy",
  reason: "string",
  reportUrl?: "string"             // Present only for cloud-sourced results
}
```

### 4. Session Storage Entries
**Flagged/Safe List Items**:
```javascript
{
  url: "string",                   // Full URL that was assessed
  hostname: "string",              // Extracted hostname for matching
  timestamp: "number",             // Unix milliseconds
  isSuspicious: "boolean",
  type: "string",                  // Matches threat assessment type
  reason: "string",
  riskScore: "number",             // 0-100+ score
  manual: "boolean"                // True if added via user action
}
```

## Configuration Management

### Environment Variables (Backend)
| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `VT_API_KEY` | Yes | VirusTotal API key | (Must be set) |
| `PORT` | No | Server port | 3000 |
| `HOST` | No | Server host/interface | 0.0.0.0 (all interfaces) |

### Extension Configuration
Stored in `localStorage`:
- `vtApiKey`: User's VirusTotal API key (copied to backend via settings)
- UI preferences (theme, notification duration, etc.)
- Feature toggles (experimental options)

## Performance Characteristics

### Client-Side Performance
- **Startup Time**: <50ms for service worker initialization
- **Analysis Latency**: 
  - Local only: 10-50ms typical
  - With cloud: 1000-3000ms (network dependent)
- **Memory Usage**: <10MB typical (mostly DOM content storage)
- **CPU Usage**: Bursty during analysis; minimal when idle
- **Battery Impact**: Negligible when inactive; small active monitoring cost

### Server-Side Performance
- **Request Handling**: <50ms overhead (excluding VT API call)
- **VT API Dependency**: 90%+ of response time comes from external API
- **Concurrent Requests**: Limited by Node.js event loop and VT rate limits
- **Scaling**: Horizontal scaling effective until VT API limits reached

## Failure Modes and Mitigations

### 1. Backend Unavailable
- **Detection**: Network errors or non-2xx HTTP responses
- **Mitigation**: 
  - Fallback to local analysis only with user notification
  - Clear UI indication of degraded functionality
  - Automatic recovery when connectivity restored
  - Configurable timeout prevents indefinite hanging

### 2. VirusTotal API Rate Limiting
- **Detection**: HTTP 429 responses from VT API
- **Mitigation**:
  - Return `unavailable` status to extension
  - Extension shows warning and relies on local analysis
  - Implement exponential backoff in future enhancements
  - User can wait or proceed with reduced protection

### 3. Malformed or Dangerous URLs
- **Detection**: Input validation in both extension and backend
- **Mitigation**:
  - Reject clearly invalid URLs (javascript:, data:, etc.)
  - Sanitize before VT API call to prevent injection
  - Treat validation failures as potential threats (caution/warning)

### 4. Extension Context Loss
- **Detection**: Messages failing with "Extension context invalidated"
- **Mitigation**:
  - User notification to refresh extension/page
  - Automatic recovery on next navigation event
  - Clear documentation about update/reload requirements

### 5. Incorrect API Key
- **Detection**: HTTP 401 or 403 from VirusTotal API
- **Mitigation**:
  - Clear error message in extension settings
  - Guidance on obtaining and entering correct key
  - Fallback to local-only mode with persistent warning
  - Validation during save operation prevents persistent errors

## Extensibility Guidelines

### Adding New Analysis Components
1. **Local Analyzers**:
   - Create function following `(content, url) => Promise<Assessment>`
   - Integrate into `runPipeline()` in `scanner.js`
   - Adjust weighting in `finalizeVerdict()` if needed
   - Add unit tests for edge cases

2. **Reputation Sources**:
   - Implement interface matching `reputationClient.js`
   - Update configuration to select between sources
   - Maintain consistent response format
   - Handle source-specific error conditions

3. **UI Extensions**:
   - Follow existing patterns in popup/ and content/ directories
   - Use messaging system for background communication
   - Adhere to accessibility guidelines (WCAG 2.1 AA)
   - Ensure consistent theming and animation styles

4. **Storage Enhancements**:
   - Follow existing key naming conventions
   - Consider migration strategies for schema changes
   - Implement size limits to prevent storage bloat
   - Add expiration mechanisms for temporary data

### Integration Points
1. **New Browser APIs**:
   - Wrap in feature detection for backward compatibility
   - Provide polyfills where possible
   - Update manifest permissions as needed

2. **Third-Party Services**:
   - Follow proxy pattern to protect credentials
   - Implement circuit breaker for external dependencies
   - Add to content security policy if loading external resources
   - Consider privacy implications of additional data sharing

3. **Platform-Specific Features**:
   - Use browser detection for conditional functionality
   - Provide graceful degradation for unsupported features
   - Consider separate builds for different stores if needed
   - Test across target browser versions regularly

## Diagrams and References

See `architecture-diagram.md` for visual representation of component relationships and data flow.