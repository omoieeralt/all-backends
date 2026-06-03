require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'account_manager',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Sync GET endpoint: Retrieve encrypted blob for a Sync ID
app.get('/sync/:syncId', async (req, res) => {
  try {
    const { syncId } = req.params;
    const [rows] = await pool.query('SELECT encrypted_blob, updated_at FROM user_data WHERE user_id = ?', [syncId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No data found for this Sync ID' });
    }
    
    res.json({
      data: rows[0].encrypted_blob,
      updatedAt: rows[0].updated_at
    });
  } catch (error) {
    console.error('Error fetching sync data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync POST endpoint: Save encrypted blob for a Sync ID
app.post('/sync/:syncId', async (req, res) => {
  try {
    const { syncId } = req.params;
    const { encryptedBlob } = req.body;
    
    if (!encryptedBlob) {
      return res.status(400).json({ error: 'Missing encryptedBlob' });
    }
    
    // Upsert into MySQL
    await pool.query(
      `INSERT INTO user_data (user_id, encrypted_blob) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE encrypted_blob = ?, updated_at = CURRENT_TIMESTAMP`,
      [syncId, encryptedBlob, encryptedBlob]
    );
    
    res.json({ success: true, message: 'Data synced successfully' });
  } catch (error) {
    console.error('Error saving sync data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sync Server running on port ${PORT}`);
});
