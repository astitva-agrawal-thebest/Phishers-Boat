# State Management

## Overview
State management in the AI Phishing Defense system is designed to be minimal, privacy-preserving, and efficient. The client-side (browser extension) uses browser storage mechanisms for temporary and persistent state, while the server-side maintains only in-memory state for request processing. No persistent database is used on either side, enhancing privacy and simplifying deployment.

## Core Principles

### Data Minimization
- Only essential state is stored
- No persistent histories or profiles created
- Data retained only as long as necessary for function

### User Control
- Users can inspect, modify, and clear all stored data
- Transparent storage mechanisms with clear purposes
- Data portability and deletion capabilities

### Security Isolation
- Storage areas isolated by browser origin policy
- No cross-site access to extension storage
- Sensitive data (API keys) accessible only to extension itself

### Performance Optimization
- Efficient storage mechanisms for frequent access
- Caching strategies to reduce redundant work
- Minimal I/O operations for responsiveness

## Client-Side State Management (Extension)

The extension uses two primary storage mechanisms provided by the WebExtensions API:

### 1. Session Storage (`chrome.storage.session`)
**Lifetime**: Cleared when the browser session ends (when the last tab of the browser profile is closed). Survives individual tab/window closures but not full browser quit.

**Purpose**: Temporary state that should not persist beyond a browsing session, including:
- User-made trust/blocklist decisions during current browsing session
- Per-tab status caching for immediate reuse
- Short-term URL scan result caching to prevent re-analysis
- Session-level statistics (scanned count, blocked count)

**Data Structure**:
```javascript
// All keys are strings; values are JSON-serializable objects

// User trust/blocklist decisions for current session
sessionFlagged: [
  {
    url: "https://example.com/fake-login",        // Full URL that was assessed
    hostname: "example.com",                      // Extracted hostname for matching
    timestamp: 1609459200000,                     // Unix milliseconds when assessed
    isSuspicious: true,                           // Result of assessment
    type: "danger",                               // danger|warning|safe|pending|piracy
    reason: "TYPO-SQUATTING: Domain closely resembles trusted brand",
    manual: true                                  // Set to true for user-initiated actions
  }
  // ... more entries
],

sessionNonFlagged: [
  {
    url: "https://legitimate-site.com/",
    hostname: "legitimate-site.com",
    timestamp: 1609459200000,
    isSuspicious: false,
    type: "safe",
    reason: "No threats detected by local or cloud analysis",
    manual: true
  }
  // ... more entries
],

// Per-tab status for UI updates (toolbar badge, popup display)
tabStatus_<tabId>: {
  isSuspicious: boolean,
  type: "danger"|"warning"|"safe"|"pending"|"piracy",
  reason: string,
  timestamp: number,           // When this status was last updated
  reportUrl?: string           // Present only for cloud-sourced dangerous results
},

// URL scan result cache (prevents re-analysis of same URL within time window)
scan_<urlHash>: {
  result: {
    // Full assessment result as returned by finalizeVerdict()
    isSuspicious: boolean,
    type: string,
    reason: string,
    score?: number,
    reportUrl?: string
  },
  timestamp: number          // Unix milliseconds when cached
  // TTL: 10 minutes (600000ms) - prevents stale results while allowing re-check
},

// Session statistics
scannedCount: number,        // Total URLs analyzed in this browser session
blockedCount: number         // Total threats blocked (where action would be taken)
```

**Access Patterns**:
- **Frequent Reads**: 
  - `tabStatus_*` on tab activation/update
  - `scan_*` during URL analysis (cache check)
  - `sessionFlagged`/`sessionNonFlagged` when rendering lists in popup
- **Frequent Writes**: 
  - `tabStatus_*` on每次 analysis completion
  - `scan_*` after new analysis
  - `scatteredCount`/`blockedCount` increment after each analysis
  - `sessionFlagged`/`sessionNonFlagged` on user trust/block actions
- **Bulk Operations**: 
  - Clear all session data (user-initiated "Clear Session Data")
  - Migration on extension update (rare)

**Size Limits**: 
- Chrome session storage limit: ~10MB per extension
- Practical usage: Typically <100KB even with heavy usage
- Eviction: Oldest entries trimmed when limit approached (LRU-ish)

### 2. Local Storage (`chrome.storage.local`)
**Lifetime**: Persists until explicitly cleared by user, extension update, or browser data clearing. Survives browser restarts and sessions.

**Purpose**: Persistent user preferences and configuration that should survive browser restarts, including:
- VirusTotal API key (entry point for backend authentication)
- User interface preferences (theme, notification settings)
- Extension version tracking for migration notices
- Any user-configurable options

**Data Structure**:
```javascript
// Keys are strings; values are JSON-serializable

vtApiKey: string,              // User's VirusTotal API key (set via settings)
// Stored as plaintext but protected by browser origin isolation
// Never transmitted to third parties; only sent to user's own backend

theme: "light"|"dark"|"system", // Preferred UI theme
// Affects popup.css and potentially content injector.css
// "system" follows OS/browser prefers-color-scheme setting

notifications: {
  banners: boolean,           // Show/hide security banners
  sounds: boolean             // Play audio alerts (if implemented)
  // Future: voice alerts, desktop notifications level
},

version: string,              // Last version string user interacted with
// Used to show "what's new" notifications after updates
// Compared against manifest.json version on extension update

// Potential future keys:
// analyticsOptIn: boolean
// experimentalFeatures: {featureName: boolean}
// ruleSets: {name: {enabled: boolean, lastUpdated: timestamp}}
```

**Access Patterns**:
- **Infrequent Reads**: 
  - On extension startup (read all settings)
  - Before displaying popup (read theme, notifications)
  - Before backend communication (read vtApiKey)
- **Infrequent Writes**: 
  - When user changes settings in popup
  - On extension update (update version field)
  - Rarely: when user clears API key
- **Minimal I/O**: 
  - Designed for few writes, many reads
  - Browser optimizes storage for this pattern

**Size Limits**: 
- Chrome local storage limit: ~5MB per extension
- Usage: Typically <1KB (few small strings and objects)
- No practical concerns for current usage

### 3. In-Memory State (Background Service Worker)
Beyond storage, the background worker maintains transient state in JavaScript variables:

#### Runtime Variables
- **Message Ports**: 
  - Connections to popup and content scripts (managed via runtime API)
- **Timers**: 
  - Debounce timers for analysis requests (200ms typical)
  - Animation frame requests for UI updates
- **Caches**: 
  - In-memory duplicates of frequently accessed storage values
  - Example: Currently loaded `vtApiKey` to avoid storage reads on every request
  - Short-lived URL dedup caches (different from session storage cache)
- **State Machines**: 
  - Tab status tracking (processing, idle, error states)
  - Analysis pipeline stages (local-started, cloud-requested, complete)

**Characteristics**:
- **Volatile**: Lost when service worker terminates (after idle period)
- **Fast Access**: Microsecond-level read/write
- **Automatic Cleanup**: Garbage collected when no longer referenced
- **No Persistence**: Intentional; state rebuilt from storage on wake

### State Synchronization Patterns
The extension follows these patterns to keep storage and memory consistent:

#### Read-Modify-Write Cycle
For updating storage objects (arrays or objects):
1. **Read**: `chrome.storage.session.get(['sessionFlagged'], callback)`
2. **Modify**: 
   - Create new array/object (immutable update pattern)
   - Push new item, filter, splice, etc.
   - Never mutate retrieved object directly
3. **Write**: 
   - `chrome.storage.session.set({sessionFlagged: newArray}, callback)`
   - Optionally chain reads/writes for related updates

**Example: Adding a trusted site**
```javascript
chrome.storage.session.get(['sessionNonFlagged'], (result) => {
  const newList = [...(result.sessionNonFlagged || []), {
    url: userProvidedUrl,
    hostname: new URL(userProvidedUrl).hostname,
    timestamp: Date.now(),
    isSuspicious: false,
    type: 'safe',
    reason: 'User manually marked as safe',
    manual: true
  }];
  
  chrome.storage.session.set({sessionNonFlagged: newList}, () => {
    // Optional: refresh UI or notify success
  });
});
```

#### Event-Driven Updates
- **storage.onChanged**: 
  - Listens for changes to storage (from other contexts: other tabs, popup)
  - Triggers UI updates when state changes externally
- **Message Passing**: 
  - Coordinates immediate requests state changes from other contexts
  - Avoids direct storage manipulation from multiple sources
- **Atomic Operations**: 
  - Where possible, combine related updates in single storage.set call
  - Prevents intermediate inconsistent states

### Storage-Specific Considerations

#### Session Storage Volatility
- **Tab Closure**: 
  - Does NOT clear session storage (only when last tab closes)
  - Aligns with user expectation: closing tab doesn't lose session decisions
- **Window Closure**: 
  - Same as tab closure; session persists until last window/tab
- **Browser Quit**: 
  - Clears all session storage (final cleanup)
- **Crash Recovery**: 
  - Depends on browser implementation; typically not restored
  - Considered acceptable loss for temporary decisions

#### Local Storage Persistence
- **Extension Updates**: 
  - Survives unaffected; version field helps with migrations
  - Developers should handle schema changes gracefully
- **Browser Data Clear**: 
  - Removed if user selects "Cookies and other site data" 
  - (Chrome treats extension storage as site data for clearing)
- **Profile Migration**: 
  - Not automatically transferred; requires manual backup/restore
  - Considered acceptable for configuration data
- **Sync Considerations**: 
  - If user enables browser sync, storage MAY be synchronized
  - Currently not designed for sync conflict resolution
  - Recommendation: Disable sync for extension data if concerned

#### Storage Size Management
- **Monitoring**: 
  - Extension could monitor usage and warn if approaching limits
  - Currently not implemented; expected usage well below limits
- **Eviction Policies**: 
  - Browser-implemented (typically LRU when limit reached)
  - Application should not rely on specific eviction behavior
- **Growth Prevention**: 
  - Implement TTLs on cached data (e.g., scan_* entries)
  - Limit array lengths (e.g., keep last 100 trust/blocklist decisions)
  - Aggregating statistics instead of storing individual events

### State Initialization and Recovery
#### On Extension Startup/Background Worker Start
1. **Read Local Storage**: 
   - Load `vtApiKey`, `theme`, `notifications`, `version`
   - Apply settings to UI and behavior
   - Check version for migration needs
2. **Establish Baseline State**: 
   - No session storage assumed (may be empty)
   - Prepare to build session state from scratch
3. **Register Listeners**: 
   - `storage.onChanged` for cross-context updates
   - `runtime.onMessage` for incoming requests
   - `tabs.onActivated`/`tabs.onUpdated` for tab state management
4. **Prepare for First Requests**: 
   - Reset in-memory caches
   - Ready to process messages

#### Handling Storage Errors
- **Quota Exceeded**: 
  - Rare; would manifest as storage.set() failures
  - Mitigation: Implement fallback to in-memory only with degraded notice
  - User notification: "Storage full; some features may be limited"
- **Storage Unavailable**: 
  - Extremely rare; would indicate browser profile corruption
  - Fallback: Disable persistence-dependent features
  - User notification: "Unable to access storage; using temporary mode"
- **Corrupt Data**: 
  - Validate JSON on read; discard and reset if invalid
  - Version check to detect format incompatibility
  - Fallback to defaults with user notification if needed

## Server-Side State Management (Backend)

The backend server intentionally maintains minimal state to preserve scalability and fault tolerance.

### In-Memory State Only
**Lifetime**: Process lifetime (until Node.js process exits)
**Purpose**: 
- Request processing variables
- Middleware state (limited to request lifetime)
- Runtime metrics and counters (optional)
- Temporary caching considerations (not implemented in current version)

**Examples**:
- **Request Object**: 
  - Method, URL, headers, body (exists only during request handling)
- **Response Object**: 
  - Used to construct and send response
- **Middleware Instances**: 
  - Created once at startup; stateless between requests
- **Routing Table**: 
  - Built at startup; immutable during runtime
- **External Service Clients**: 
  - Instances like fetch; connection pooling handled internally
- **Metrics Counters**: 
  - Incremental counters for requests, errors, latencies (optional)
  - Stored in module-level variables; reset on process restart

### Absence of Persistent Storage
- **No Database Connections**: 
  - No connection pools, ORMs, or query builders
- **No File System Storage**: 
  - No log files written by default (rely on external logging)
  - No upload directories or temporary file storage
  - Exception: May read static files at startup (HTML templates, etc.)
- **No In-Memory Caching**: 
  - Current implementation does not cache VirusTotal responses
  - Each request results in a fresh VT API call (deliberate for freshness)
  - Future caching would be implemented as optional layer with TTL

### State Initialization
At server startup (`server.js`):
1. **Load Environment Variables**: 
   - `process.env.VT_API_KEY`, `process.env.PORT`, `process.env.HOST`
   - Validate required variables present
2. **Initialize Express App**: 
   - Apply middleware (cors, body-parser)
   - Define routes
   - Set up error handlers
3. **Prepare External Service Clients**: 
   - Configure fetch/polyfill for VT API calls
   - Set timeouts, headers, etc.
4. **Start Listening**: 
   - Begin accepting connections on specified port
   - Log startup completion

### State During Request Processing
Each HTTP request follows this lifecycle:
1. **Receive**: 
   - Raw TCP data parsed into HTTP request object by Node.js
2. **Middleware**: 
   - cors: Adds/reads headers, prepares response headers
   - body-parser: Parses JSON body into `req.body`
3. **Route Matching**: 
   - Express router finds matching handler for `method + path`
4. **Handler Execution**: 
   - `server.js` handler for `/api/url-reputation`
   - Extracts API key from headers
   - Validates URL from `req.body`
   - Makes external call to VirusTotal
   - Processes response
   - Constructs JSON response
5. **Response**: 
   - Send HTTP response with status code and JSON body
   - Request objects become eligible for garbage collection
6. **Cleanup**: 
  - No persistent state altered by request (unless metrics updated)
  - Ready for next request immediately

### Concurrent Request Handling
- **Event Loop Model**: 
  - Node.js processes one callback at a time
  - I/O operations (VT API calls) yield event loop
  - Multiple requests processed concurrently via async I/O
- **State Isolation**: 
  - Each request's variables scoped to handler function
  - No shared mutable state between requests
  - Prevents race conditions and cross-request contamination
- **Resource Limits**: 
  - OS-imposed limits on file descriptors, memory
  - Application-level limits possible via middleware (not implemented)
  - Reliance on upstream load balancing or container limits

### State Persistence Considerations
While current implementation avoids persistence, certain metrics might benefit from lightweight persistence:

#### Potential Persistent State (Future Consideration)
- **Aggregate Metrics**: 
  - Daily/weekly request counts, error rates, latency histograms
  - Stored in time-series database (Prometheus, InfluxDB) or simple JSON file
  - Used for capacity planning and SLA monitoring
- **Audit Logs**: 
  - Security-relevant events (failed auth attempts, key changes)
  - Stored in append-only log or SIEM system
  - Requires careful retention and access control policies
- **Configuration History**: 
  - Track changes to critical settings over time
  - For debugging and compliance
- **Blocklists/Allowlists**: 
  - Persistent lists for enterprise deployment
  - Would require administrative interface

#### Implementation Approaches
- **External Services**: 
  - Push metrics to monitoring system (Prometheus pushgateway)
  - Forward logs to centralized logging (ELK, Datadog, Splunk)
  - Use dedicated services rather than building database integration
- **Local Files**: 
  - Append-only logs for audit trails (rotate via logrotate)
  - JSON files for simple configuration (atomic replace via rename)
  - Avoid databases for simplicity unless complex querying needed
- **In-Memory with Periodic Flush**: 
  - Counter flushed to file every N minutes or on signal
  - Recovery on startup by reading last known value

## Cross-Context State Coordination

### Extension Internal Coordination
Multiple extension contexts (content scripts in different tabs, popup, background worker) must appear to share state consistently.

#### Mechanisms
1. **Storage as Source of Truth**: 
   - All contexts read from/write to `chrome.storage`
   - Storage acts as eventual consistency model
   - Latency: Typically <50ms for read/write cycles
2. **Message Passing for Immediacy**: 
   - Critical updates broadcast via `runtime.sendMessage`/`broadcastMessage`
   - Example: User clicks "block" in popup → broadcast → all tabs update immediately
   - Falls back to storage for eventual consistency
3. **Event Listeners**: 
   - `storage.onChanged` listener in each context
   - Triggers UI refresh when storage changes externally
   - Prevents stale displays
4. **Atomic Operations**: 
   - Where possible, combine related updates in single `storage.set`
   - Reduces number of consistency windows

#### Example: User Blocks Site in Popup
```
[Popup] 
  ↓ User clicks Block button on list item
  ↓ Read current sessionFlagged/sessionNonFlagged from storage
  ↓ Modify arrays: remove from non-flagged, add to flagged
  ↓ Write both arrays back to storage in single storage.set call
  ↓ Broadcast message: {action: 'sessionListsUpdated'}
  ↓ 
[All Contexts] 
  ↓ storage.onChanged fires (if not originator)
  ↓ OR broadcast message received
  ↓ Re-render lists from fresh storage data
  ↓ 
[Current Tab Context] 
  ↓ If tab matches hostname: 
        Re-analyze tab immediately
        Update toolbar badge and banner if status changed
```

### Extension-Backend Coordination
State coordination between extension and backend occurs exclusively via request-response patterns:

#### Request Flow (Extension → Backend)
1. **Extension State**: 
   - Has API key in localStorage
   - Has URL to analyze in memory
2. **Request Creation**: 
   - Builds JSON body with URL
   - Retrieves API key from storage
   - Adds API key to request headers
3. **Transmission**: 
   - HTTPS request to backend endpoint
4. **Backend State**: 
   - Has API key in environment
   - Processes request using only request data
   - No retention of request data beyond processing
5. **Response**: 
   - Returns JSON result
   - No server-side state altered by request
6. **Extension State Update**: 
   - Receives result
   - May update storage (tab status, statistics, cache)
   - May update UI based on result

#### Response Flow (Backend → Extension)
Stateless by design:
- No server-side memory of past requests
- Each request authenticated and processed independently
- No session tokens or cookies
- Pure function: (request, environment) → response

## State Lifecycle and Retention Policies

### Explicit User-Initiated Actions
| Action | What Gets Cleared | Where | When |
|--------|-------------------|-------|------|
| Clear Session Data | All sessionStorage keys | Extension | Popup → Settings → Clear Session Data |
| Clear API Key | vtApiKey in localStorage | Extension | Popup → Settings → Clear Key |
| Clear All Data | sessionStorage + localStorage | Extension | Popup → Settings → Clear All Data |
| Clear Browsing Data | Extension storage (if selected) | Browser | Settings → Privacy → Clear browsing data |
| Uninstall Extension | All extension storage | Browser | chrome://extensions → Remove |

### Implicit Automatic Actions
| Trigger | What Gets Cleared | Where | Lifetime |
|---------|-------------------|-------|----------|
| Browser Session End | sessionStorage | Extension | When last tab/window closes |
| Extension Update | None (data preserved) | Extension | Survives update; version field updated |
| Browser Profile Reset | All storage | Browser | When user resets or recreates profile |
| Device Factory Reset | All data | Device | When device is wiped/reset |

### Data Retention Guidelines
| Data Type | Storage Location | Retention Policy | Justification |
|-----------|------------------|------------------|---------------|
| API Key | localStorage | Until user clears or changes | Required for core functionality |
| UI Preferences | localStorage | Until user changes | Enhances user experience |
| Version Tracker | localStorage | Until extension updates | Enables update notifications |
| Session Trust/Blocklists | sessionStorage | Browser session end | Temporary user decisions |
| Tab Status | sessionStorage | Tab close or session end | UI state for active tabs |
| URL Scan Cache | sessionStorage | 10-minute TTL | Balance freshness vs. API calls |
| Statistics | sessionStorage | Session end | Summary for user feedback |
| In-Memory Variables | JS Variables | Microseconds to seconds | Request processing only |
| Server Memory | Process Memory | Request lifetime only | Stateless processing ideal |

## Implementation Best Practices

### For Client-Side Developers
1. **Favor Immutability**: 
   - Treat storage objects as immutable
   - Create new objects/arrays for updates
   - Avoid mutating retrieved objects directly
2. **Batch Related Updates**: 
   - Combine related changes in single storage.set call
   - Reduce consistency windows and storage operations
3. **Validate on Read**: 
   - Check JSON.parse success
   - Handle missing/undefined gracefully
   - Provide sensible defaults
4. **Handle Quota Errors**: 
   - Catch storage.set errors
   - Implement fallback behavior (in-memory only)
   - Notify user if critical functionality affected
5. **Respect Privacy**: 
   - Never store PII or sensitive browsing data
   - Anonymize or hash if any user-specific storage essential
   - Regularly review what's stored and why
6. **Optimize for Reads**: 
   - Assume more reads than writes
   - Structure data for efficient querying
   - Consider denormalization for read-heavy patterns

### For Server-Side Developers
1. **Prefer Statelessness**: 
   - Design handlers as pure functions of inputs
   - Avoid module-level mutable state
   - Use request-scoped variables only
2. **Avoid Accidental Persistence**: 
  - No console.log of sensitive data
  - No writing to files unless explicitly intended
  - No use of tmp directories without cleanup plan
3. **Minimize Dependencies on State**: 
  - Keep controllers and services focused on transformation
  - Push state concerns to infrastructure (load balancers, caches)
- **Log Responsibly**: 
  - Avoid logging headers, query strings, or request bodies
  - Use structured logging for machine parsing
  - Employ sampling for high-volume traffic
- **Plan for Horizontal Scaling**: 
  - Assume any instance can handle any request
  - Avoid sticky sessions or instance-specific Affinity
  - Use external services for shared state if absolutely needed
- **Consider Future Extensibility**: 
  - Design interfaces to allow adding persistence later
  - Keep concerns separated (handlers vs. storage layer)
  - Document assumptions about statelessness

## Monitoring and Diagnostics

### Storage Health Metrics (Conceptual)
While not currently implemented, useful metrics could include:
- **Storage Utilization**: 
  - Percentage of quota used for session/local storage
  - Trending upward may indicate leaks or excessive caching
- **Operation Latency**: 
  - Average time for storage.get/set operations
  - Sudden increases may indicate I/O issues
- **Error Rates**: 
  - Failed storage operations (quota exceeded, corruption)
  - Security-related errors (unauthorized access attempts)
- **Cache Hit Ratios**: 
  - For sessionStorage-based caches (scan_*, etc.)
  - Impact on performance and API call reduction

### Diagnostic Capabilities
- **Storage Inspection**: 
  - Users can view storage via browser dev tools (Application tab)
  - Developers can use same for debugging
  - Sensitive fields (API key) masked in production builds
- **State Export**: 
  - Feature to export non-sensitive state for troubleshooting
  - Excludes API key and any sensitive identifiers
  - Useful for support scenarios
- **State Reset**: 
  - User-initiated reset to factory defaults
  - Clears all storage and reloads extension
  - Useful for troubleshooting persistent issues

## Privacy Guarantees Related to State
1. **No Persistent Identifiers**: 
   - No user ID, device fingerprint, or tracking cookies stored
   - Session data cannot be used to correlate across browser restarts
2. **Data Minimization in Storage**: 
   - Only stores what's necessary for immediate function
   - No behavioral profiles, interest categories, or analytics data
3. **User Control**: 
   - Complete visibility into what is stored
   - Ability to delete all stored data with one action
   - No hidden or obscured storage mechanisms
4. **Temporal Boundaries**: 
   - Session data automatically cleared with browser session
   - Prevents long-term accumulation of sensitive data
5. **Isolation Guarantees**: 
   - Storage accessible only to extension itself
   - No webpage, no other extension, no website can access it
   - Enforced by browser architecture at operating system level

## Comparison with Alternatives

### IndexedDB or WebSQL (Not Used)
- **Rejected Because**: 
  - Overkill for simple key-value storage needs
  - Increased complexity and attack surface
  - Synchronous APIs block main thread (IndexedDB async but complex)
  - No need for querying capabilities or large data storage
- **Would Be Considered For**: 
  - If complex querying or large datasets (>1MB) became necessary
  - If offline-first capabilities required
  - If transactional guarantees needed for related updates

### LocalForage or idb Libraries (Not Used)
- **Rejected Because**: 
  - Additional dependency weight (several KB)
  - Native chrome.storage sufficient for current needs
  - Introduces another layer to audit and maintain
- **Would Be Considered For**: 
  - If cross-browser storage abstraction needed (we're Chrome-focused)
  - If complex indexing or querying required
  - If need to handle larger binary objects efficiently

### Server-Side Databases (Not Used)
- **Rejected Because**: 
  - Contradicts privacy-first and simplicity goals
  - Introduces operational complexity (backups, migrations, scaling)
  - Creates unnecessary attack surface
  - Conflict with data minimization principle
- **Would Be Considered For**: 
  - If aggregate analytics required with user consent
  - If enterprise features needed (centralized policies, audit logs)
  - If legal obligations demanded certain data retention
  - If caching proved essential for cost or performance reasons

## State Management in Diagrams
See `data-flow.md` for detailed illustrations of how state flows between components during various operations (page scan, manual URL scan, trust/block decisions, etc.).

## Implementation Verification
To confirm proper state management:
1. **Extension Storage Audit**: 
   - Check that only expected keys are used in chrome.storage.*
   - Verify no unrelated data accumulates over time
   - Test that data clears appropriately on session end/user action
2. **Memory Leak Testing**: 
   - Monitor background worker memory over extended operation
   - Verify periodic requests don't cause unbounded growth
   - Ensure timers and listeners are properly cleaned up
3. **Privacy Audit**: 
   - Confirm no URLs, content, or personal data persists beyond need
   - Verify API key never stored in logs, databases, or unintended locations
   - Check that all sensitive operations require explicit user action
4. **Behavioral Testing**: 
   - Test state consistency across multiple tabs and popup
   - Verify that updates in one context propagate to others
   - Confirm that cleared state cannot be recovered through normal means

## Conclusion
State management in the AI Phishing Defense system embraces minimalism, user control, and privacy. By leveraging browser storage mechanisms appropriately and avoiding server-side persistence, the system delivers responsive functionality while respecting user data preferences. The clear separation between transient session state and persistent configuration, combined with explicit user controls, ensures that users remain in charge of their data while receiving effective security protection.