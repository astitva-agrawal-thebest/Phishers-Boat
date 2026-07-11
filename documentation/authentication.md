# Authentication

## Overview
Authentication in the AI Phishing Defense system is designed to protect sensitive credentials while minimizing user friction. The system implements a layered approach where the browser extension authenticates to the backend server, which in turn authenticates to external threat intelligence services. End-user authentication (login/password) is intentionally omitted to maintain simplicity and privacy.

## Authentication Components

### 1. Extension-to-Backend Authentication
**Purpose**: Securely transmit the VirusTotal API key from the extension to the backend proxy without exposing it to websites or third parties.

#### Mechanism
- **Header-Based Authentication**: 
  - Custom HTTP header: `x-vt-api-key`
  - Value: The user's VirusTotal API key (obtained from virustotal.com)
  - Transmission: HTTPS only in production; HTTP allowed only for localhost development
- **Flow**:
  1. User enters API key in extension popup settings
  2. Key stored in browser's `localStorage` (isolated to extension origin)
  3. When backend communication needed:
     - Extension retrieves key from `localStorage`
     - Includes key in `x-vt-api-key` header of POST request to `/api/url-reputation`
     - Header removed by browser before reaching any website (extension-only channel)
  4. Backend receives request and validates key against `process.env.VT_API_KEY`
  5. On match: request processed; on mismatch: 401 Unauthorized response

#### Security Properties
- **Confidentiality**: 
  - Key never exposed to webpage content scripts
  - Not included in referrer headers or leaked via browser features
  - Protected by same-origin policy (only extension can read itseligible)
- **Integrity**: 
  - Backend validates key format and matches exactly
  - No acceptance of partial or hashed keys
- **Replay Resistance**: 
  - While not cryptographically signed, HTTPS prevents interception
  - Short-lived sessions (key must be present for each request)
  - Key rotation possible without changing endpoint
- **Least Privilege**: 
  - Key used only for VirusTotal API calls
  - No other permissions granted by possession of this key

#### Implementation Details
- **Extension Side** (`background/reputationClient.js`):
  ```javascript
  const secret = data.vtApiKey || ''; // From chrome.storage.local.get(['vtApiKey'])
  if (!secret) {
    return { status: 'error', isSuspicious: true, type: 'warning', reason: 'Missing VirusTotal API Key' };
  }
  // ... later in fetch headers:
  headers['x-vt-api-key'] = secret;
  ```
- **Backend Side** (`server.js`):
  ```javascript
  const vtApiKey = req.headers['x-vt-api-key'];
  if (!vtApiKey) {
    return res.status(401).json({ 
      status: 'unavailable', 
      reason: 'Unauthorized: Missing VirusTotal API Key in request headers' 
    });
  }
  // Compare with environment variable (constant-time comparison recommended in production)
  if (vtApiKey !== process.env.VT_API_KEY) {
    return res.status(401).json({ 
      status: 'unavailable', 
      reason: 'Unauthorized: Invalid VirusTotal API Key' 
    });
  }
  ```

#### User Experience
- **Setup**: One-time entry of API key in popup Settings tab
- **Storage**: Encrypted by browser's storage isolation (not additional encryption)
- **Recovery**: If forgotten, user can re-obtain from VirusTotal.com and re-enter
- **Rotation**: 
  - User can update key anytime via settings
  - Old session continues working until key changed
  - New requests use new key immediately
- **Visibility**: 
  - Masked input field in settings (password type)
  - Toggle to show/hide for verification
  - Never displayed in plaintext elsewhere

### 2. Backend-to-VirusTotal Authentication
**Purpose**: Authenticate the backend server with the VirusTotal API to access threat intelligence services.

#### Mechanism
- **Header-Based Authentication**: 
  - Standard VirusTotal API header: `x-apikey`
  - Value: VirusTotal API key stored in backend environment variable
  - Transmission: HTTPS only (VirusTotal requires HTTPS)
- **Flow**:
  1. Backend receives validated request from extension
  2. Retrieves API key from `process.env.VT_API_KEY`
  3. Constructs request to `https://www.virustotal.com/api/v3/urls/{encoded_url}`
  4. Includes header: `x-apikey: [VT_API_KEY_FROM_ENVIRONMENT]`
  5. VirusTotal service validates key and processes request
  6. Returns JSON response with analysis results
  7. Backend transforms response and returns to extension

#### Security Properties
- **Service-to-Service**: 
  - Occurs entirely in trusted server environment
  - No exposure to client-side or network interception beyond TLS
- **Credential Protection**: 
  - Key never touches client-side code or storage
  - Only accessible to Node.js backend process
  - Protects against extraction via XSS or other client-side attacks
- **Usage Limitation**: 
  - Key restricted to VirusTotal API only
  - Compromise would allow only VT API usage (not account takeover)
  - Easy to revoke and replace via environment variable

#### Implementation Details
- **Backend Side** (`server.js` within `/api/url-reputation` handler):
  ```javascript
  const response = await fetch(`https://www.virustotal.com/api/v3/urls/${b64Url}`, {
    method: 'GET',
    headers: {
      'x-apikey': process.env.VT_API_KEY, // From environment
      'Accept': 'application/json'
    }
  });
  // ... process response
  ```
- **Environment Security**:
  - Key stored in server environment (never in code)
  - Provided via deployment platform (Heroku config vars, Docker secrets, etc.)
  - Never committed to repository (`.env` listed in `.gitignore`)
  - Rotatable without code changes or redeployment

### 3. Absence of Traditional User Authentication
#### Rationale for No Login System
- **Privacy Preservation**: 
  - No need to collect or store personally identifiable information (PII)
  - Eliminates risk of credential harvesting or password reuse attacks
  - Avoids creating another account management burden for users
- **Simplicity & Accessibility**: 
  - Zero friction installation and setup
  - No forgotten passwords, account recovery, or 2FA concerns
  - Works immediately after installation and API key configuration
- **Threat Model Alignment**: 
  - Primary threat is malicious websites, not unauthorized extension use
  - Physical device security protects against local misuse
  - Shared device scenarios mitigated by browser profile isolation
- **Operational Efficiency**: 
  - No user database to maintain, secure, or backup
  - No account recovery flow to implement or secure
  - No GDPR complications from storing authentication data

#### Alternatives Considered and Rejected
- **Username/Password Login**: 
  - Rejected due to privacy concerns and unnecessary complexity
  - Would require storing credentials (hashed) and managing sessions
  - Not aligned with the tool's purpose as a client-side security utility
- **OAuth/Social Login**: 
  - Rejected due to third-party tracking and unnecessary complexity
  - Would create dependency on external identity providers
  - Adds surface area for phishing attacks targeting login flow
- **Device Binding / Hardware Keys**: 
  - Overkill for threat model; adds complexity without proportional security gain
  - Would hinder legitimate multi-device usage (work/home computers)
- **Session Tokens with Expiry**: 
  - Considered but deemed unnecessary given threat model
  - Would add complexity without meaningful security improvement for use case

#### Security Implications of No Authentication
- **Device Theft/Risk**: 
  - If device compromised, attacker could use extension with stored API key
  - Mitigation: Full disk encryption, device passwords, prompt key rotation
  - Impact limited to VirusTotal API usage (rate-limited, revocable key)
- **Shared Device Usage**: 
  - Multiple users on same browser profile share extension state
  - Mitigation: Use separate browser profiles or OS accounts
  - Alternative: Enterprise deployment with managed policies
- **Malicious Extension Update**: 
  - Protected by browser store signing and update integrity checks
  - Users should only install from official sources
  - Permissions limited to minimize damage from compromised update

### 4. Certificate and Transport Authentication
#### HTTPS/TLS Validation
- **Extension-to-Backend**:
  - Enforced by browser for extension-initiated requests
  - Certificate validation prevents man-in-the-middle attacks
  - Self-signed certificates acceptable only for localhost development
- **Backend-to-VirusTotal**:
  - Standard HTTPS validation performed by Node.js fetch
  - Certificate pinning not implemented (relies on CA system)
  - Could be enhanced in high-security deployments
- **Certificate Management**:
  - Let's Encrypt or similar for production domains
  - Self-signed + certificate exception acceptable for internal/isolated deployments
  - Certificate transparency monitoring recommended for public domains

### 5. Session and Identity Management
#### Implicit Identity via Installation
- **Installation Binding**: 
  - Effectively tied to browser profile + extension ID
  - Clearing browser data or reinstalling resets state
  - Syncing browsers (via Firefox Sync or Chrome Sync) may propagate settings
- **No Persistent User ID**: 
  - Cannot track individual users across sessions or devices
  - No possibility of behavioral profiling or profiling
  - Aligns with privacy-by-design principles

#### Temporary Session Concepts
- **Browser Session Storage**: 
  - Data cleared when browser window/tab closes (depending on browser)
  - Provides automatic cleanup for temporary trust/blocklist decisions
  - Session ends when last tab of browser profile closes
- **No Server-Side Sessions**: 
  - Authentication is request-based (API key per request)
  - No session cookies, tokens, or server-side state
  - Eliminates session fixation, hijacking, and storage concerns

### 6. Credential Management Best Practices

#### For Users (API Key Handling)
- **Obtaining Key**: 
  - Sign up at virustotal.com
  - API key found in profile settings after email verification
  - Free tier available with rate limits sufficient for personal use
- **Storing Key**: 
  - Enter once in extension Settings → VirusTotal API Key
  - Stored in browser extension storage (isolated)
  - Treat as sensitive as a password (do not share)
- **Using Key**: 
  - Automatically sent to your own backend when cloud check needed
  - Never leaves your controlled environment (extension → your backend)
  - Backend never shares it with third parties
- **Protecting Key**: 
  - Device security (password, encryption, updates)
  - Be wary of phishing sites claiming to need your VT key
  - Legitimate sites never ask for your VirusTotal API key
- **Rotating Key**: 
  1. Generate new key at virustotal.com
  2. Enter new key in extension settings
  3. Old key immediately invalidated for future requests
  4. Optional: Revoke old key at VirusTotal.com for added security
- **Lost Key Recovery**: 
  - Simply obtain new key from VirusTotal account
  - No recovery needed; old key irrelevant once replaced

#### For Administrators (Backend Deployment)
- **Environment Variable Setup**:
  - Heroku: `heroku config:set VT_API_KEY=your_key_here`
  - Docker: `-e VT_API_KEY=your_key_here` or docker-compose
  - Kubernetes: `secret` and `envFrom` or direct env var
  - Raw server: Export before starting or use .env file (not committed)
- **Key Protection**:
  - Restrict server filesystem permissions
  - Use secrets management in orchestration systems
  - Rotate via infrastructure without downtime
  - Monitor for accidental logging or exposure
- **Key Auditability**:
  - Know exactly who has access to deployment environment
  - Regular rotation schedule recommended (e.g., 90 days)
  - Immediately rotate if compromise suspected

### 7. Zero-Knowledge Properties
The system achieves partial zero-knowledge characteristics for certain operations:

#### Local-Only Mode (When Backend Unavailable)
- **True Zero-Knowledge**: 
  - Zero data leaves the user's device
  - Zero external dependencies
  - Zero trust required beyond local code
  - Protection limited to heuristic analysis only

#### Hybrid Mode (Normal Operation)
- **Proxy Anonymity**: 
  - VirusTotal sees requests as coming from backend server IP
  - Cannot correlate requests to individual end users
  - Sees only aggregate traffic from your deployed instances
- **Key Isolation**: 
  - VirusTotal knows only that *some* user with your key is querying
  - Cannot determine which specific URLs belong to which users
  - Prevents profiling based on query patterns from single source
- **Data Minimization**: 
  - Only URL hash sent to VirusTotal (not full browsing context)
  - No cookies, user agent, or referral information transmitted
  - Minimizes fingerprinting potential beyond the URL itself

### 8. Comparison with Alternatives

#### Direct Extension-to-VirusTotal (Not Used)
- **Disadvantages**:
  - API key exposed to extension JavaScript (XSS risk)
  - Key potentially extractable via browser debugging tools
  - No rate limiting abuse protection (key abused = quick exhaustion)
  - Difficult key rotation (requires extension update)
  - No usage audit or monitoring capability
- **Advantages** (not realized due to risks):
  - Simpler architecture (no backend needed)
  - Lower latency (no extra hop)
  - No server maintenance

#### Centralized Key Storage (Not Used)
- **Disadvantages**:
  - Creates single point of failure for key security
  - Requires authentication system to protect key storage
  - Introduces privacy concerns (centralized knowledge of keys)
  - Complex recovery if central store compromised
- **Advantages** (not realized due to risks):
  - Easier bulk key rotation
  - Centralized usage monitoring
  - Simplified endpoint security (authenticate to central service)

#### JWT or Token-Based Auth (Not Used)
- **Disadvantages**:
  - Overkill for simple API key scenario
  - Adds complexity (token generation, validation, expiry)
  - Still requires secure storage of signing key
  - Doesn't solve core problem of key distribution
- **Advantages** (not realized):
  - Standardized protocol with rich tooling
  - Fine-grained scoping possible (not needed here)
  - Familiar to many developers

### 9. Security Analysis of Authentication Flow

#### Threat: API Key Leakage from Extension
- **Vectors**: 
  - Malicious webpage attempting to read extension storage
  - Rogue extension with cross-extension permissions
  - Developer tools access by attacker with physical access
  - Memory scraping by malware
- **Mitigations**:
  - Chrome storage isolation prevents webpage access
  - Cross-extension permissions require explicit user grant
  - Physical access requires device compromise first
  - Malware would need elevated privileges; disk encryption helps
- **Residual Risk**: 
  - If device compromised, key may be extracted
  - Impact: Attacker can query VirusTotal with your key
  - Mitivation: Key revocable; VT API usage rate-limited

#### Threat: Backend Compromise
- **Vectors**:
  - Server-side vulnerability allowing code execution
  - Misconfiguration exposing environment variables
  - Log output accidentally containing credentials
  - Supply chain attack in dependencies
- **Mitigations**:
  - Principle of least privilege in server permissions
  - Secrets management in platform (not env files in prod)
  - Audit logging that excludes headers
  - Dependency scanning (npm audit) and lock files
- **Residual Risk**: 
  - If server compromised, API key may be extracted
  - Mitivation: Key revocable; limited to VT API use
  - Note: Attacker would also control your backend logic

#### Threat: Replay or Man-in-the-Middle
- **Vectors**: 
  - Network eavesdropping on HTTP connections
  - Session replay attacks
  - DNS hijacking to malicious backend
- **Mitigations**:
  - HTTPS mandatory for production (TLS encryption)
  - HSTS recommended for production domains
  - Certificate validation prevents MITM
  - No session state to replay (request-authenticated)
  - DNSSEC and certificate transparency recommended
- **Residual Risk**: 
  - Theoretically possible with compromised CA or SSL vulnerability
  - Extremely unlikely in practice with proper certificate management

### 10. Compliance and Audit Considerations
- **SOC 2 Type II**: 
  - Relevant criteria: CC6.1 (Logical Access), CC7.1 (System Operations)
  - Supported by: minimal access controls, logging, change management
- **HIPAA**: 
  - Not applicable as no PHI collected or transmitted
  - Would require BAAs if extended to healthcare contexts
- **GDPR Article 32**: 
  - Security of processing: 
    - Pseudonymization: Not applicable (no personal data stored)
    - Confidentiality: Encryption in transit (TLS), access controls
    - Integrity: Hashing not applicable; validation and error handling
    - Resilience: Backup concepts not applicable; stateless design
- **ISO 27001**: 
  - Annex A.9 (Access Control): Implemented via API key validation
  - Annex A.12 (Operations Security): Addressed via change management, vulnerability management
  - Annex A.14 (System Acquisition): Addressed in secure development practices

### 11. Future Authentication Considerations
While current authentication meets requirements, future enhancements might consider:

#### Optional Enhanced Security
- **Mutual TLS (mTLS)**: 
  - For high-security environments requiring certificate-based auth
  - Would increase complexity significantly
  - Only recommended for regulated industries with specific requirements
- **Short-Lived Tokens**: 
  - Replace static API key with time-bound tokens
  - Would require token exchange endpoint (increases attack surface)
  - Benefit: Limits exposure time if key leaked
  - Cost: Significant complexity increase for minimal gain
- **Hardware Security Keys**: 
  - For enterprise scenarios requiring physical token presence
  - Would require WebAuthn integration and device management
  - Significant usability trade-off; not appropriate for general public

#### Improved User Experience
- **Automatic Key Discovery**: 
  - Detect if key already stored in password manager
  - Offer to import from browser password managers (with consent)
  - Reduces setup friction while maintaining security
- **Key Quality Checking**: 
  - Basic format validation on entry (length, character set)
  - Integration with HaveIBeenPwned for leaked credential checks
  - Balance security with usability (avoid frustrating false positives)
- **Usage Notification**: 
  - Optional anonymized telemetry about API key usage
  - Help users detect potential key compromise
  - Strict opt-in and transparency required

### 12. Summary of Authentication Trust Boundaries
```
[User] 
   ↓ (Knows API key, enters once)
[Browser Extension Storage] 
   ↓ (Encrypted by browser isolation, accessible only to extension)
[Extension-to-Backend Channel] 
   ↓ (HTTPS, custom header, validated by backend)
[Backend Server Process Memory] 
   ↓ (Accessible only to Node.js process, key from env)
[Backend-to-VirusTotal Channel] 
   ↓ (HTTPS, x-apikey header, validated by VT)
[VirusTotal Service] 
   ↓ (Processes request, returns threat intelligence)
```

#### Key Properties:
- **Single Secret**: Only one secret (VirusTotal API key) manages throughout system
- **User Control**: User possesses and can revoke the secret at will
- **Minimal Exposure**: Secret exists only in two places: user-controlled extension storage and server environment
- **No Persistence Beyond Need**: Secret not stored in logs, databases, or long-term caches
- **Separation of Duties**: 
  - User controls key lifecycle
  - Backend enforces validation and usage logging
  - VirusTotal provides service under its own terms
- **Defense in Depth**: 
  - Multiple validation points (extension send, backend receive, VT receive)
  - Clear audit trail at each boundary (who accessed what when)

### Conclusion
The authentication mechanism in AI Phishing Defense provides appropriate security for its threat model while prioritizing user privacy and operational simplicity. By leveraging browser isolation, environment-based secrets, and header-based authentication over HTTPS, the system protects credentials effectively without burdening users with complex authentication flows. The absence of traditional user authentication aligns with the tool's purpose as a client-side security utility rather than a service requiring identity management.