const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - УВЕЛИЧИВАЕМ ЛИМИТ ДЛЯ BASE64 ИЗОБРАЖЕНИЙ
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Увеличиваем лимит для JSON
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use(express.static('.'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    fs.mkdirSync('uploads/cats');
    fs.mkdirSync('uploads/breeds');
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads/';
        if (req.baseUrl.includes('cats')) folder += 'cats/';
        else if (req.baseUrl.includes('breeds')) folder += 'breeds/';
        else folder += 'other/';
        
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        fieldSize: 50 * 1024 * 1024 // 50MB limit for fields
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Database file
const DB_FILE = 'database.json';

// Initialize database
let database = {
    breedPages: {
        chinchilla: {
            title: 'Золотая Шиншилла',
            heroDescription: 'Аристократичные британцы с роскошной золотистой шерстью и королевским характером',
            description: 'Золотые шиншиллы — одна из самых красивых и редких пород кошек. Их шерсть имеет уникальный золотистый оттенок с затемнениями на кончиках, создавая эффект сияния. Эти аристократичные кошки обладают спокойным и уравновешенным характером, идеально подходят для жизни в семье.',
            origin: 'Великобритания',
            weight: '4-6 кг',
            lifespan: '12-15 лет',
            temperament: 'Спокойный, нежный',
            characteristics: ['Любопытный', 'Дружелюбный', 'Элегантный', 'Спокойный', 'Независимый'],
            mainImage: 'img/goldshinshina.JPG',
            lastUpdated: new Date().toISOString()
        },
        devon: {
            title: 'Девон-рекс',
            heroDescription: 'Энергичные и любвеобильные кошки с инопланетной внешностью и собачьим характером',
            description: 'Девон-рекс — порода домашних кошек, появившаяся в Великобритании в 1960-х годах. Эти кошки отличаются уникальной волнистой шерстью, большими ушами и выразительными глазами. Девон-рексы очень социальные и преданные кошки, которые любят быть в центре внимания.',
            origin: 'Великобритания',
            weight: '3-4.5 кг',
            lifespan: '9-15 лет',
            temperament: 'Активный, игривый',
            characteristics: ['Ласковый', 'Игривый', 'Умный', 'Общительный', 'Энергичный'],
            mainImage: '',
            lastUpdated: new Date().toISOString()
        },
        munchkin: {
            title: 'Манчкин',
            heroDescription: 'Очаровательные коротколапые кошки с уникальной внешностью и дружелюбным нравом',
            description: 'Манчкины — уникальная порода кошек с короткими лапками, появившаяся в результате естественной генетической мутации. Несмотря на короткие конечности, эти кошки очень подвижны и активны. Манчкины известны своим дружелюбным и общительным характером.',
            origin: 'США',
            weight: '3-4 кг',
            lifespan: '12-15 лет',
            temperament: 'Дружелюбный, любопытный',
            characteristics: ['Величественная', 'Умная', 'Любопытная', 'Дружелюбная', 'Общительная'],
            mainImage: '',
            lastUpdated: new Date().toISOString()
        }
    },
    cats: [],
    lastSync: null
};

// Load database from file
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const parsed = JSON.parse(data);
            
            // Merge with defaults
            database = {
                ...database,
                ...parsed,
                breedPages: {
                    ...database.breedPages,
                    ...(parsed.breedPages || {})
                },
                cats: parsed.cats || [],
                lastSync: parsed.lastSync || new Date().toISOString()
            };
            console.log('Database loaded from file');
        } else {
            console.log('No database file found, using defaults');
        }
    } catch (error) {
        console.error('Error loading database:', error);
    }
}

// Save database to file
function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
        console.log('Database saved to file');
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

// Initialize
loadDatabase();

// Auth middleware (simple check)
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    
    // Simple token check (in production use JWT)
    if (token && (token === 'Bearer admin' || token === 'Bearer demo_token')) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Helper function to save base64 image to file
function saveBase64Image(base64Data, folder = 'cats') {
    try {
        // Extract image type and data
        const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 image data');
        }
        
        const imageType = matches[1];
        const imageData = matches[2];
        const buffer = Buffer.from(imageData, 'base64');
        
        // Create filename
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${imageType}`;
        const filepath = path.join('uploads', folder, filename);
        
        // Ensure directory exists
        const dir = path.join('uploads', folder);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Save file
        fs.writeFileSync(filepath, buffer);
        
        return `/uploads/${folder}/${filename}`;
    } catch (error) {
        console.error('Error saving base64 image:', error);
        return null;
    }
}

// ========== API ROUTES ==========

// Get all data for sync
app.get('/api/sync-data', (req, res) => {
    res.json({
        breedPages: database.breedPages || {},
        cats: database.cats || [],
        lastSync: database.lastSync || new Date().toISOString()
    });
});

// Update all data (admin only)
app.post('/api/sync-data', authenticate, (req, res) => {
    try {
        const { breedPages, cats } = req.body;
        
        if (breedPages) {
            database.breedPages = breedPages;
        }
        
        if (cats) {
            // Process base64 images in cats
            const processedCats = cats.map(cat => {
                if (cat.images && Array.isArray(cat.images)) {
                    const processedImages = cat.images.map(image => {
                        // Check if it's base64
                        if (image && image.startsWith('data:image/')) {
                            const filepath = saveBase64Image(image, 'cats');
                            return filepath || image;
                        }
                        return image;
                    });
                    return { ...cat, images: processedImages };
                }
                return cat;
            });
            
            database.cats = processedCats;
        }
        
        database.lastSync = new Date().toISOString();
        
        if (saveDatabase()) {
            res.json({ success: true, message: 'Данные синхронизированы' });
        } else {
            res.status(500).json({ error: 'Ошибка сохранения данных' });
        }
    } catch (error) {
        console.error('Error in sync-data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get breed pages
app.get('/api/breed-pages', (req, res) => {
    res.json({ breedPages: database.breedPages || {} });
});

// Get specific breed page
app.get('/api/breed-pages/:id', (req, res) => {
    const breedId = req.params.id;
    const breedPage = database.breedPages[breedId];
    
    if (!breedPage) {
        return res.status(404).json({ error: 'Breed page not found' });
    }
    
    res.json(breedPage);
});

// Update breed page (admin only)
app.post('/api/breed-pages/:id', authenticate, (req, res) => {
    try {
        const breedId = req.params.id;
        const breedData = req.body;
        
        if (!database.breedPages[breedId]) {
            return res.status(404).json({ error: 'Breed page not found' });
        }
        
        // Handle base64 image for breed
        if (breedData.mainImage && breedData.mainImage.startsWith('data:image/')) {
            const filepath = saveBase64Image(breedData.mainImage, 'breeds');
            if (filepath) {
                breedData.mainImage = filepath;
            }
        }
        
        // Update breed data
        database.breedPages[breedId] = {
            ...database.breedPages[breedId],
            ...breedData,
            lastUpdated: new Date().toISOString()
        };
        
        // Parse characteristics if it's a string
        if (typeof database.breedPages[breedId].characteristics === 'string') {
            database.breedPages[breedId].characteristics = 
                database.breedPages[breedId].characteristics
                    .split(',')
                    .map(c => c.trim())
                    .filter(c => c);
        }
        
        if (saveDatabase()) {
            res.json({ breedPage: database.breedPages[breedId] });
        } else {
            res.status(500).json({ error: 'Ошибка сохранения' });
        }
    } catch (error) {
        console.error('Error updating breed page:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all cats
app.get('/api/cats', (req, res) => {
    console.log('GET /api/cats - Returning', database.cats.length, 'cats');
    res.json({ cats: database.cats || [] });
});

// Get specific cat
app.get('/api/cats/:id', (req, res) => {
    const catId = req.params.id;
    const cat = database.cats.find(c => c.id === catId);
    
    if (!cat) {
        return res.status(404).json({ error: 'Cat not found' });
    }
    
    res.json(cat);
});

// Add cat (admin only)
app.post('/api/cats', authenticate, (req, res) => {
    try {
        // ПОЛУЧАЕМ ДАННЫЕ НАПРЯМУЮ ИЗ ТЕЛА ЗАПРОСА
        const catData = req.body;
        console.log('Received cat data:', JSON.stringify(catData, null, 2));
        
        // Process base64 images
        let processedImages = [];
        if (catData.images && Array.isArray(catData.images)) {
            processedImages = catData.images.map(image => {
                // Check if it's base64
                if (image && image.startsWith('data:image/')) {
                    const filepath = saveBase64Image(image, 'cats');
                    return filepath || image;
                }
                return image;
            });
        }

        const newCat = {
            id: Date.now().toString(),
            ...catData,
            images: processedImages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        console.log('Adding new cat to database:', newCat.id, newCat.name);
        database.cats.push(newCat);
        
        if (saveDatabase()) {
            console.log('Cat saved successfully');
            res.json(newCat);
        } else {
            console.error('Failed to save database');
            res.status(500).json({ error: 'Ошибка сохранения в базе данных' });
        }
    } catch (error) {
        console.error('Error adding cat:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update cat (admin only)
app.put('/api/cats/:id', authenticate, (req, res) => {
    try {
        const catId = req.params.id;
        const catData = req.body;
        console.log('Updating cat:', catId, catData);

        const catIndex = database.cats.findIndex(cat => cat.id === catId);
        if (catIndex === -1) {
            return res.status(404).json({ error: 'Cat not found' });
        }

        // Process new base64 images
        let processedImages = [...(database.cats[catIndex].images || [])];
        if (catData.images && Array.isArray(catData.images)) {
            const newImages = catData.images.map(image => {
                // Check if it's base64
                if (image && image.startsWith('data:image/')) {
                    const filepath = saveBase64Image(image, 'cats');
                    return filepath || image;
                }
                return image;
            });
            processedImages = [...processedImages, ...newImages];
        }

        database.cats[catIndex] = {
            ...database.cats[catIndex],
            ...catData,
            images: processedImages,
            updatedAt: new Date().toISOString()
        };

        if (saveDatabase()) {
            res.json(database.cats[catIndex]);
        } else {
            res.status(500).json({ error: 'Ошибка сохранения' });
        }
    } catch (error) {
        console.error('Error updating cat:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete cat (admin only)
app.delete('/api/cats/:id', authenticate, (req, res) => {
    const catId = req.params.id;
    const catIndex = database.cats.findIndex(cat => cat.id === catId);
    
    if (catIndex === -1) {
        return res.status(404).json({ error: 'Cat not found' });
    }

    database.cats.splice(catIndex, 1);
    
    if (saveDatabase()) {
        res.json({ success: true, message: 'Cat deleted successfully' });
    } else {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

// Login (simple for admin panel)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === 'admin') {
        res.json({ 
            success: true, 
            token: 'demo_token_' + Date.now(),
            user: { username: 'admin' }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        data: {
            catsCount: database.cats.length,
            breedsCount: Object.keys(database.breedPages).length,
            lastSync: database.lastSync
        }
    });
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel-backend.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ 
            error: 'Payload too large',
            message: 'Изображение слишком большое. Пожалуйста, используйте изображения меньшего размера.'
        });
    }
    
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin-panel-backend.html`);
    console.log(`Main site: http://localhost:${PORT}/index.html`);
    console.log(`API: http://localhost:${PORT}/api/sync-data`);
    console.log(`Cats API: http://localhost:${PORT}/api/cats`);
});
