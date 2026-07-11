require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/url-reputation', async (req, res) => {
  const vtApiKey = req.headers['x-vt-api-key'];
  
  if (!vtApiKey) {
    return res.status(401).json({ 
      status: 'unavailable', 
      reason: 'Unauthorized: Missing VirusTotal API Key in extension settings.' 
    });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // VirusTotal API v3 requires base64url encoded URL
    const b64Url = Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    console.log(`Checking reputation for: ${url}`);
    
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${b64Url}`, {
      method: 'GET',
      headers: {
        'x-apikey': vtApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Not found in VT database, treat as safe/pending
        return res.json({ 
          status: 'safe', 
          riskScore: 0, 
          reasons: ['URL not found in threat database.'],
          virusTotal: { found: false }
        });
      }
      throw new Error(`VT API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const stats = data.data.attributes.last_analysis_stats;
    const reportUrl = `https://www.virustotal.com/gui/url/${b64Url}/detection`;
    
    const totalSuspicious = stats.malicious + stats.suspicious;
    
    let status = 'safe';
    let reasons = [];
    
    if (totalSuspicious >= 2) {
      status = 'flagged';
      reasons.push(`VirusTotal flagged this URL (Malicious: ${stats.malicious}, Suspicious: ${stats.suspicious})`);
    } else if (totalSuspicious === 1) {
      status = 'caution';
      reasons.push(`One security vendor flagged this URL as suspicious.`);
    }

    return res.json({
      status,
      riskScore: totalSuspicious,
      reasons,
      virusTotal: {
        stats,
        reportUrl
      }
    });

  } catch (error) {
    console.error('Error checking reputation:', error);
    return res.status(500).json({ 
      status: 'unavailable', 
      reason: 'Failed to contact reputation engine.' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI Phishing Defense Backend running on http://localhost:${PORT}`);
  console.log(`Ready to accept proxied VirusTotal API keys.`);
});
