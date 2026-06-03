require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configuration
const PHP_PROXY_URL = process.env.PHP_PROXY_URL || 'https://your-website.com/db_proxy.php';
const PROXY_SECRET = process.env.PROXY_SECRET || 'CHANGE_ME_TO_A_LONG_SECRET_STRING';

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', proxyTarget: PHP_PROXY_URL, timestamp: new Date() });
});

// Sync GET endpoint: Retrieve encrypted blob for a Sync ID via PHP proxy
app.get('/sync/:syncId', async (req, res) => {
  try {
    const { syncId } = req.params;
    
    // Using dynamic import for fetch since node-fetch isn't installed and native fetch is available in modern Node.
    // If running Node < 18, this might require 'node-fetch'
    const proxyResponse = await fetch(`${PHP_PROXY_URL}?syncId=${syncId}`, {
      method: 'GET',
      headers: {
        'X-Proxy-Secret': PROXY_SECRET
      }
    });

    const data = await proxyResponse.json();
    
    if (!proxyResponse.ok) {
      return res.status(proxyResponse.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching sync data via proxy:', error);
    res.status(500).json({ error: 'Internal server error while communicating with database proxy' });
  }
});

// Sync POST endpoint: Save encrypted blob for a Sync ID via PHP proxy
app.post('/sync/:syncId', async (req, res) => {
  try {
    const { syncId } = req.params;
    const { encryptedBlob } = req.body;
    
    if (!encryptedBlob) {
      return res.status(400).json({ error: 'Missing encryptedBlob' });
    }
    
    const proxyResponse = await fetch(PHP_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': PROXY_SECRET
      },
      body: JSON.stringify({ syncId, encryptedBlob })
    });

    const data = await proxyResponse.json();
    
    if (!proxyResponse.ok) {
      return res.status(proxyResponse.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error saving sync data via proxy:', error);
    res.status(500).json({ error: 'Internal server error while communicating with database proxy' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sync Server running on port ${PORT}`);
});
