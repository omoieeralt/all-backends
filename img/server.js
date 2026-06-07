const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Set up multer to store uploaded files temporarily
const upload = multer({ dest: 'uploads/' });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Ensure the environment variables are set or fallback to defaults (for Render)
const PORT = process.env.PORT || 4000;
const IMGBOX_COOKIE = process.env.IMGBOX_COOKIE || '';
const GALLERY_ID = process.env.GALLERY_ID || '';

/**
 * 1. Test Endpoint
 * Allows the frontend/PHP to verify this backend is online and configured properly.
 */
app.get('/test', async (req, res) => {
    try {
        // We do a quick fetch to imgbox to see if we can reach it
        const response = await axios.get('https://imgbox.com/', {
            headers: { 'Cookie': IMGBOX_COOKIE }
        });
        const $ = cheerio.load(response.data);
        const token = $('meta[name="csrf-token"]').attr('content');

        if (token) {
            res.json({
                status: 'online',
                message: 'Imgbox Backend is fully operational and can reach Imgbox!',
                hasCookie: IMGBOX_COOKIE.length > 0,
                hasGallery: GALLERY_ID.length > 0
            });
        } else {
            res.status(500).json({ status: 'error', message: 'Failed to extract CSRF token from Imgbox.' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * 2. Upload Endpoint
 * Receives file from PHP/Frontend and uploads to Imgbox "eh" gallery.
 */
app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
    }

    const filePath = path.join(__dirname, req.file.path);

    try {
        // Step 1: Get CSRF Token
        const tokenRes = await axios.get('https://imgbox.com/', {
            headers: { 'Cookie': IMGBOX_COOKIE }
        });
        
        // Extract cookies to maintain session
        let sessionCookies = IMGBOX_COOKIE;
        if (tokenRes.headers['set-cookie']) {
            const newCookies = tokenRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
            if (sessionCookies) sessionCookies += '; ' + newCookies;
            else sessionCookies = newCookies;
        }

        const $ = cheerio.load(tokenRes.data);
        const token = $('meta[name="csrf-token"]').attr('content');

        if (!token) throw new Error('Could not retrieve CSRF token from Imgbox.');

        // Step 2: Upload Image to Imgbox
        const formData = new FormData();
        formData.append('authenticity_token', token);
        formData.append('gallery_id', GALLERY_ID);
        formData.append('gallery_secret', '');
        formData.append('comments_enabled', '0');
        formData.append('content_type', '1'); // 1 = family safe
        formData.append('files[]', fs.createReadStream(filePath));

        const uploadRes = await axios.post('https://imgbox.com/upload/process', formData, {
            headers: {
                ...formData.getHeaders(),
                'Cookie': sessionCookies,
                'X-CSRF-Token': token,
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://imgbox.com',
                'Referer': 'https://imgbox.com/'
            }
        });

        // Step 3: Delete local temp file
        fs.unlinkSync(filePath);

        if (uploadRes.data && uploadRes.data.files && uploadRes.data.files.length > 0) {
            const uploadedFile = uploadRes.data.files[0];
            res.json({
                success: true,
                original_url: uploadedFile.original_url,
                thumbnail_url: uploadedFile.thumbnail_url,
                delete_url: uploadedFile.delete_url
            });
        } else {
            res.status(500).json({ success: false, error: 'Imgbox API response was empty or invalid', data: uploadRes.data });
        }

    } catch (error) {
        // Ensure local file is deleted even if upload fails
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Imgbox Custom API running on port ${PORT}`);
});
