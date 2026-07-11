# Architecture

## High-Level System Architecture

AI Phishing Defense follows a hybrid client-server architecture designed to balance real-time protection capabilities with privacy preservation and extensibility.

```
┌─────────────────────────────────────────────────────┐
│                       User                          │
└─────────────┬───────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│            Web Browser (Chrome/Edge/Firefox)        │
│                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────┐ │
│  │  Tab A      │    │  Tab B       │    │ Popup   │ │
│  │ ┌─────────┐ │    │ ┌─────────┐ │    │         │ │
│  │ │Page     │◄───┼─►│Page     │ │    │         │ │
│  │ │Content  │ │    │ │Content  │ │    │         │ │
│  │ │Script   │ │    │ │Script   │ │    │         │ │
│  │ └─────────┘ │    │ └─────────┘ │    │         │ │
│  └─────────────┘    └──────────────┘    └─────────┘ │
│           ▲                      ▲        ▲         │
│           │                      │        │         │
│           ▼                      │        │         │
│  ┌───────────────────────────────────────────────┐ │
│  │        Background Service Worker              │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │  Message Router & Event Handler         │ │ │
│  │  │  ┌───────────────┐ ┌─────────────────┐ │ │ │
│  │  │  │Page Scanner   │ │Popup Communicator│ │ │ │
│  │  │  │(Content Msg)  │ │(UI Events)      │ │ │ │
│  │  │  └───────────────┘ └─────────────────┘ │ │ │
│  │  │  ┌───────────────┐ ┌─────────────────┐ │ │ │
│  │  │  │Threat Analyzer│ │Storage Manager  │ │ │ │
│  │  │  │(Local+Cloud)  │ │(Session/State)  │ │ │ │
│  │  │  └───────────────┘ └─────────────────┘ │ │ │
│  │  │  ┌───────────────┐                     │ │ │
│  │  │  │Reputation     │◄────────────────────┘ │ │ │
│  │  │  │Client         │                       │ │ │
│  │  │  └───────────────┘                       │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│                  Backend Server                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  HTTP Server (Express.js)                   │   │
│  │  ┌───────────────────────────────────────┐ │   │
│  │  │  /api/url-reputation Endpoint         │ │   │
│  │  │  ┌─────────────────────────────────┐ │ │   │
│  │  │  │Request Validator                │ │ │   │
│  │  │  │VT API Proxy                     │ │ │   │
│  │  │  │Response Formatter               │ │ │   │
│  │  │  │Error Handler                    │ │ │   │
│  │  │  └─────────────────────────────────┘ │ │   │
│  │  └───────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│                   VirusTotal API                    │
│  (Multiple Security Engines Aggregation Service)    │
└─────────────────────────────────────────────────────┘
```

## Component Responsibilities

### 1. Web Browser Layer
#### Content Scripts (injector.js)
- Executes in the context of web pages
- Extracts page text content and link URLs
- Implements debouncing to limit resource usage
- Sends collected data to background service worker via message passing
- Handles bidirectional communication for UI banner injection
- Observes DOM changes for Single Page Application (SPA) navigation

#### Popup UI (popup/*)
- Provides user interface for manual controls and statistics
- Manages extension options and settings
- Displays real-time protection metrics
- Handles manual URL and QR code submission
- Controls session-based trust/blocklist management

#### Background Service Worker (background/scanner.js)
- Orchestrates the entire threat analysis pipeline
- Manages state between content scripts, popup, and backend
- Implements the dual-engine analysis workflow:
  1. Local heuristic analysis (immediate)
  2. Asynchronous cloud reputation check
  3. Result fusion and decision making
- Handles message routing between components
- Manages temporary caching of analysis results
- Implements browser action (toolbar icon) updates
- Coordinates session storage operations

### 2. Communication Layer
#### Message Passing System
- Uses Chrome Extension Runtime API for inter-component communication
- Defined message protocols:
  - `checkPageContent`: Content script → Background (page analysis request)
  - `showBanner`: Background → Content script (UI notification)
  - `getTabStatus`: Popup → Background (current tab status query)
  - `scanExternalUrl`: Popup → Background (manual URL scan request)

#### Backend Communication
- HTTPS POST requests to `/api/url-reputation` endpoint
- JSON payload containing URL to analyze
- Authentication via custom header (`x-vt-api-key`)
- Response parsing and error handling with fallback logic
- Timeout management to prevent UI blocking

### 3. Backend Server Layer
#### Express.js Application
- RESTful API endpoint for URL reputation checking
- Environment-based configuration management
- CORS middleware for cross-origin extension requests
- JSON body parsing for incoming requests
- Rate awareness for external API consumption

#### VirusTotal Proxy Service
- Securely stores API key in server environment (never exposed to clients)
- Implements URL encoding per VirusTotal API v3 requirements
- Handles HTTP communication with VirusTotal endpoints
- Transforms API responses to consistent format for extension
- Implements error mapping and retry logic where appropriate
- Provides timing out and fallback mechanisms

### 4. External Services Layer
#### VirusTotal API
- Industry-standard multi-engine threat intelligence platform
- Provides aggregate results from 70+ antivirus and URL scanners
- Offers both file and URL analysis capabilities
- Maintains extensive threat intelligence database
- Updates signatures in near real-time from vendor feeds

## Data Flow Scenarios

### 1. Automatic Page Scan (Default Protection)
```
1. User navigates to new page
2. Content script detects URL change/DOM ready event
3. Content script extracts text and links (debounced)
4. Content script sends `checkPageContent` message to background
5. Background initiates analysis pipeline:
   a. Starts local heuristic analysis (synchronous)
   b. Shows scanning UI state in toolbar/badge
   c. Initiates async cloud reputation check
   d. Waits for both results (with timeout for cloud)
   e. Applies decision fusion logic:
      - If either engine detects threat → threat result
      - If both safe → safe result
      - If conflicting or unclear → caution/pending
   f. Updates toolbar badge
   g. If threat:   → Shows persistent warning banner
   safe:   → Shows temporary safe banner (4s timeout)
   pending:→ Shows scanning banner until completion
6. Background caches result for tab
7. Background updates session statistics
```

### 2. Manual URL Scan (Popup)
```
1. User enters URL in popup search box
2. Popup validates URL format
3. Popup disables button and shows "scanning" state
4. Popup sends `scanExternalUrl` message to background
5. Background processes request similar to step 4 above
6. Background returns result to popup
7. Popup renders detailed result with:
   - Threat level and explanation
   - Vendor breakdown (if available)
   - Action buttons (trust/block for session)
   - Link to full report (if available)
8. Popup re-enables button and resets UI
```

### 3. Session Management Operations
```
1. User clicks trust/block button in popup or banner
2. Popup/bg sends appropriate storage update message
3. Background reads current session lists
4. Background modifies lists (adds/removes domain entry)
5. Background writes updated lists to session storage
6. Background notifies popup to refresh lists view
7. Background updates current tab status if applicable
```

## Technical Design Decisions

### Manifest V3 Adoption
- **Service Workers**: Replaced persistent background pages for efficiency
- **Declarative Net Requests**: Not used as we need dynamic analysis
- **Host Permissions**: Limited to necessary domains (localhost/dev and production backend)
- **Offscreen Documents**: Not utilized as all processing done in workers/service workers

### Storage Strategy
- **Session Storage** (`session`): Temporary trust/blocklists, cleared on browser exit
- **Local Storage** (`local`): Persistent settings (API key, preferences)
- **No IndexedDB**: Simplicity sufficient for current data volumes
- **No Credential Storage**: API keys never stored in extension storage

### Analysis Pipeline Optimization
- **Parallel Execution**: Local and cloud analysis run concurrently
- **Early Termination**: High-confidence local results can short-circuit cloud wait
- **Fallback Logic**: Graceful degradation to local-only when cloud unavailable
- **Result Caching**: Short-term caching (10ms) prevents redundant analysis
- **Timeout Management**: 6-second cloud API timeout prevents hanging UI

### Security Boundaries
- **Content Script Isolation**: No direct access to extension APIs or backend
- **Message Validation**: All incoming messages validate origin and structure
- **Principle of Least Privilege**: Extension requests minimal permissions
- **Backend Hardening**: Server validates and sanitizes all inputs
- **API Key Protection**: Secret never transmitted to or stored in client

## Scalability and Performance Considerations

### Horizontal Scaling
- Backend stateless design enables multiple instances behind load balancer
- External API (VirusTotal) rate limits are primary scaling constraint
- Client-side processing distributes load to user devices

### Caching Strategy
- **L1 Cache**: In-memory tab-scoped results (background worker)
- **L2 Cache**: Short-lived session storage (10ms TTL prevents rapid re-checks)
- **No Persistent Cache**: Avoids privacy concerns of storing browsing history
- **Cache Key**: URL string ensures identical requests hit cache

### Resource Management
- **CPU**: Analysis offloaded to background thread, UI thread unaffected
- **Memory**: Limited to current tab data plus small caches
- **Network**: Single request per unique URL, with aggressive deduplication
- **Battery**: Minimal background activity when no tabs active

## Extensibility Points

### Adding New Analysis Engines
1. Create analyzer module following standard interface (async function returning threat assessment)
2. Integrate into pipeline in background/scanner.js
3. Adjust fusion logic in `finalizeVerdict` function
4. Update UI components to display new threat types if needed

### Alternative Reputation Services
1. Replace `reputationClient.js` implementation
2. Maintain same input/output interface contract
3. Update configuration mechanism (environment variables)
4. Adjust error mapping and timeout values as needed

### UI Customization
1. Modify popup/Popup.css for theme changes
2. Update injector.css for banner appearance changes
3. Adjust popup/popup.js for new feature controls
4. Extend message protocol for new UI interactions

### Internationalization
1. Extract all UI strings to message.json format
2. Implement language detection and loading mechanism
3. Update build process to include locale files
4. Modify UI components to use localized strings

## Deployment Architecture Options

### Development/Local Testing
```
User Browser ↔ localhost:3000 (backend)
```
- Backend runs locally with `npm start`
- Extension loads unpacked from source directory
- Ideal for iterative development and testing

### Production Deployment
```
User Browser → [CDN/Edge] → Backend Farm → VirusTotal API
```
- Backend deployed to scalable hosting (AWS, Azure, GCP, Heroku, etc.)
- Environment variables manage configuration per deployment
- Extension points to production backend URL
- Monitoring and alerting integrated with hosting platform

### Enterprise Deployment
```
User Browser → Corporate Proxy → Enterprise Backend → VirusTotal API
```
- Backend deployed behind corporate firewall
- Authentication integrated with enterprise SSO
- Logging forwarded to SIEM solutions
- Custom threat intelligence feeds incorporated
- Group Policy controls extension deployment and configuration