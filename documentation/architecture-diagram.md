# Architecture Diagram

```mermaid
graph TD
    %% User and Browser Layer
    subgraph Client[User Browser]
        direction TB
        subgraph Tab1[Browser Tab]
            CS1[Content Script] -->|Extracts page data| BS[Background Service Worker]
            BS -->|Shows banner/injects CS| CS1
        end
        
        subgraph Tab2[Browser Tab]
            CS2[Content Script] -->|Extracts page data| BS
            BS -->|Shows banner/injects CS| CS2
        end
        
        subgraph Popup[Extension Popup]
            PU[Popup UI] <--->|User actions & status| BS
        end
        
        SS1["Session Storage (temporary lists)"]
        LS1["Local Storage (settings & API key)"]
        BS -->|Updates| TB[Toolbar Badge]
    end
    
    %% Communication
    BS -->|HTTP POST| Backend[Backend Server]
    Backend -->|JSON Response| BS
    
    %% Backend Layer
    subgraph Server[Backend Server]
        direction TB
        ES[Express Server] -->|Routes to| EP["/api/url-reputation Endpoint"]
        EP -->|Validates| RV[Request Validator]
        RV -->|Proxy to| VT[VirusTotal Client]
        VT -->|HTTPS API| VTAPI[VirusTotal API]
        VTAPI -->|JSON Response| VT
        VT -->|Formats| RF[Response Formatter]
        RF -->|Sends back| ES
        EV[Environment Variables] -->|Contains| VT_API_KEY
        VT_API_KEY -->|Used by| VT
    end
    
    %% Styling
    classDef component fill:#f9f9f0,stroke:#333,stroke-width:1px
    classDef storage fill:#e6f7ff,stroke:#1890ff,stroke-width:1px
    classDef ui fill:#fff7e6,stroke:#d9ad33,stroke-width:1px;
    classDef server fill:#f6ffed,stroke:#52c41a,stroke-width:1px;
    classDef external fill:#fff1f0,stroke:#ff4d4f,stroke-width:1px;
    
    class CS1,CS2,BS,TB component;
    class SS1,LS1 storage;
    class PU ui;
    class ES,EP,RV,VT,RF server;
    class VTAPI external;
```

## Component Descriptions

### Client-Side Components
- **Content Scripts**: Injected into web pages to gather textual content and links for analysis
- **Background Service Worker**: Central orchestrator that manages the analysis pipeline, state, and communication
- **Extension Popup**: User interface for manual controls, settings, and detailed scan results
- **Toolbar Badge**: Visual indicator in browser toolbar showing current tab security status
- **Session Storage**: Browser storage for temporary trust/blocklists (cleared on browser exit)
- **Local Storage**: Browser storage for persistent settings like API key and preferences

### Server-Side Components
- **Express Server**: Node.js web framework handling HTTP requests
- **API Endpoint**: RESTful interface (`/api/url-reputation`) for URL reputation checking
- **Request Validator**: Validates incoming requests (URL format, required parameters)
- **VirusTotal Client**: Handles secure communication with VirusTotal API using server-side API key
- **Response Formatter**: Transforms VirusTotal responses into consistent format for extension
- **Environment Variables**: Secure storage for sensitive configuration like API keys

### External Service
- **VirusTotal API**: Industry-standard threat intelligence platform aggregating results from 70+ security engines

## Data Flow
1. **Collection**: Content scripts extract page information and send to background worker
2. **Local Analysis**: Background worker runs immediate heuristic analysis on collected data
3. **Cloud Check**: Background worker asynchronously queries backend for reputation check
4. **Backend Processing**: Server securely forwards request to VirusTotal using server-side API key
5. **Result Fusion**: Background worker combines local and remote results using priority logic
6. **User Feedback**: Background worker updates toolbar icon and triggers banner display via content scripts
7. **Session Tracking**: Security decisions recorded in session storage for history and statistics
