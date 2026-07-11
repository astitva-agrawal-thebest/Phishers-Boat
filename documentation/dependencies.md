# Dependencies

## Overview
This document details the specific dependencies of the AI Phishing Defense project, focusing on the backend Node.js components. The client-side extension has no third-party JavaScript dependencies, relying solely on browser built-in APIs and vanilla JavaScript.

## Backend Dependencies (backend/package.json)

### Production Dependencies
The following packages are required for the backend to run in production:

| Dependency | Version | Description | Why Chosen |
|------------|---------|-------------|------------|
| **express** | 4.18.2 | Fast, unopinionated, minimalist web framework for Node.js | Provides robust routing, middleware support, and HTTP utilities ideal for a lightweight API proxy. Chosen for simplicity, performance, and extensive community support. |
| **cors** | 2.8.5 | Middleware for enabling Cross-Origin Resource Sharing | Configured to allow requests *only* from the extension's origin (localhost during development, approved domains in production). Prevents unauthorized cross-site requests while enabling legitimate extension-backend communication. |
| **dotenv** | 16.3.1 | Zero-dependency module that loads environment variables from a .env file into process.env | Essential for keeping sensitive configuration like API keys out of source code. Supports different environments (development/staging/production) via separate .env files. |

### Dependency Tree
A simplified view of the direct dependencies and their transitive dependencies (as of npm list):

```
backend@1.0.0
├── cors@2.8.5
│   ├── Object.assign@4.1.4
│   ├── vary@1.1.2
  │   └── ... (additional transitive dependencies)
├── dotenv@16.3.1
└── express@4.18.2
    ├ accepts@1.3.8
    ├ array-flatten@1.1.1
    ├ body-parser@1.20.1
    │  ├ bytes@3.1.2
    │  ├ content-type@~1.0.4
    │  ├ debug@2.6.9
    │  ├ depd@2.0.0
    │  ├ http-errors@2.0.0
    │  ├ iconv-lite@0.4.24
    │  ├ on-finished@2.4.1
    │  ├ qs@6.11.0
    │  ├ raw-body@2.4.0
    │  ├ type-is@~1.6.18
    │  └── ... (additional transitive dependencies)
├ debug@4.3.4
├ depd@2.0.0
├ http-errors@2.0.0
├ mime-db@1.52.0
├ mime-types@2.1.35
├ on-finished@2.4.1
├ range-parser@1.2.1
├ safe-buffer@5.2.1
├ send@0.18.4
│  ├ destroy@1.0.1
│  └── mime@1.6.0
├ serve-static@1.15.0
└── ... (additional transitive dependencies)
```

### Installation Instructions
To install backend dependencies:
```bash
cd backend
npm install          # Installs exact versions from package-lock.json
# or
npm ci               # Clean install recommended for CI/CD and production builds
```

### Version Rationale
- **express@4.18.2**: 
  - Latest stable release in the 4.x line as of documentation date
  - Provides essential middleware, routing, and static file serving
  - Active maintenance with regular security updates
  - Backward compatible with 4.x line; avoids major version 5 changes for stability
- **cors@2.8.5**: 
  - Actively maintained package with comprehensive CORS support
  - Chosen for reliability and ease of configuration
  - Compatible with Express 4.x
- **dotenv@16.3.1**: 
  - Latest version with improved parsing and security features
  - Zero-dependency design minimizes attack surface
  - Widely adopted standard for environment variable management

### Security Considerations
#### Vulnerability Management
- **Regular Scanning**: 
  - Recommended: `npm audit` weekly or as part of CI pipeline
  - Address any high or critical severity findings promptly
- **Update Policy**: 
  - Patch versions: Update promptly for security fixes
  - Minor versions: Review changelog before updating
  - Major versions: Require explicit testing and approval due to potential breaking changes
- **Tools**: 
  - Consider Dependabot, Renovate, or npm audit GitHub Action for automated monitoring

#### License Compliance
All dependencies use permissive licenses compatible with the project's MIT License:
- **express**: MIT License
- **cors**: MIT License  
- **dotenv**: BSD 2-Clause License
- **Transitive dependencies**: Primarily MIT, ISC, BSD, and Apache 2.0 licenses

### Development Dependencies
The project currently declares no formal development dependencies in package.json. However, the following tools are commonly used during development:

| Tool | Purpose | Installation Method |
|------|---------|---------------------|
| **nodemon** | Automatically restarts the server when file changes are detected | `npm install --save-dev nodemon` (optional) |
| **ESLint** | Identifies and reports on patterns in JavaScript | `npm install --save-dev eslint` (optional) |
| **Prettier** | Code formatter for consistent styling | `npm install --save-dev prettier` (optional) |
| **Jest** | JavaScript testing framework | `npm install --save-dev jest` (optional) |
| **Supertest** | HTTP assertion library for testing Express.js | `npm install --save-dev supertest` (optional) |
| **cross-env** | Sets environment variables cross-platform | `npm install --save-dev cross-env` (optional) |

These tools are not required for production and are omitted from the repository to minimize attack surface and avoid unnecessary dependencies.

### Alternative Dependency Choices Considered

#### Web Framework Options
- **Fastify**: 
  - Pros: Higher performance, schema-based validation
  - Cons: Steeper learning curve, less middleware ecosystem
  - Verdict: Express chosen for simplicity and adequacy for proxy use case
- **Koa**: 
  - Pros: Modern async/await foundation, smaller core
  - Cons: Requires async/await adoption, less familiar to some developers
  - Verdict: Express chosen for team familiarity and synchronous middleware compatibility
- **Micro**: 
  - Pros: Minimalist, AWS Lambda compatible
  - Cons: Less feature-rich, smaller community
  - Verdict: Express chosen for broader functionality and community support

#### Environment Variable Options
- **config**: 
  - Pros: Hierarchical configurations, validation
  - Cons: Overly complex for simple needs, additional dependency
  - Verdict: dotenv chosen for simplicity and direct process.env population
- **cross-env**: 
  - Pros: Sets environment variables cross-platform
  - Cons: Only needed for scripts; dotenv handles runtime loading
  - Verdict: dotenv sufficient for runtime; cross-env optional for scripts

#### HTTP Client Options (for VirusTotal communication)
- **axios**: 
  - Pros: Feature-rich, interceptors, automatic JSON transformation
  - Cons: Larger bundle, promise cancellation complexity
  - Verdict: Built-in `fetch` (Node 18+) or minimal polyfill chosen for minimalism
- **got**: 
  - Pros: Human-friendly API, retry mechanisms
  - Cons: Additional dependency, larger than necessary
  - Verdict: Native `fetch` sufficient for simple GET requests
- **request**: 
  - Pros: Simple API, long-standing popularity
  - Cons: Deprecated, not maintained, security concerns
  - Verdict: Avoided due to deprecation and security risks

### Dependency Update Process
To safely update dependencies:
1. **Check for Updates**: 
   ```bash
   npm outdated
   ```
2. **Review Changes**: 
   - Examine changelogs for each outdated package
   - Pay special attention to breaking changes in major versions
3. **Update Incrementally**: 
   - Update one package at a time when possible
   - Run test suite after each update
4. **Update Lock File**: 
   ```bash
   npm install      # Updates package-lock.json based on package.json ranges
   # or
   npm update <package>  # Updates specific package and lock file
   ```
5. **Test Thoroughly**: 
   - Run unit tests
   - Run integration tests
   - Perform manual verification of key features
6. **Commit Changes**: 
   - Update package.json and package-lock.json
   - Update this dependencies.md file if versions changed significantly
   - Provide clear description in commit message

### Dependency Removal
To remove an unnecessary dependency:
1. **Verify Usage**: 
   - Search codebase for `require()` or `import` statements
   - Ensure no functionality depends on the package
2. **Uninstall**: 
   ```bash
   npm uninstall <package>
   ```
3. **Clean Up**: 
   - Remove any related configuration
   - Update package.json and package-lock.json
   - Run `npm prune` to remove orphaned dependencies
   - Verify application still works correctly

### Lock File Integrity
The `package-lock.json` file is committed to the repository to ensure:
- **Reproducible Builds**: Identical dependency trees across environments
- **Security**: Known-good versions prevent supply chain attacks
- **Consistency**: Same dependencies in development, testing, and production
- **Auditability**: Exact versions recorded for compliance checking

### Size and Performance Impact
- **Disk Space**: ~20-30MB for node_modules after installation
- **Memory Overhead**: ~5-10MB base Node.js + dependencies
- **Startup Time**: ~500ms-1s for dependency loading and initialization
- **Runtime Impact**: Negligible; most work done in application logic, not dependency overhead
- **Network Impact**: None during runtime; all dependencies pre-installed

### Licensing Summary
| License Type | Count | Examples |
|--------------|-------|----------|
| MIT | Majority | express, cors, debug, many transitive |
| BSD | Several | dotenv, and various transitive |
| ISC | Common | Node.js built-ins, some transitive |
| Apache 2.0 | Some | Specific transitive dependencies |
| **Overall** | **Compatibility**: All licenses permit use in proprietary software with minimal restrictions |

### Important Notes
1. **No Client-Side JS Dependencies**: 
   - The extension intentionally contains zero third-party JavaScript libraries
   - This reduces attack surface, improves transparency, and ensures auditability
   - All client-side functionality uses browser built-in APIs or vanilla JavaScript
2. **Extension Uses No Build Process**: 
   - Unlike many modern web projects, the extension requires no transpilation, bundling, or minification
   - This simplifies debugging and reduces potential failure points
   - Source code is exactly what runs in the browser
3. **Production Readiness**: 
   - Dependencies are minimal and well-vetted
   - No known high-severity vulnerabilities in current versions
   - Licenses are permissive and compatible with commercial use
4. **Future-Proofing**: 
   - Dependency choices favor stability and maintenance over bleeding-edge features
   - Version ranges in package.json allow for patch updates while preventing unexpected major version changes
   - Lock file ensures consistent deployments

### Contact for Questions
For questions about specific dependencies or their usage, please refer to:
- The source code comments in backend/server.js
- The official documentation for each library
- The project maintainers for project-specific rationale