# Technology Stack

## Overview
AI Phishing Defense leverages a modern, security-focused technology stack that balances performance, compatibility, and maintainability. The stack is divided between client-side (browser extension) and server-side components.

## Client-Side Technology Stack (Browser Extension)

### Core Framework
- **WebExtensions API (Manifest V3)**
  - Standardized cross-browser extension API
  - Service worker-based background processing
  - Content script isolation for security
  - Message-passing architecture for component communication
  - Permission model based on least privilege

### Languages
- **JavaScript (ES6+)**: Primary language for all client-side logic
  - Modern syntax (arrow functions, destructuring, modules)
  - No build step required (interpreted directly by browser)
  - Feature detection for backward compatibility
- **HTML5**: Structure for popup UI and dynamic content
- **CSS3**: Styling for popup UI and security banners
- **JSON**: 
  - Configuration (manifest.json)
  - Data storage (model weights, session state)
  - Communication format (messaging between components)

### Libraries and APIs (Client-Side)
- **Browser Built-in APIs**:
  - `chrome.runtime`: Messaging between extension components
  - `chrome.storage`: Session and local persistence
  - `chrome.tabs`: Tab information and management
  - `chrome.action`: Toolbar button (badge) control
  - `chrome.notifications`: Optional desktop notifications
  - `console`: Debugging and logging (development only)
- **DOM APIs**: Standard web APIs for content script operation:
  - `document`: Page content access and manipulation
  - `window`: Browser window information
  - `fetch`: Not used in content strips (security restriction)
  - `MutationObserver`: Detecting DOM changes for SPA support
  - `URL`: Parsing and validating web addresses
- **No External JavaScript Libraries**: 
  - Deliberate choice to minimize attack surface
  - Avoid supply chain chain risks
  - Keep extension lightweight and auditable
  - All functionality implemented in vanilla JS

### Data Formats and Protocols
- **Message Passing**: JSON-based protocol between extension components
  - Strict schema validation for all messages
  - Type checking and defensive programming
- **Storage Format**: 
  - JSON objects in chrome.storage.session/local
  - Explicit serialization/deserialization where needed
- **Model Format**: 
  - JSON key-value pairs representing feature weights
  - Example: `{"url_length": 0.15, "has_at_symbol": -0.3, ...}`
- **Communication Security**: 
  - HTTPS required for extension-to-backend communication
  - Certificate validation enforced
  - No plaintext HTTP allowed

### Development and Testing Tools
- **Browser Developer Tools**: 
  - Chrome/Firefox DevTools for debugging
  - Extension-specific panels for service workers
  - Network inspector for monitoring API calls
- **Lighthouse**: Performance and accessibility auditing
- **Web Vitals**: Measuring real-user performance metrics
- **Accessibility Tools**: 
  - axe-core for automated accessibility testing
  - Manual screening with screen readers (NVDA, VoiceOver)

## Server-Side Technology Stack (Backend Proxy)

### Runtime Environment
- **Node.js (v14+)**: 
  - JavaScript runtime for server-side logic
  - Chosen for familiarity with frontend team
  - Non-blocking I/O suitable for API proxy pattern
  - V8 engine performance characteristics
- **Version**: Actively maintained LTS release

### Web Framework
- **Express.js (v4.18+)**:
  - Minimalist web framework for Node.js
  - Middleware-based architecture
  - Robust routing capabilities
  - Battle-tested and widely adopted
  - Chosen for simplicity and adequate performance for proxy use case

### Middleware and Libraries
- **cors (v2.8+)**:
  - Enables Cross-Origin Resource Sharing
  - Configured to allow extension origins only
  - Prevents unauthorized cross-site requests
- **dotenv (v16.3+)**:
  - Loads environment variables from .env file
  - Keeps secrets out of source code
  - Supports different environments (development/production)
- **node-fetch (built-in in Node 18+, or polyfill)**:
  - Lightweight API for making HTTP requests
  - Used to communicate with VirusTotal API
  - Promise-based interface matching browser fetch
  - Alternative: built-in `https` module for stricter control

### Data Formats and Protocols
- **JSON**: 
  - Request/response format for all API endpoints
  - UTF-8 encoding standard
  - Strict validation of incoming data
- **HTTPS**: 
  - Required for all external communications
  - Modern TLS versions (1.2+)
  - Certificate validation enforced
- **HTTP/1.1**: 
  - Used for all client-server communication
  - Keep-alive connections for efficiency
  - Proper status codes (200, 400, 401, 429, 500, etc.)

### Security-Related Dependencies
- **Helmet.js** (not used in current implementation but considered):
  - Would provide security-related HTTP headers
  - Evaluated and omitted due to specific proxy nature
  - Security achieved through minimalism and validation
- **express-rate-limit** (not used but considered):
  - Rate limiting to prevent abuse
  - Handled at network layer or via VirusTotal API limits
  - Direct rate limiting considered unnecessary for this use case

### Environment and Configuration
- **Environment Variables**:
  - `VT_API_KEY`: VirusTotal API key (required)
  - `PORT`: TCP port to listen on (default: 3000)
  - `HOST`: Interface to bind to (default: 0.0.0.0)
- **Configuration Files**:
  - `.env`: Template for environment variables (not committed)
  - `package.json`: Dependency and script definitions
  - `implicit`: No additional configuration files needed

### Development and Testing Tools
- **Node.js Built-in Debugger**: 
  - `--inspect` flag for debugging
  - Integration with VS Code Chrome DevTools
- **npm Scripts**:
  - `start`: Launch production server
  - Could add `dev`: `nodemon server.js` for development
  - `test`: Placeholder for future test suite
- **Linting**: 
  - StandardJS or ESLint for code quality (planned)
- **Testing Framework**:
  - Jest or Mocha/Chai for unit testing (planned)
  - Supertest for API endpoint testing
- **API Testing**:
  - Postman or Insomnia for manual testing
  - Automated contract testing with Pact (considered)

## Development and Build Tools

### Client-Side Development
- **No Build Pipeline**: 
  - Deliberate choice for simplicity and transparency
  - No transpilation, bundling, or minification
  - Direct browser interpretation of source files
  - Easier auditing and debugging
- **Version Control**:
  - Git for source code management
  - .gitignore to exclude node_modules and secrets
  - Commit messages following conventional conventional commits
- **Code Quality**:
  - Consistent formatting via Prettier (configured but not enforced)
  - ESLint rules for catching common mistakes
  - JSDoc comments for complex functions
- **Debugging**:
  - `console.log` statements (removed before production)
  - Chrome DevTools for service workers
  - Firefox Debugger for WebExtensions
  - Breakpoint setting in both service worker and content scripts

### Server-Side Development
- **Package Management**:
  - npm (Node Package Manager)
  - Dependencies locked via package-lock.json
  - npm audit for vulnerability scanning
- **Development Workflow**:
  - `npm start` for production server
  - `nodemon` (dev dependency) for auto-restart during development
  - Environment variable switching via NODE_ENV
- **Code Quality**:
  - StandardJS formatting (optional configuration)
  - Comprehensive JSDoc for maintainability
  - Strict mode enabled via `"use strict"`
- **Testing Strategy**:
  - Unit tests for helper functions
  - Integration tests for API endpoints
  - Mocked external services (VirusTotal) for reliable tests
  - Test coverage goals: 80%+ for critical paths

## Deployment Infrastructure Options

### Hosting Environments
- **Platform-as-a-Service (PaaS)**:
  - Heroku: Simple git-push deployment
  - Render: Free tier available, easy setup
  - Railway: Modern deployment experience
  - Fly.io: Container-based global deployment
- **Infrastructure-as-a-Service (IaaS)**:
  - AWS Elastic Beanstalk: Managed Node.js platform
  - Google Cloud App Engine: Fully managed
  - Azure App Service: Integrated with Microsoft ecosystem
  - DigitalOcean App Platform: Simple scalable containers
- **Container Orchestration**:
  - Docker containers deployable to Kubernetes
  - Docker Compose for local development stacks
  - AWS ECS/EKS, Google GKE, Azure AKS
- **Edge Computing**:
  - Cloudflare Workers: Limited by worker constraints
  - AWS Lambda@Edge: For CDN-integrated protection
  - Fastly Compute@Serverless: Real-time processing at edge

### Database Requirements
- **None**: 
  - Current implementation requires no persistent database
  - All state is either in-memory (server) or client-side
  - Designed for horizontal scaling without shared state
  - Future extensions might add:
    - Redis for rate limiting and caching
    - PostgreSQL for analytics and audit logs
    - MongoDB for flexible threat intelligence storage

### Supplementary Services
- **Logging and Monitoring**:
  - Built-in console logging (development)
  - Winston or Pino for production logging (planned)
  - Integration with ELK stack, Datadog, or similar
  - Health check endpoints for load balancers
- **Security Services**:
  - Web Application Firewall (WAF) at infrastructure level
  - DDoS protection via hosting provider
  - Regular dependency scanning (npm audit)
  - Dependency update automation (Dependabot, Renovate)
- **CI/CD Pipeline**:
  - GitHub Actions for automated testing and deployment
  - GitLab CI or Bitbucket Pipelines as alternatives
  - Staging environment for pre-production validation
  - Canary deployments for risk mitigation

## Rationale for Technology Choices

### Why WebExtensions Manifest V3?
- **Security**: Service workers reduce persistent attack surface
- **Performance**: Background processes suspended when idle
- **Standards**: Increasingly required by browser stores
- **Modern Features**: Improved messaging and lifecycle management
- **Future-Proofing**: Aligns with browser vendors' roadmaps

### Why No Frontend Framework (React/Vue/etc.)?
- **Attack Surface**: Fewer dependencies = fewer vulnerabilities
- **Transparency**: Easier security audit of all code
- **Performance**: No virtual DOM overhead; direct DOM manipulation
- **Simplicity**: Straightforward debugging and troubleshooting
- **Size**: Critical for extension size limits and install times
- **Appropriateness**: Simple UI doesn't justify framework complexity

### Why Node.js/Express for Backend?
- **Team Familiarity**: JavaScript proficiency across stack
- **npm Ecosystem**: Easy access to HTTP utilities
- **I/O Model**: Non-blocking suits I/O-bound proxy work
- **Development Speed**: Rapid iteration and debugging
- **Deployment Options**: Wide range of hosting choices
- **Sufficient Performance**: Adequate for expected request volume (<100 req/sec typical)

### Why VirusTotal as Reputation Backend?
- **Industry Standard**: Widely trusted in security community
- **Comprehensive Coverage**: 70+ security engines aggregated
- **API Availability**: Well-documented public API
- **Free Tier Availability**: Allows individual use without cost
- **Reputation Aggregation**: Reduces reliance on single vendor opinion
- **Alternative Considered**: Google Safe Browsing API (more restrictive terms)

### Why No Database in Initial Version?
- **YAGNI Principle**: No current requirements for persistent storage
- **Privacy Benefits**: No data retention beyond immediate need
- **Scalability**: Stateless services scale horizontally trivially
- **Simplicity**: Eliminates entire class of deployment complexity
- **Future Readiness**: Architecture designed to add storage later
- **Performance**: Eliminates query latency for current use case

### Why Minimal Dependencies Overall?
- **Security**: Each dependency is a potential supply chain risk
- **Auditability**: Easier to verify all code in small projects
- **Reliability**: Fewer points of failure from third-party updates
- **Performance**: Less initialization overhead and memory usage
- **Legal**: Simpler license compliance tracking
- **Maintainability**: Fewer updating choreography concerns

## Version-Specific Decisions

### JavaScript Language Features
- **ES2020 Target**: 
  - Nullish coalescing (`??`) for cleaner defaults
  - Optional chaining (`?.`) for safe property access
  - BigInt for potential future use cases
  - Avoids transpilation needs for modern browsers
- **Avoids Cutting Edge**: 
  - Stage 3+ proposals may change
  - Focus on widely supported features
  - Polyfills only where absolutely necessary

### Node.js Version
- **LTS Preference**: 
  - Even-numbered versions (14, 16, 18) for stability
  - Long-term support reduces upgrade frequency
  - Security patches backported for extended periods
- **Specific Choice (v18)**: 
  - Native `fetch` API eliminates dependency
  - Improved diagnostics and debugging
  - Better performance characteristics
  - Still within LTS window as of 2026

### Browser Support Matrix
| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 88+ | Manifest V3 stable |
| Edge | 88+ | Chromium-based |
| Firefox | 109+ | Manifest V3 support |
| Safari | Not Supported | Requires different extension model |
| Opera | 74+ | Chromium-based |

## Security and Privacy Implications of Choices

### Client-Side Security Benefits
- **No eval()**: Eliminates entire class of injection vulnerabilities
- **Strict CSP**: Implicit in Manifest V3 prevents inline script execution
- **Least Privilege Permissions**: Only request what's absolutely needed
- **Content Script Isolation**: Can't corrupt extension or access other tabs
- **Message Validation**: Prevents confused deputy attacks
- **Storage Encryption**: Not implemented as OS provides container security

### Server-Side Security Benefits
- **Minimal Dependencies**: Reduced attack surface from third-party code
- **Input Validation**: Defense-in-depth against malformed requests
- **Output Encoding**: Prevents injection through error messages
- **Rate Limit Awareness**: Respects external service boundaries
- **Secret Management**: Environment variables prevent accidental commits
- **Logging Hygiene**: Avoids accidental credential logging

### Privacy-Preserving Choices
- **Data Minimization**: Only essential information collected
- **No Persistent Histories**: Prevents building user profiles
- **Local-First Processing**: Most analysis happens on user device
- **Transparent Operations**: Clear visibility into what data leaves device
- **User Control**: Explicit consent for API key configuration
- **Audit Trail**: Ability to see exactly what was transmitted

## Performance Characteristics

### Client-Side Performance
- **Startup Time**: <50ms for service worker initialization
- **Memory Usage**: Typically 5-15MB depending on open tabs
- **CPU Usage**: Spiky during analysis; near-zero when idle
- **Battery Impact**: Negligible when backgrounded; ~2-5%/hour active
- **Network Usage**: Minimal; only when analysis triggered and backend reachable

### Server-Side Performance
- **Request Handling Overhead**: <2ms (excluding external API call)
- **Memory Efficiency**: ~50MB base + ~10MB per 1000 concurrent connections
- **Throughput**: Limited primarily by VirusTotal API rate limits
- **Scaling**: Horizontal scaling effective until external API bottleneck
- **Latency**: 95th percentile ~1.2s (dominated by VT API response)

## Compatibility and Interoperability

### Web Standards Compliance
- **HTML5**: Valid semantic markup
- **CSS3**: Uses standard properties with fallbacks
- **ECMAScript 2020**: Targets widely supported features
- **WebExtensions API**: Follows browser extension standards
- **RESTful Principles**: Follows resource-oriented design for API

### Interoperability Points
- **Extension-Backend**: 
  - Standard JSON over HTTPS
  - Defined message schema with versioning capability
  - Error handling via HTTP status codes and JSON error objects
- **Backend-VirusTotal**:
  - Industry-standard API with clear documentation
  - Standard authentication via API key header
  - Standard JSON response format
- **Storage Formats**:
  - JSON for structured data (human-readable and machine-parsable)
  - Line-delimitedUTF-8 for potential future logging

### Backward and Forward Compatibility
- **Semantic Versioning**: 
  - MAJOR: Breaking changes to public APIs or data formats
  - MINOR: Backward-compatible feature additions
  - PATCH: Backward-compatible bug fixes
- **Deprecation Policy**: 
  - Minimum 2-release warnings before removing functionality
  - Clear migration paths in release notes
  - Feature flags for major transitions where possible
- **Browser Version Support**:
  - Maintain compatibility with N-2 versions for major browsers
  - Explicitly call out version requirements in documentation
  - Graceful degradation for missing newer features

## Trade-Offs and Alternatives Considered

### Rejected Client-Side Options
- **TypeScript**: 
  - Pros: Better tooling, fewer runtime errors
  - Cons: Build step required, larger attack surface (transpiler)
  - Decision: Plain JS chosen for simplicity and transparency
- **WebAssembly**: 
  - Pros: Near-native performance for compute-intensive tasks
  - Cons: Overkill for current workload; complexity increase
  - Decision: JS performance sufficient for feature-based analysis
- **Frontend Frameworks**: 
  - Pros: Structured development, component reuse
  - Cons: Runtime overhead, larger bundle size, complexity
  - Decision: Vanilla JS adequate for simple UI
- **IndexedDB for Storage**: 
  - Pros: Larger storage capacity, better querying
  - Cons: Overkill for simple key-value needs; complexity
  - Decision: chrome.storage sufficient for requirements

### Rejected Server-Side Options
- **Python/Flask**: 
  - Pros: Rich ecosystem, excellent for ML integration
  - Cons: Team familiarity, performance characteristics for I/O
  - Decision: Node.js chosen for language consistency
- **Go/Microframeworks**: 
  - Pros: Excellent performance, built-in concurrency
  - Cons: Team learning curve, ecosystem familiarity
  - Decision: Node.js selected for faster initial development
- **Express Alternatives (Koa, Fastify)**:
  - Pros: Potentially better performance or features
  - Cons: Marginal benefits for this use case; ecosystem familiarity
  - Decision: Express selected for simplicity and adequacy
- **Traditional SQL/NoSQL Databases**:
  - Pros: Persistent storage, querying capabilities
  - Cons: Overkill for current needs; operational complexity
  - Decision: Stateless design chosen; databases added only if needed

### Rejected Reputation Sources
- **Google Safe Browsing**: 
  - Pros: High quality, low latency
  - Cons: API access restrictions, terms of use limitations
  - Decision: VirusTotal chosen for broader accessibility
- **URLhaus**: 
  - Pros: Malware-specific focus, free tier
  - Cons: Less comprehensive than VT for phishing detection
  - Decision: VT selected for wider threat coverage
- **PhishTank**: 
  - Pros: Community-driven, specific to phishing
  - Cons: Limited to phishing only; no malware coverage
  - Decision: VT selected for unified threat intelligence
- **Custom Intelligence Feeds**:
  - Pros: Tailored to specific threats
  - Cons: Maintenance overhead, coverage gaps
  - Decision: Third-party aggregation preferred for breadth

## Future Technology Considerations

### Potential Client-Side Enhancements
- **WebAssembly Modules**: 
  - For computationally intensive feature extraction
  - Would require careful security review
- **Service Worker Improvements**: 
  - Background fetch for offline queuing (when connectivity returns)
  - Background sync for periodic updates
- **IndexedDB Adoption**: 
  - If complex querying or large datasets become needed
- **Web Crypto API**: 
  - For client-side encryption of sensitive data (if ever needed)
- **WebGL/GPU Computing**: 
  - Not applicable for current text-based analysis

### Potential Server-Side Enhancements
- **Caching Layer (Redis)**: 
  - To reduce VirusTotal API calls for repeated URLs
  - Would require careful cache invalidation strategy
- **Rate Limiting**: 
  - Implement token bucket or leaky bucket algorithm
  - Integration with Redis for distributed systems
- **Microservices Architecture**: 
  - Separate concerns: auth, proxy, analytics, monitoring
  - Would increase complexity but improve scalability
- **GraphQL Endpoint**: 
  - For flexible querying of threat intelligence
  - Overkill for current simple request/response pattern
- **Authentication System**: 
  - For multi-user or enterprise deployments
  - OAuth 2.0 or OpenID Connect integration
- **Plugin Architecture**: 
  - For allowing custom threat intelligence sources
  - Well-defined interface for third-party integrations

### Monitoring and Observability Additions
- **Distributed Tracing**: 
  - OpenTelemetry for tracking requests across services
  - Would require modifying both client and server
- **Real-Time Metrics**: 
  - Prometheus endpoint for scraping
  - Grafana dashboards for visualization
- **Logging Infrastructure**: 
  - Structured JSON logging for parsing
  - Integration with centralized logging systems
- **Health Checks**: 
  - Liveness and readiness probes for orchestration systems
  - Dependency health checking (VT API reachable)

## Version Information (as of documentation date)
- **Manifest V3**: Supported in Chrome 88+, Edge 88+, Firefox 109+
- **Node.js**: v18.17.0 (LTS Hydrogen)
- **Express.js**: 4.18.2
- **cors**: 2.8.5
- **dotenv**: 16.3.1
- **JavaScript Target**: ES2020
- **Browser Minimum**: Chrome 88, Edge 88, Firefox 109
- **Documentation Version**: 1.0.0