const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 4000;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'imgbb-relay-backend' });
});

app.get('/test', async (req, res) => {
    try {
        res.json({
            status: 'online',
            message: 'ImgBB Relay Backend is fully operational!',
            hasApiKey: !!IMGBB_API_KEY
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
    }

    const filePath = path.join(__dirname, req.file.path);

    try {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(filePath));
        
        // ImgBB API docs do not support an album ID natively via the v1 API
        // But we relay the upload through this backend per user request!

        const uploadRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        fs.unlinkSync(filePath);

        if (uploadRes.data && uploadRes.data.success) {
            res.json({
                success: true,
                original_url: uploadRes.data.data.url,
                thumbnail_url: uploadRes.data.data.thumb.url,
                delete_url: uploadRes.data.data.delete_url
            });
        } else {
            res.status(500).json({ success: false, error: 'ImgBB API response was invalid', data: uploadRes.data });
        }

    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error("ImgBB Upload Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`ImgBB Relay API running on port ${PORT}`);
});
