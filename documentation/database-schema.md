# Database Schema

## Overview
The AI Phishing Defense system intentionally does not use a database for data persistence in its current implementation. This design choice enhances privacy, simplifies deployment, and reduces operational complexity.

## Why No Database?
### Privacy Considerations
- **No Persistent User Data**: The system does not store browsing history, URLs analyzed, or any personal information beyond the immediate session
- **Data Minimization**: Only essential data is processed, and nothing is retained longer than necessary
- **User Control**: Users can be confident that their browsing habits are not being recorded or profiled

### Architectural Benefits
- **Stateless Services**: Both extension and backend components are designed to be stateless where possible
- **Horizontal Scaling**: Without database dependencies, services can be scaled horizontally without complex clustering or data synchronization
- **Simplified Deployments**: Eliminates the need for database administration, backups, schema migrations, and connection pooling
- **Failure Isolation**: Reduces points of failure; no risk of database corruption, connection exhaustion, or query performance issues

### Security Advantages
- **Reduced Attack Surface**: Eliminates database-specific vulnerabilities (SQL injection, NoSQL injection, etc.)
- **No Data Breach Risk**: No stored data means nothing to steal in a breach scenario
- **Simpler Compliance**: Easier to comply with data protection regulations (GDPR, CCPA) when no personal data is stored

## Data Storage Alternatives Used

### Browser-Based Storage (Extension)
The extension uses browser storage mechanisms for temporary, user-controlled data:

#### Session Storage (`session`)
- **Lifetime**: Cleared when browser session ends (all tabs closed)
- **Purpose**: 
  - Temporary trust/blocklist decisions (user-made during session)
  - Per-tab status caching
  - Scan result caching (10-minute TTL to prevent re-analysis of same URL)
  - Session statistics (scanned/blocked counts)
- **Data Structure**:
  ```javascript
  // sessionStorage keys:
  sessionFlagged: [          // User-blocked sites during session
    {url, hostname, timestamp, isSuspicious:true, type:'danger', reason, manual:true}
  ],
  sessionNonFlagged: [       // User-trusted sites during session  
    {url, hostname, timestamp, isSuspicious:false, type:'safe', reason, reason, manual:true}
  ],
  tabStatus_<tabId>: {       // Per-tab status
    isSuspicious, type, reason, timestamp, reportUrl?
  },
  scan_<urlHash>: {          // URL-specific cache (10-minute TTL)
    result: {...},           // Full assessment result
    timestamp: unixMs
  },
  scannedCount: number,      // Total URLs analyzed in session
  blockedCount: number       // Total threats blocked in session
  ```

#### Local Storage (`local`)
- **Lifetime**: Persists until explicitly cleared by user or extension update
- **Purpose**:
  - User preferences (theme, notification settings)
  - API key storage (encrypted via browser's same-origin policy)
  - Extension version tracking for migration notices
- **Data Structure**:
  ```javascript
  // localStorage keys:
  vtApiKey: string,          // VirusTotal API key (set via popup settings)
  theme: 'light'|'dark'|'system',
  notifications: {banners: boolean, sounds: boolean},
  version: string            // Last version user interacted with
  ```
- **Note**: The API key is stored in plaintext within the extension's isolated storage space but is:
  - Only accessible to the extension itself (not websites)
  - Never transmitted to third parties (only to user's own backend)
  - Replaceable without data loss (user can re-enter if needed)

### Server-Side Storage (Backend)
The backend server uses in-memory storage only:

#### Process Memory
- **Lifetime**: Process lifetime (until server restart)
- **Purpose**:
  - Request processing variables
  - Temporary caching considerations (not implemented in current version)
  - Runtime metrics (request counters, error rates)
- **No Persistent Data**: 
  - No user data stored
  - No API keys or secrets persisted (read from environment at startup)
  - No request logs stored by default (can be enabled via external logging)

#### Environment Variables
- **Lifetime**: Set at process startup, available for process duration
- **Purpose**:
  - Securely store sensitive configuration (VirusTotal API key)
  - Configure runtime behavior (port, host interface)
- **Access**: 
  - Read via `process.env.VARIABLE_NAME`
  - Not persisted beyond process lifetime
  - Must be set in deployment environment

## When a Database Might Be Considered
While the current design avoids databases, certain features might benefit from persistent storage in future versions:

### Potential Use Cases for Database
1. **Analytics & Reporting**:
   - Aggregate threat detection statistics over time
   - Geographic distribution of threats
   - Trend analysis for security teams
   - *Would require explicit user consent and anonymization*

2. **Enterprise Features**:
   - Centralized policy management
   - Audit trails for compliance
   - User/group-based policy assignments
   - Integration with SIEM systems

3. **Enhanced Caching**:
   - Intelligent caching of VirusTotal results to reduce API calls
   - Cache warming for popular URLs
   - *Would need careful TTL and invalidation strategy*

4. **User Accounts & Synchronization**:
   - Sync Settings across devices
   - Premium features with subscription management
   - *Would require authentication system*

### Database Selection Criteria (If Needed)
If future requirements necessitate a database, selection would consider:
- **Privacy-First**: Ability to encrypt sensitive fields, data minimization features
- **Open Source**: Preferred licensing (MIT, Apache, GPL with exceptions)
- **Operational Simplicity**: Easy backup/restore, monitoring, scaling
- **Performance**: Appropriate read/write characteristics for expected workload
- **Ecosystem**: Good tooling, community support, and hosting options

### Potential Candidates
- **PostgreSQL**: 
  - Strong consistency, excellent JSON support, extensible
  - Good choice for relational data and complex queries
- **MongoDB**: 
  - Flexible document model for evolving schemas
  - Good for semi-structured threat intelligence data
- **Redis**: 
  - Ideal for caching and rate limiting
  - Optional persistence available
- **SQLite**: 
  - Embedded option for low-to-moderate traffic scenarios
  - Zero-configuration, file-based

## Data Flow Without Database
All data follows these paths without touching a persistent database:

### Extension-Only Data Flow
```
User Action → Content Script → Background Worker 
              ↓                             ↓
      Session/Local Storage ←→ Background Worker (read/write)
              ↓                             ↓
              ←─────── Messaging ───────────→
              ↓                             ↓
          Popup UI ←────────────────────── Background Worker
```

### Extension-Backend Data Flow
```
User Action → Content Script → Background Worker 
                              ↓
                 HTTPS Request → Backend Server
                              ↓
                 HTTPS Response ← Backend Server
                              ↓
          Background Worker ←──────────────────────
                              ↓
              Session/Local Storage ←→ Background Worker
                              ↓
              Popup UI ←────────────────────── Background Worker
```

### Key Principles Maintained
1. **Temporal Locality**: Data is used soon after collection and then discarded
2. **User Control**: Users can clear all stored data via extension interface
3. **Transparency**: All storage locations and purposes are documented
4. **Security Isolation**: Storage areas are isolated by browser origin policy
5. **Minimal Retention**: Nothing kept longer than useful for immediate function

## Implementation Verification
To confirm no database is used:
1. Check `backend/server.js` for any database connection code
2. Verify absence of:
   - `require('pg')`, `require('mysql2')`, `require('mongodb')`, etc.
   - No `mongoose`, `sequelize`, `typeorm` imports
   - No connection strings or pool initialization
3. Confirm storage usage is limited to:
   - `process.env` (environment variables)
   - In-memory variables and functions
   - Optional console logging
4. Review extension code for:
   - Only `chrome.storage.session/local` usage
   - No IndexedDB, WebSQL, or other browser database APIs
   - No `localforage`, `idb` or similar libraries

## Compliance Statement
This system is designed to comply with data protection principles including:
- **Data Minimization**: Article 5(1)(c) GDPR - only processes data necessary for security function
- **Storage Limitation**: Article 5(1)(e) GDPR - data kept no longer than necessary
- **Integrity and Confidentiality**: Article 5(1)(f) GDPR - appropriate security measures
- **Rights of Access and Erasure**: Articles 15 & 17 GDPR - users can access and delete their data
- **Privacy by Design**: Article 25 GDPR - data protection built into design

## Future Considerations
Should requirements change to necessitate persistent storage, any database implementation would:
1. Require explicit user consent for any personal data collection
2. Implement clear data retention and deletion policies
3. Provide transparency about what data is stored and why
4. Include mechanisms for data export and deletion
5. Undergo formal privacy impact assessment
6. Maintain the current option for users to operate in a pure local-only mode

## Conclusion
The deliberate absence of a database in the current implementation reinforces the project's commitment to user privacy, operational simplicity, and security. All data handling follows strict minimization and temporal locality principles, ensuring that the system provides effective security without unnecessary data retention.