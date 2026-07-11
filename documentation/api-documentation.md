# API Documentation

## Overview
This document describes the RESTful API provided by the AI Phishing Defense backend server. The API is designed to be consumed exclusively by the browser extension, providing secure access to threat intelligence services while protecting sensitive API keys.

## Base URL
- **Development**: `http://localhost:3000`
- **Production**: `https://your-backend-domain.com` (configured in extension's `background/reputationClient.js`)

All endpoints are relative to the base URL.

## Security & Authentication
- **Authentication Method**: Custom HTTP header `x-vt-api-key`
- **Credential Source**: 
  - Extension retrieves API key from `localStorage` (set via popup settings)
  - Key is never exposed in client-side code or storage accessible to websites
  - Key is transmitted only in the header to the backend server
- **Transport Security**: 
  - HTTPS required in production
  - HTTP allowed only for localhost development
  - Certificate validation enforced
- **Rate Limiting**: 
  - Implemented via VirusTotal API limits (not enforced by backend)
  - Client-side debouncing prevents excessive requests
  - Backend does not impose additional limits to avoid blocking legitimate traffic

## Error Handling
All endpoints return JSON responses with consistent error structure:
```json
{
  "status": "error",
  "reason": "Human-readable error description"
}
```
HTTP status codes indicate the type of error:
- 400: Bad Request (client error)
- 401: Unauthorized (missing/invalid API key)
- 429: Too Many Requests (rate limited)
- 500: Internal Server Error
- 503: Service Unavailable (downstream service issues)

## Endpoints

### 1. Health Check
**GET** `/health`

#### Purpose
Verifies that the backend server is running and responsive. Used by monitoring systems and for basic connectivity testing.

#### Request
- **Method**: GET
- **Path**: `/health`
- **Headers**: 
  - `Accept: application/json` (recommended)
- **Query Parameters**: None
- **Body**: None

#### Response
- **Success** (HTTP 200):
  ```json
  {
    "status": "ok"
  }
  ```
- **Error**: 
  - HTTP 503 if server is overloaded or unable to process requests
  - Format follows standard error structure

#### Example
**Request**:
```
GET /health
Accept: application/json
```

**Response**:
```
HTTP 200 OK
Content-Type: application/json

{
  "status": "ok"
}
```

#### Authentication Required
No - this endpoint is publicly accessible for monitoring purposes.

#### Use Cases
- Load balancer health checks
- Container orchestration readiness/liveness probes
- Simple connectivity verification during extension setup
- Debugging network issues

### 2. URL Reputation Check
**POST** `/api/url-reputation`

#### Purpose
Analyzes a URL for security threats using the VirusTotal API. This is the primary endpoint used by the extension for cloud-based threat intelligence.

#### Request
- **Method**: POST
- **Path**: `/api/url-reputation`
- **Headers**:
  - `Content-Type: application/json` (required)
  - `Accept: application/json` (recommended)
  - `x-vt-api-key`: [API key from extension storage] (required)
- **Query Parameters**: None
- **Body** (JSON):
  ```json
  {
    "url": "string"
  }
  ```
  - **url**: The URL to analyze (must be valid HTTP or HTTPS URL)
  - **Constraints**: 
    - Maximum length: 2048 characters
    - Must be properly encoded (no encoding needed in JSON string)
    - Schemes allowed: `http://`, `https://`
    - Schemes blocked: `javascript:`, `data:`, `file:`, `vbscript:`, etc.

#### Response
- **Success** (HTTP 200):
  ```json
  {
    "status": "safe"|"flagged"|"caution",
    "riskScore": number,
    "reasons": [string],
    "virusTotal": {
      "stats": {
        "harmless": number,
        "malicious": number,
        "suspicious": number,
        "undetected": number
      },
      "reportUrl": "string"
    }
  }
  ```
  
  Field Descriptions:
  - **status**: 
    - `"safe"`: No threats detected (0-1 vendor flags)
    - `"flagged"`: Multiple vendors (2+) flagged as malicious
    - `"caution"`: Exactly one vendor flagged as suspicious
  - **riskScore**: Integer count of vendors flagging the URL as malicious or suspicious (0-70+)
  - **reasons**: Array of human-readable strings explaining the assessment
  - **virusTotal.stats**: Raw counts from VirusTotal analysis
  - **virusTotal.reportUrl**: URL to view the detailed VirusTotal report

- **Client Error** (HTTP 400):
  ```json
  {
    "status": "error",
    "reason": "Invalid request: [specific issue]"
  }
  ```
  Causes: Missing URL, malformed URL, disallowed scheme, missing required headers

- **Authentication Error** (HTTP 401):
  ```json
  {
    "status": "error",
    "reason": "Unauthorized: Missing or invalid API key"
  }
  ```
  Causes: Missing `x-vt-api-key` header, empty key, key format invalid

- **Service Error** (HTTP 502/503/504):
  ```json
  {
    "status": "error",
    "reason": "Service unavailable: [specific issue]"
  }
  ```
  Causes: 
  - Backend unable to reach VirusTotal API
  - VirusTotal API rate limiting (429 from VT)
  - VirusTotal API downtime
  - Network connectivity issues

- **Internal Error** (HTTP 500):
  ```json
  {
    "status": "error",
    "reason": "Internal server error"
  }
  ```
  Causes: Unexpected server-side exceptions

#### Examples

**Example 1: Safe URL**
**Request**:
```
POST /api/url-reputation
Content-Type: application/json
x-vt-api-key: abcd1234efgh5678ijkl9012mnop3456qrst7890

{
  "url": "https://www.wikipedia.org/"
}
```

**Response**:
```
HTTP 200 OK
Content-Type: application/json

{
  "status": "safe",
  "riskScore": 0,
  "reasons": [
    "No threats detected by security vendors"
  ],
  "virusTotal": {
    "stats": {
      "harmless": 65,
      "malicious": 0,
      "suspicious": 0,
      "undetected": 3
    },
    "reportUrl": "https://www.virustotal.com/gui/url/aHR0cHM6Ly93d3cud2lraWcijeS5vcmcvLw"
  }
}
```

**Example 2: Malicious URL (Phishing)**
**Request**:
```
POST /api/url-reputation
Content-Type: application/json
x-vt-api-key: abcd1234efgh5678ijkl9012mnop3456qrst7890

{
  "url": "http://paypa1.com.security-update.net/urgent/action"
}
```

**Response**:
```
HTTP 200 OK
Content-Type: application/json

{
  "status": "flagged",
  "riskScore": 42,
  "reasons": [
    "Phishing site impersonating PayPal (detected by 42/70 engines)"
  ],
  "virusTotal": {
    "stats": {
      "harmless": 18,
      "malicious": 42,
      "suspicious": 0,
      "undetected": 10
    },
    "reportUrl": "http://www.virustotal.com/gui/url/aHR0cDovL3BheXBhMS5jb20uc2VjdXJpdHVwZGF0ZS5uZXQvdXJnZW50L2FjdGlvbg"
  }
}
```

**Example 3: Single Vendor Flag (Caution)**
**Request**:
```
POST /api/url-reputation
Content-Type: application/json
x-vt-api-key: abcd1234efgh5678ijkl9012mnop3456qrst7890

{
  "url": "https://example-blog.com/suspicious-affiliate-link"
}
```

**Response**:
```
HTTP 200 OK
Content-Type: application/json

{
  "status": "caution",
  "riskScore": 1,
  "reasons": [
    "One security vendor flagged this URL as suspicious"
  ],
  "virusTotal": {
    "stats": {
      "harmless": 58,
      "malicious": 1,
      "suspicious": 0,
      "undetected": 11
    },
    "reportUrl": "https://www.virustotal.com/gui/url/aHR0cHM6Ly9leGFtcGxlLWJsb2cuY29tL3N1c3BpY2lvdXMtYWZmaWxpYXRlLWxpbms"
  }
}
```

**Example 4: Invalid Request**
**Request**:
```
POST /api/url-reputation
Content-Type: application/json
x-vt-api-key: abcd1234efgh5678ijkl9012mnop3456qrst7890

{
  "url": "javascript:alert('xss')"
}
```

**Response**:
```
HTTP 400 Bad Request
Content-Type: application/json

{
  "status": "error",
  "reason": "Invalid URL scheme: Only http and https schemes are allowed"
}
```

**Example 5: Missing API Key**
**Request**:
```
POST /api/url-reputation
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response**:
```
HTTP 401 Unauthorized
Content-Type: application/json

{
  "status": "error",
  "reason": "Unauthorized: Missing API key in request headers"
}
```

## Implementation Notes

### Request Processing Flow
1. **Header Validation**: 
   - Check for `Content-Type: application/json`
   - Extract `x-vt-api-key` header
2. **Body Parsing**: 
   - Parse JSON body
   - Validate presence and type of `url` field
3. **URL Validation**: 
   - Check if string is valid URL
   - Verify scheme is `http` or `https`
   - Reject `javascript:`, `data:`, `file:` etc.
4. **API Key Validation**: 
   - Compare `x-vt-api-key` with `process.env.VT_API_KEY`
   - Reject if missing, empty, or doesn't match
5. **VirusTotal Request**: 
   - Encode URL per VT API v3 specification:
     - Base64 URL-safe encode the URL string
     - Remove padding (= characters)
   - Make GET request to `https://www.virustotal.com/api/v3/urls/{encoded_url}`
   - Set header: `x-apikey: [VT_API_KEY_FROM_ENVIRONMENT]`
6. **Response Transformation**: 
   - Map VT response to internal format
   - Calculate `riskScore` from `malicious + suspicious` counts
   - Determine `status` based on threat count:
     - 0 → "safe" (or "safe" with note if not in VT database)
     - 1 → "caution"
     - ≥2 → "flagged"
   - Format `reasons` array from VT Verbose messages or generic descriptions
   - Include `reportUrl` from VT response
7. **Error Handling**: 
   - Catch network errors, timeouts, non-2xx responses from VT
   - Convert to appropriate HTTP status and error message
   - VT 404 (URL not in database) treated as "safe" with informational reason
   - VT 429 (rate limited) treated as 503 Service Unavailable

### Data Privacy & Security
- **API Key Protection**: 
  - Key never leaves server environment
  - Not logged, not included in error messages
  - Accessible only to Node.js process
- **Data Minimization**: 
  - Only the URL is transmitted from extension to backend
  - No cookies, headers, or other browser data sent
  - URL is used solely for the VT API request
- **No Persistence**: 
  - URL is not stored beyond the request cycle
  - No logging of full URLs for privacy reasons
  - Only anonymized statistics (counts) may be retained for metrics
- **Input Sanitization**: 
  - URL validation prevents injection attacks
  - JSON parsing protects against malformed payloads
  - Header values validated to prevent header injection

### Performance Characteristics
- **Request Handling Overhead**: <10ms (excluding VT API call)
- **VT API Dependency**: 90%+ of response time comes from external API
- **Concurrent Requests**: Limited by Node.js event loop and VT rate limits
- **Timeouts**: 
  - Outbound VT API call: 6 seconds (configurable)
  - Incremental backoff not implemented (fail fast preferred)
- **Caching**: 
  - No built-in caching (design choice to ensure fresh data)
  - Extension implements client-side caching (10-minute TTL)
  - Server-side caching could be added in future via Redis

### Extensibility
Adding new endpoints would follow similar patterns:
1. Define route in `server.js`
2. Implement handler function with validation
3. Integrate with external services or internal logic
4. Ensure consistent error handling and response formatting
5. Update API documentation accordingly

## Version Information
- **API Version**: Implicit v1 (no versioning in path; would add `/api/v1/` if needed)
- **Documentation Date**: 2024-07-11
- **Backend Version**: Corresponds to `backend/package.json` version
- **Compatible Extension Versions**: 
  - Requires extension capable of sending `x-vt-api-key` header
  - Works with all extension versions that implement this header format

## Contact & Support
For API-related questions or issues:
- Consult the backend source code (`backend/server.js`)
- Review integration with extension (`background/reputationClient.js`)
- Check deployment logs for error details
- Contact platform administrator for hosting-specific concerns