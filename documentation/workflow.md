# Workflow

## Overview
This document illustrates key workflows in the AI Phishing Defense system using Mermaid sequence diagrams.

## 1. Automatic Page Scan Workflow
*Triggered when user navigates to a new page or significant DOM changes occur*

```mermaid
sequenceDiagram
    participant User
    participant Content as Content Script
    participant Background as Background Service Worker
    participant Backend as Backend Server
    participant VT as VirusTotal API

    User->>+Content: Navigate to URL or DOM change
    Content->>+Content: Extract page text and links (debounced)
    Content->>+Background: sendMessage({action: 'checkPageContent', content})
    
    alt Cache Hit
        Background->>+Background: Check session cache for URL
        Background-->>-Background: Return cached result
    else Cache Miss
        par Local Analysis
            Background->>+Background: analyzeWithLocalModel(content, url)
            Background-->>-Background: Local result
        and Cloud Analysis (Async)
            Background->>+Backend: HTTP POST /api/url-reputation
            Backend->>+VT: GET /api/v3/urls/{id}
            VT-->>-Backend: JSON response
            Backend-->>-Background: Formatted JSON
        end
        
        Background->>+Background: finalizeVerdict(localResult, cloudResult)
        Background->>+Background: Cache result in session storage
        Background->>+Background: Update statistics (scanned/blocked)
        Background->>+Content: showBanner(reason, type)
        Background->>+Popup: Update badge via messaging
    end
    
    Content->>+Content: Display security banner if threat detected
    Content-->>-User: Visual feedback via banner/tooltip
    Background-->>-Popup: Update toolbar badge (color/text)
    User->>+Popup: View details if desired
    Popup-->>-User: Show detailed scan results
```

## 2. Manual URL Scan Workflow
*Triggered when user enters URL in popup scanner*

```mermaid
sequenceDiagram
    participant User
    participant Popup as Extension Popup
    participant Background as Background Service Worker
    participant Backend as Backend Server
    participant VT as VirusTotal API

    User->>+Popup: Enter URL and click Scan
    Popup->>Popup: Validate URL format
    Popup->>+Background: sendMessage(scanExternalUrl)

    par Local Analysis
        Background->>Background: Analyze URL locally
        Background-->>Background: Local analysis result
    and Cloud Analysis
        Background->>+Backend: POST /api/url-reputation
        Backend->>+VT: GET /api/v3/urls/{id}
        VT-->>-Backend: JSON response
        Backend-->>-Background: Reputation result
    end

    Background->>Background: Combine local and cloud results
    Background-->>-Popup: Return combined result

    Popup->>Popup: Render threat level
    Popup->>Popup: Render explanation
    Popup->>Popup: Render vendor breakdown
    Popup->>Popup: Render Trust and Block buttons
    Popup->>Popup: Render report link

    Popup-->>-User: Display scan results

    User->>+Popup: Select optional action

    alt Trust URL
        Popup->>+Background: Add URL to trusted list
        Background->>Background: Update session storage
        Background-->>-Popup: Success
    else Block URL
        Popup->>+Background: Add URL to blocked list
        Background->>Background: Update session storage
        Background->>Background: Update statistics
        Background-->>-Popup: Success
    else View Report
        Popup-->>User: Open detailed report
    end
```

## 3. Trust/Block Decision Workflow
*Triggered when user manually trusts or blocks a site*

```mermaid
sequenceDiagram
    participant User
    participant Popup as Extension Popup
    participant Background as Background Service Worker

    User->>+Popup: Click Trust/Block button in banner or popup
    Popup->>+Background: sendMessage({action: 'updateSessionList', hostname, action})
    
    alt Trust Action
        Background->>+Background: Move hostname from flagged to non-flagged list
    else Block Action
        Background->>+Background: Move hostname from non-flagged to flagged list
    end
    
    Background->>+Background: Update timestamp and mark as manual
    Background->>+Background: Save updated lists to session storage
    Background->>+Popup: Confirm lists updated
    Popup->>+Popup: Refresh lists view and show confirmation
    alt Current tab affected
        Background->>+Content: Re-evaluate tab status if needed
        Content->>+Content: Update banner if status changed
    end
    Popup-->>-User: Visual confirmation of action
```

## 4. QR Code Scan Workflow
*Triggered when user uploads QR code image*

```mermaid
sequenceDiagram
    participant User
    participant Popup as Extension Popup
    participant Background as Background Service Worker
    participant Backend as Backend Server
    participant VT as VirusTotal API

    User->>+Popup: Upload QR code image
    Popup->>+Popup: Decode image to extract data
    alt Valid URL detected
        Popup->>+Background: sendMessage({action: 'scanExternalUrl', url: decodedUrl})
        par Local Analysis
            Background->>+Background: analyzeWithLocalModel(decodedUrl, decodedUrl)
            Background-->>-Background: Local result
        and Cloud Analysis
            Background->>+Backend: HTTP POST /api/url-reputation
            Backend->>+VT: GET /api/v3/urls/{id}
            VT-->>-Backend: JSON response
            Backend-->>-Background: Formatted JSON
        end
        
        Background->>+Background: Combine results
        Background-->>-Popup: Return combined result
        Popup->>+Popup: Render result with QR-specific context
        Popup-->>-User: Display scan results
    else Invalid or non-URL data
        Popup->>+Popup: Show error: "QR code does not contain a valid URL"
    end
```

## 5. Settings Update Workflow
*Triggered when user changes extension settings*

```mermaid
sequenceDiagram
    participant User
    participant Popup as Extension Popup
    participant Background as Background Service Worker

    User->>+Popup: Modify settings (API key, preferences)
    Popup->>+Background: sendMessage({action: 'saveSettings', settings})
    
    alt API Key Changed
        Background->>+Background: Validate key format
        Background->>+Background: Store in localStorage
        Background->>+Background: Test key with dummy request (optional)
        Background-->>-Background: Validation result
    else Other Preferences
        Background->>+Background: Update relevant settings
    end
    
    Background->>+Background: Save all settings to localStorage
    Background-->>-Popup: Confirm save successful
    Popup->>+Popup: Show success message and reset form
    Popup-->>-User: Visual confirmation of saved settings
```

## 6. Error Handling Workflow
*Illustrates graceful degradation when services unavailable*

```mermaid
sequenceDiagram
    participant User
    participant Content as Content Script
    participant Background as Background Service Worker
    participant Backend as Backend Server
    participant Popup

    User->>Content: Navigate to URL
    Content->>Content: Extract page data
    Content->>Background: sendMessage({action: "checkPageContent", content})

    Background->>Background: Start local analysis
    Background->>Background: analyzeWithLocalModel(content, url)

    Background->>Backend: HTTP POST /api/url-reputation

    alt Backend/Network Failure
        Backend-->>Background: Error / Timeout
        Background->>Background: Log error and mark cloud unavailable
        Background->>Background: Use local result with degraded notice
        Background->>Content: Show warning banner (yellow)
        Background->>Popup: Update badge (yellow)
    else Backend Success
        Backend-->>Background: Valid response
        Background->>Background: finalizeVerdict(localResult, cloudResult)
    end

    Background->>Background: Update statistics and cache
    Background->>Content: Display final banner
    Background->>Popup: Update toolbar badge
```

## Workflow Notes

### Timing Characteristics
- **Local Analysis**: Typically 10-50ms
- **Cloud Analysis**: 1000-3000ms (network dependent)
- **UI Updates**: <16ms to maintain 60fps responsiveness
- **Cache Lookup**: <1ms for session storage access

### Error Resilience
All workflows include:
- Timeout handling (6-second limit for cloud requests)
- Fallback to local-only mode when backend unavailable
- Clear user feedback about degradation status
- Automatic recovery when connectivity restored

### Privacy Considerations
- No personal data transmitted beyond URL and content snippets
- API keys never leave the user's controlled environment
- Session data stored только locally and cleared on browser exit
- All analytics are opt-in and anonymized

## Extending Workflows
To add new workflows:
1. Follow existing message patterns in popup/ and background/
2. Maintain consistent error handling and user feedback
3. Update storage schemas with backward compatibility
4. Ensure all new workflows respect privacy guarantees
5. Test workflow interactions with existing features
