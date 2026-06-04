require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Setup Aiven Database Connection
// Aiven requires SSL, so we pass ssl: { rejectUnauthorized: true }
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 2. Automatically create the table if it doesn't exist!
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id VARCHAR(255) PRIMARY KEY,
        encrypted_blob LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Database connected and table initialized successfully!");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
}
initDB();

// 3. API Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date() });
});

// Simple ping route to keep Render and Aiven awake
app.get('/ping', async (req, res) => {
  try {
    // A simple query keeps the Aiven MySQL database connection alive
    await pool.query('SELECT 1');
    res.status(200).send('pong');
  } catch (error) {
    console.error('Ping error:', error);
    res.status(500).send('error');
  }
});

// Sync GET
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

// Sync POST
app.post('/sync/:syncId', async (req, res) => {
  try {
    const { syncId } = req.params;
    const { encryptedBlob } = req.body;
    
    if (!encryptedBlob) {
      return res.status(400).json({ error: 'Missing encryptedBlob' });
    }
    
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
  console.log(`🚀 Sync Server running on port ${PORT}`);
});
