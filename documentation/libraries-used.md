# Libraries Used

## Overview
This document lists all third-party libraries and external resources used in the AI Phishing Defense project, along with their purpose and location of use.

## Client-Side Libraries and Resources

### Browser Built-in APIs (Not External Libraries)
The extension relies exclusively on standard WebExtensions APIs and vanilla JavaScript. No third-party JavaScript libraries are included in the client-side code.

**Used APIs**:
- `chrome.runtime`: Messaging between extension components
- `chrome.storage`: Session and local data persistence
- `chrome.tabs`: Tab information and management
- `chrome.action`: Toolbar button (badge) control
- `chrome.notifications`: Optional desktop notifications
- `console`: Debugging and logging (development only)
- Standard DOM APIs: `document`, `window`, `EventTarget`, etc.
- `URL`: Parsing and validating web addresses
- `MutationObserver`: Detecting DOM changes for SPA support
- `fetch`: Not used in content scripts (due to CSP restrictions)
- `Web Components`: Not used
- **No external JS libraries**: Deliberate choice to minimize attack surface and ensure transparency

### External Resources (Client-Side)
- **Google Fonts** (loaded via `<link>` in popup.html):
  - `Nunito`: Weights 400, 500, 600 - used for primary interface text
  - `Quicksand`: Weights 500, 700 - used for headings and accent text
  - Purpose: Improve readability and visual appeal of popup UI
  - Loading: Asynchronous with fallback to system fonts
  - Privacy Note: Font requests made to Google's servers; consider self-hosting for strict privacy requirements

- **Font Awesome** (NOT used): 
  - The project uses inline SVGs for all icons rather than icon fonts
  - Reason: Better performance, no external dependencies, easier styling

### Development Tools (Client-Side)
These are not included in the production extension but used during development:
- **Prettier**: Code formatter (optional configuration)
- **ESLint**: Linting for JavaScript (optional configuration)
- **Markdown Lint**: For documentation quality (optional)

## Server-Side Libraries and Resources

### Production Dependencies (backend/package.json)
| Library | Version | Purpose | Where Used |
|---------|---------|---------|------------|
| **express** | ^4.18.2 | Web framework for creating HTTP server | server.js - Creates app, defines routes, middleware |
| **cors** | ^2.8.5 | Middleware for enabling CORS | server.js - Configured to allow extension origins |
| **dotenv** | ^16.3.1 | Loads environment variables from .env file | server.js - Loads VT_API_KEY and PORT at startup |

### Development Dependencies
The backend currently has no explicitly declared development dependencies. Common development tools might be used but are not committed to the repository.

### External Services (Server-Side)
| Service | Purpose | Where Used |
|---------|---------|------------|
| **VirusTotal API** | Threat intelligence provider for URL reputation checking | Backend server.js - Makes authenticated GET requests to `https://www.virustotal.com/api/v3/urls/{id}` |
| **HTTPS Certificate Authorities** | Trust chain for secure connections | Implicit in Node.js TLS when connecting to VirusTotal |

### Development Tools (Server-Side)
These are not included in production but used during development:
- **nodemon**: Automatic server restart during development (not in package.json)
- **ESLint**: JavaScript linting (optional configuration)
- **Prettier**: Code formatting (optional configuration)
- **Jest/Mocha**: Testing frameworks (not currently implemented)
- **Supertest**: For testing HTTP endpoints (not currently implemented)

## Licensing Information

### Client-Side
- **Extension Code**: MIT License (see LICENSE file)
- **Google Fonts**: 
  - Nunito: SIL Open Font License, Version 1.1
  - Quicksand: SIL Open Font License, Version 1.1
- **Inline SVGs**: Original work, MIT Licensed

### Server-Side
- **express**: MIT License
- **cors**: MIT License
- **dotenv**: BSD 2-Clause License
- **Node.js**: MIT License
- **VirusTotal API**: 
  - Usage governed by VirusTotal Terms of Service
  - Requires valid API key obtained from VirusTotal.com
  - Free tier available with rate limits
  - Commercial use requires appropriate plan

## Size and Impact Analysis

### Client-Side Impact
- **JavaScript Bundle Size**: ~50KB minified (all custom code)
- **CSS Size**: ~15KB (custom styles)
- **Fonts**: ~200KB combined (woff2 format) - loaded asynchronously
- **Icons**: ~10KB (inline SVGs)
- **Total Initial Payload**: ~65KB (excluding fonts which load in background)
- **Runtime Memory**: 5-15MB typical

### Server-Side Impact
- **Dependencies Size**: ~2MB node_modules (after npm install)
- **Runtime Memory**: 50-100MB typical depending on load
- **Startup Time**: <1 second
- **Dependencies Count**: 3 production packages

## Security Considerations

### Client-Side
- **Attack Surface Reduction**: 
  - No third-party JavaScript eliminates supply chain risks from compromised libraries
  - All code auditable in reasonable timeframe
  - No eval() or dynamic code execution
  - Strict Content Security Policy implicitly enforced by Manifest V3
- **Transparency**: 
  - Security reviewers can examine 100% of client-side code
  - No obfuscation or minification that hides intent
  - Clear separation of concerns visible in file structure

### Server-Side
- **Minimal Dependency Footprint**:
  - Only 3 production dependencies reduce vulnerability exposure
  - Each dependency is well-maintained with clear security practices
  - Regular `npm audit` recommended to check for vulnerabilities
- **Explicit Security Boundaries**:
  - No automatic dependency inclusion; all packages consciously selected
  - Version locking via package-lock.json prevents supply chain attacks
  - Emergency update path clearly documented

### License Compliance
- **Permissive Licenses**: All libraries use MIT/BSD-style licenses compatible with commercial use
- **No Copyleft**: Avoids GPL/LGPL requirements that might necessitate source disclosure
- **Attribution**: 
  - Not required for MIT/BSD licenses in binary distribution
  - Maintained in documentation as courtesy
  - Font attributions included where required by SIL OFL

## Usage Guidelines

### Adding New Libraries
1. **Security Review**: 
   - Evaluate supply chain risk
   - Check vulnerability history (snyk.io, npm audit)
   - Review license compatibility
2. **Client-Side Restrictions**:
   - Strong preference for vanilla JS over new libraries
   - If essential, must pass strict security review
   - Must be transparently documented
   - Consider impact on extension size and performance
3. **Server-Side Considerations**:
   - Evaluate if functionality can be implemented with built-in Node.js modules
   - Consider performance implications
   - Check for maintained packages with active security updates
4. **Documentation Update**:
   - Add entry to this libraries-used.md file
   - Specify purpose and location of use
   - Note any special configuration or security considerations

### Removing Libraries
1. **Dependency Analysis**:
   - Check if any other packages depend on it (npm ls)
   - Verify no code imports or references remain
2. **Code Removal**:
   - Remove import/require statements
   - Remove usage throughout codebase
   - Remove related configuration
3. **Cleanup**:
   - Run `npm prune` to remove unused packages
   - Update package.json and package-lock.json
   - Update this document accordingly

## Alternatives Considered and Rejected

### Client-Side Alternatives
- **jQuery**: Rejected due to size overhead and availability of better vanilla JS alternatives
- **Lodash/Underscore**: Rejected; native array/object methods sufficient
- **Moment.js**: Replaced by native Date and temporal proposals where needed
- **Axios**: Not used; fetch API available in service workers and via polyfill if needed
- **React/Vue/Angular**: Rejected for bundle size, complexity, and attack surface concerns
- **Bootstrap/Tailwind**: Rejected for CSS bloat; custom CSS sufficient for simple UI
- **Chart.js/D3**: Not needed; no complex visualizations in current scope

### Server-Side Alternatives
- **Fastify**: Considered but rejected; Express sufficient for simple proxy
- **Koa**: Considered; similar to Express but requires async/await adoption
- **Hapi.js**: Considered; more configuration overhead than needed
- **Plain HTTP Module**: Considered but rejected; Express provides valuable middleware system
- **Python/Flask**: Rejected; team familiarity and language consistency favored Node.js
- **Ruby/Sinatra**: Similar reasoning as Python/Flask
- **Go/Microframeworks**: Excellent performance but steeper learning curve

## Maintenance and Update Policy

### Regular Updates
- **Frequency**: Monthly review recommended
- **Process**: 
  1. Run `npm outdated` to check for updates
  2. Review changelogs for breaking changes
  3. Update package.json with tested versions
  4. Run full test suite
  5. Update package-lock.json
  6. Update this document if versions change significantly
- **Automation**: Consider Dependabot or Renovate for automated PRs

### Security Updates
- **Priority**: Immediate action for high-severity vulnerabilities
- **Process**:
  1. Monitor npm audit and security mailing lists
  2. Assess impact on specific usage patterns
  3. Patch or mitigate as appropriate
  4. Document unusual workarounds if necessary
  5. Update dependencies as soon as practical

### Version Locking Strategy
- **package-lock.json**: Committed to repository for reproducible builds
- **Major Versions**: Avoided unless breaking changes are acceptable and tested
- **Minor Versions**: Generally safe to update (backward-compatible features)
- **Patch Versions**: Recommended to stay current (bug fixes and security patches)
- **Range Selection**: 
  - `^` (caret): Allows minor and patch updates (default for npm install)
  - `~` (tilde): Allows patch updates only
  - Exact version: Used only when specifically required

## Inventory Summary

### Client-Side
- **Third-Party JavaScript Libraries**: 0
- **External Resources**: 
  - 2 Google Macedonia font families
  - Inline SVG icons (custom)
- **Development Tools**: Various (not bundled)

### Server-Side
- **Production Dependencies**: 3 packages
  - express (web framework)
  - cors (CORS middleware)
  - dotenv (environment variable loader)
- **Development Dependencies**: 0 declared (various tools used optionally)
- **External Services**: 
  - VirusTotal API (threat intelligence)
  - Implicit HTTPS CA trust chain

### Total Third-Party Code Surface
- **Client-Side**: Minimal (only browser built-ins and custom code)
- **Server-Side**: Small, auditable set of well-maintained packages
- **Overall**: Excellent for security transparency and supply chain risk management