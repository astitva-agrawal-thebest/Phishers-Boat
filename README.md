# AI Phishing Defense

## One-line elevator pitch
A hybrid AI-powered browser extension that provides real-time phishing detection by combining local heuristic analysis with cloud-based reputation checking.

## Problem Statement
Phishing attacks continue to be a prevalent threat, tricking users into revealing sensitive information through fraudulent websites and emails. Traditional blacklist-based approaches are insufficient against zero-day attacks and sophisticated spoofed sites. Users need a solution that can detect novel phishing attempts without relying solely on outdated databases.

## Solution
AI Phishing Defense implements a dual-layer protection system:
1. **Local Heuristic Engine**: A lightweight, offline model that analyzes URL structure and page content for phishing indicators using statistical features derived from phishing datasets.
2. **Cloud Reputation Engine**: A privacy-preserving proxy to VirusTotal API that checks URLs against multiple security vendors for known threats.

The extension runs both engines in parallel, providing immediate local feedback while leveraging cloud intelligence for comprehensive threat detection.

## Features
- Real-time scanning of web pages, URLs, and QR codes
- Local heuristic analysis for zero-day threat detection
- Cloud-based reputation checking via VirusTotal (API key required)
- Visual security indicators (badge and banner) in the browser
- Manual URL and QR code scanning via popup interface
- Session-based tracking of flagged and safe websites
- Manual whitelisting/blacklisting of domains for personalized control
- Lightweight and privacy-focused (API keys never leave the browser except to the user's own backend)

## Screenshots
![Popup Interface](documentation/assets/popup.png)
*Popup showing protection status, statistics, and manual scanner*

![Security Banner](documentation/assets/banner.png)
*In-page warning banner indicating a threats detected*

![Session Management](documentation/assets/session.png)
*Session view showing flagged and safe sites*

## Architecture Overview
The system consists of two main components:
1. **Browser Extension** (Chrome/Edge/Firefox): Handles content interception, local analysis, UI presentation, and communication with the backend.
2. **Backend Server** (Node.js/Express): Acts as a secure proxy to VirusTotal API, preventing exposure of the API key in the client-side code.

## Tech Stack
### Frontend (Extension)
- HTML5, CSS3, JavaScript (ES6)
- Chrome Extension APIs (Manifest V3)
- Local machine learning model (JSON-based weights)

### Backend
- Node.js
- Express.js
- CORS middleware
- Dotenv for environment variables
- Fetch API for VirusTotal communication

## Installation
### Development Setup
1. Clone the repository
2. For the extension:
   - No npm dependencies required (plain JavaScript)
   - Load `ai-phishing-extension` folder as an unpacked extension in Chrome/Edge
   - Enable Developer mode and click "Load unpacked"
3. For the backend:
   ```bash
   cd backend
   npm install
   ```
4. Obtain a VirusTotal API key and add it to the backend `.env` file:
   ```
   VT_API_KEY=your_virustotal_api_key_here
   ```

### Running Locally
1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```
   Server will run on `http://localhost:3000`
2. Load the extension in your browser (as described above)
3. The extension will automatically communicate with the local backend

## Environment Variables
### Backend (`.env` file)
| Variable | Required? | Description | Example |
|----------|-----------|-------------|---------|
| `VT_API_KEY` | Yes | VirusTotal API key for reputation checking | `your_actual_api_key_here` |
| `PORT` | No | Port for the backend server (defaults to 3000) | `3000` |

## Folder Structure
```
ai-phishing-extension/
├── manifest.json          # Extension manifest (V3)
├── background/            # Service worker and background logic
│   ├── scanner.js         # Main scanning pipeline (local + cloud)
│   ├── reputationClient.js# Backend communication layer
│   └── model_weights.json # Pre-trained local model weights
├── content/               # Content scripts injected into web pages
│   ├── injector.js        # Page scanner and message passer
│   └── injector.css       # Styling for warning banners
├── popup/                 # Extension popup UI
│   ├── popup.html         # Popup structure
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup logic and state management
├── dataset/               # Training data for the local model
│   └── dataset.csv        # Phishing URL dataset
├── assets/                # Icons and images
├── train_model.py         # Script to train the local model
├── train_vanilla.py       # Baseline training script
└── get-pip.py             # Helper script for Python setup

backend/
├── server.js              # Express server with VirusTotal proxy
├── package.json           # Node.js dependencies and scripts
├── package-lock.json      # Dependency lockfile
└── .env                   # Environment variables (VT_API_KEY)
```

## Demo
To see the extension in action:
1. Visit a known phishing test site (e.g., http://philishaptest.com/)
2. Observe the banner turning red and displaying a warning
3. Check the popup for detailed statistics and threat information
4. Use the manual scanner to check any URL or upload a QR code

## Deployment
### Extension
- Package the `ai-phishing-extension` directory and submit to browser web stores (Chrome Web Store, Firefox Add-ons, etc.)
- Ensure the `host_permissions` in manifest.json include your deployed backend domain

### Backend
- Deploy to any Node.js hosting service (Heroku, Vercel, AWS, etc.)
- Set the `VT_API_KEY` environment variable in the hosting platform
- Update the extension's `BACKEND_URL` in `background/reputationClient.js` to point to your deployed instance

## Team
- [Your Name] - Lead Developer
- [Your Name] - Security Researcher
- [Your Name] - Full Stack Engineer

## License
This project is licensed under the MIT License - see the [LICENSE](documentation/license.md) file for details.