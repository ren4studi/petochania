const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    fs.mkdirSync('uploads/cats');
    fs.mkdirSync('uploads/gallery');
    fs.mkdirSync('uploads/reviews');
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads/';
        if (req.baseUrl.includes('cats')) folder += 'cats/';
        else if (req.baseUrl.includes('gallery')) folder += 'gallery/';
        else if (req.baseUrl.includes('reviews')) folder += 'reviews/';
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Simple in-memory database (replace with real database in production)
let database = {
    users: [{ id: 1, username: 'admin', password: bcrypt.hashSync('admin', 10) }],
    cats: [],
    gallery: [],
    faq: [],
    reviews: [],
    settings: {
        siteTitle: "Petochania",
        siteDescription: "Питомник элитных кошек",
        contactPhone: "8 926 150 2870",
        contactEmail: "",
        socialLinks: [
            { name: "Telegram", url: "https://t.me/tata_procats" },
            { name: "WhatsApp", url: "https://wa.me/message/Y4ZYRHELPNHUE1" },
            { name: "VK", url: "https://vk.com/petochania" },
            { name: "Facebook", url: "https://www.facebook.com/share/1A33qj8Nbm/?mibextid=wwXIfr" },
            { name: "TikTok", url: "https://www.tiktok.com/@tata.vygodnaya?_t=ZS-90PLbDoj2kE&_r=1" },
            { name: "Instagram", url: "https://www.instagram.com/petochania?igsh=MWR3bHhpNjhnd3g3dw%3D%3D&utm_source=qr" }
        ]
    }
};

// Load data from file if exists
if (fs.existsSync('database.json')) {
    try {
        const data = fs.readFileSync('database.json', 'utf8');
        database = JSON.parse(data);
    } catch (error) {
        console.log('Error loading database, using default data');
    }
}

// Save data to file
function saveDatabase() {
    fs.writeFileSync('database.json', JSON.stringify(database, null, 2));
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Auth routes
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const user = database.users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    try {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Cats routes
app.get('/api/cats', (req, res) => {
    res.json(database.cats);
});

app.post('/api/cats', authenticateToken, upload.array('images', 10), (req, res) => {
    const catData = JSON.parse(req.body.data || '{}');
    const images = req.files ? req.files.map(file => `/uploads/cats/${file.filename}`) : [];

    const newCat = {
        id: Date.now(),
        ...catData,
        images,
        createdAt: new Date().toISOString()
    };

    database.cats.push(newCat);
    saveDatabase();
    res.json(newCat);
});

app.put('/api/cats/:id', authenticateToken, upload.array('images', 10), (req, res) => {
    const catId = parseInt(req.params.id);
    const catData = JSON.parse(req.body.data || '{}');
    const newImages = req.files ? req.files.map(file => `/uploads/cats/${file.filename}`) : [];

    const catIndex = database.cats.findIndex(cat => cat.id === catId);
    if (catIndex === -1) {
        return res.status(404).json({ error: 'Cat not found' });
    }

    // Merge existing images with new ones
    const existingImages = database.cats[catIndex].images || [];
    const allImages = [...existingImages, ...newImages];

    database.cats[catIndex] = {
        ...database.cats[catIndex],
        ...catData,
        images: allImages,
        updatedAt: new Date().toISOString()
    };

    saveDatabase();
    res.json(database.cats[catIndex]);
});

app.delete('/api/cats/:id', authenticateToken, (req, res) => {
    const catId = parseInt(req.params.id);
    const catIndex = database.cats.findIndex(cat => cat.id === catId);
    
    if (catIndex === -1) {
        return res.status(404).json({ error: 'Cat not found' });
    }

    database.cats.splice(catIndex, 1);
    saveDatabase();
    res.json({ message: 'Cat deleted successfully' });
});

// Gallery routes
app.get('/api/gallery', (req, res) => {
    res.json(database.gallery);
});

app.post('/api/gallery', authenticateToken, upload.single('image'), (req, res) => {
    const galleryData = JSON.parse(req.body.data || '{}');
    const image = req.file ? `/uploads/gallery/${req.file.filename}` : '';

    const newItem = {
        id: Date.now(),
        ...galleryData,
        image,
        createdAt: new Date().toISOString()
    };

    database.gallery.push(newItem);
    saveDatabase();
    res.json(newItem);
});

app.put('/api/gallery/:id', authenticateToken, upload.single('image'), (req, res) => {
    const galleryId = parseInt(req.params.id);
    const galleryData = JSON.parse(req.body.data || '{}');
    const newImage = req.file ? `/uploads/gallery/${req.file.filename}` : '';

    const galleryIndex = database.gallery.findIndex(item => item.id === galleryId);
    if (galleryIndex === -1) {
        return res.status(404).json({ error: 'Gallery item not found' });
    }

    // Keep existing image if no new one provided
    const image = newImage || database.gallery[galleryIndex].image;

    database.gallery[galleryIndex] = {
        ...database.gallery[galleryIndex],
        ...galleryData,
        image,
        updatedAt: new Date().toISOString()
    };

    saveDatabase();
    res.json(database.gallery[galleryIndex]);
});

app.delete('/api/gallery/:id', authenticateToken, (req, res) => {
    const galleryId = parseInt(req.params.id);
    const galleryIndex = database.gallery.findIndex(item => item.id === galleryId);
    
    if (galleryIndex === -1) {
        return res.status(404).json({ error: 'Gallery item not found' });
    }

    database.gallery.splice(galleryIndex, 1);
    saveDatabase();
    res.json({ message: 'Gallery item deleted successfully' });
});

// FAQ routes
app.get('/api/faq', (req, res) => {
    res.json(database.faq);
});

app.post('/api/faq', authenticateToken, (req, res) => {
    const newFaq = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };

    database.faq.push(newFaq);
    saveDatabase();
    res.json(newFaq);
});

app.put('/api/faq/:id', authenticateToken, (req, res) => {
    const faqId = parseInt(req.params.id);
    const faqIndex = database.faq.findIndex(item => item.id === faqId);
    
    if (faqIndex === -1) {
        return res.status(404).json({ error: 'FAQ item not found' });
    }

    database.faq[faqIndex] = {
        ...database.faq[faqIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
    };

    saveDatabase();
    res.json(database.faq[faqIndex]);
});

app.delete('/api/faq/:id', authenticateToken, (req, res) => {
    const faqId = parseInt(req.params.id);
    const faqIndex = database.faq.findIndex(item => item.id === faqId);
    
    if (faqIndex === -1) {
        return res.status(404).json({ error: 'FAQ item not found' });
    }

    database.faq.splice(faqIndex, 1);
    saveDatabase();
    res.json({ message: 'FAQ item deleted successfully' });
});

// Reviews routes
app.get('/api/reviews', (req, res) => {
    res.json(database.reviews);
});

app.post('/api/reviews', authenticateToken, upload.single('image'), (req, res) => {
    const reviewData = JSON.parse(req.body.data || '{}');
    const image = req.file ? `/uploads/reviews/${req.file.filename}` : '';

    const newReview = {
        id: Date.now(),
        ...reviewData,
        image,
        createdAt: new Date().toISOString()
    };

    database.reviews.push(newReview);
    saveDatabase();
    res.json(newReview);
});

app.put('/api/reviews/:id', authenticateToken, upload.single('image'), (req, res) => {
    const reviewId = parseInt(req.params.id);
    const reviewData = JSON.parse(req.body.data || '{}');
    const newImage = req.file ? `/uploads/reviews/${req.file.filename}` : '';

    const reviewIndex = database.reviews.findIndex(item => item.id === reviewId);
    if (reviewIndex === -1) {
        return res.status(404).json({ error: 'Review not found' });
    }

    // Keep existing image if no new one provided
    const image = newImage || database.reviews[reviewIndex].image;

    database.reviews[reviewIndex] = {
        ...database.reviews[reviewIndex],
        ...reviewData,
        image,
        updatedAt: new Date().toISOString()
    };

    saveDatabase();
    res.json(database.reviews[reviewIndex]);
});

app.delete('/api/reviews/:id', authenticateToken, (req, res) => {
    const reviewId = parseInt(req.params.id);
    const reviewIndex = database.reviews.findIndex(item => item.id === reviewId);
    
    if (reviewIndex === -1) {
        return res.status(404).json({ error: 'Review not found' });
    }

    database.reviews.splice(reviewIndex, 1);
    saveDatabase();
    res.json({ message: 'Review deleted successfully' });
});

// Settings routes
app.get('/api/settings', (req, res) => {
    res.json(database.settings);
});

app.put('/api/settings', authenticateToken, (req, res) => {
    database.settings = { ...database.settings, ...req.body };
    saveDatabase();
    res.json(database.settings);
});

// User routes
app.put('/api/user', authenticateToken, async (req, res) => {
    const { username, password } = req.body;
    
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        database.users[0].password = hashedPassword;
    }
    
    if (username) {
        database.users[0].username = username;
    }
    
    saveDatabase();
    res.json({ message: 'User updated successfully' });
});

// Serve static files
app.use(express.static('.'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin panel: ${BASE_URL}/admin-panel-backend.html`);
    console.log(`Main site: ${BASE_URL}/index.html`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});