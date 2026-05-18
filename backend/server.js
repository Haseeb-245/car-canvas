const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/carcanvas';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully at:', MONGO_URI))
  .catch(err => console.error('MongoDB connection error:', err));

/* ─────────────────────── DATABASE SCHEMAS ─────────────────────── */

// User Profile Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Saved Car Customization Schema
const savedCarSchema = new mongoose.Schema({
  username: { type: String, required: true },
  carId: { type: Number, required: true },
  carName: { type: String, required: true },
  paintColor: { type: String, default: '#0a0a0b' },
  paintType: { type: String, default: 'glossy' },
  wrapType: { type: String, default: 'none' },
  rimColor: { type: String, default: '#121212' },
  rimSize: { type: Number, default: 19 },
  rimStyle: { type: Number, default: 0 },
  bumper: { type: Number, default: 0 },
  hood: { type: Number, default: 0 },
  spoiler: { type: Number, default: 1 },
  suspension: { type: Number, default: 0 },
  tuning: { type: String, default: 'Stock' },
  savedAt: { type: Date, default: Date.now }
});

const SavedCar = mongoose.model('SavedCar', savedCarSchema);

// Global Feed Published Car Schema
const publishedCarSchema = new mongoose.Schema({
  username: { type: String, required: true },
  carId: { type: Number, required: true },
  carName: { type: String, required: true },
  snapshot: { type: String, default: '' }, // Base64 image data URL
  paintColor: { type: String, default: '#0a0a0b' },
  tuning: { type: String, default: 'Stock' },
  story: { type: String, default: '' }, // User build story / experience
  likes: { type: Number, default: 0 },
  likedBy: [{ type: String }], // Array of usernames who liked it
  comments: [{
    username: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  publishedAt: { type: Date, default: Date.now }
});

const PublishedCar = mongoose.model('PublishedCar', publishedCarSchema);

// Seed some initial data to give it a "feed feel"
const seedFeed = async () => {
  const count = await PublishedCar.countDocuments();
  if (count === 0) {
    const dummyData = [
      {
        username: 'SpeedDemon99',
        carId: 4,
        carName: 'Skyline GT-R R34',
        paintColor: '#0022ff',
        tuning: 'Stage 3 Full',
        story: 'Just finished tweaking the R34. Stage 3 turbo pulls like an absolute train. The midnight blue wrap shines beautifully in the showroom daylight. Best track days ahead!',
        likes: 124,
        snapshot: '',
        likedBy: [],
        comments: [
          { username: 'DriftKing_JP', text: 'This is an absolute masterpiece! Midnight blue fits the R34 perfectly.', createdAt: new Date() },
          { username: 'ApexPredator', text: 'Stage 3 turbo is insane, did you reinforce the gearbox?', createdAt: new Date() }
        ]
      },
      {
        username: 'ApexPredator',
        carId: 2,
        carName: 'AMG E63 S',
        paintColor: '#111111',
        tuning: 'Stage 1 ECU',
        story: 'Kept it clean with stealth gloss black on the E63 S. Added Stage 1 ECU tuning. Comfort cruiser by day, absolute beast by night. Incredible active chassis feedback.',
        likes: 89,
        snapshot: '',
        likedBy: [],
        comments: [
          { username: 'SpeedDemon99', text: 'Cleanest black E63 on the platform! That stance sits beautifully.', createdAt: new Date() }
        ]
      },
      {
        username: 'DriftKing_JP',
        carId: 6,
        carName: 'Supra MkIV',
        paintColor: '#cc1122',
        tuning: 'Race Build',
        story: 'Supra MkIV with a full single-turbo race build. Running a hot candy red finish with high metalness. The high speed stability on the highway is phenomenal.',
        likes: 256,
        snapshot: '',
        likedBy: [],
        comments: [
          { username: 'SpeedDemon99', text: 'Is that a 2JZ single turbo?! Insane sound clips please!', createdAt: new Date() },
          { username: 'ApexPredator', text: 'Pure drift royalty right here. Red hot chrome paint looks fire!', createdAt: new Date() }
        ]
      }
    ];
    await PublishedCar.insertMany(dummyData);
    console.log('Global Feed Seeded with Dummy Data!');
  }
};
mongoose.connection.once('open', seedFeed);

/* ─────────────────────── AUTHENTICATION ROUTES ─────────────────────── */

// 1. CREATE DRIVER PROFILE (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All telemetry fields (username, email, password) are required.' });
    }

    // Check if driver tag or email is already registered
    const existingUser = await User.findOne({ 
      $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }] 
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Racer Tag (username) or Driver Signature (email) is already registered.' });
    }

    const newUser = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: password // In standard builds we hash passwords; keeping simple for demonstration
    });

    await newUser.save();
    console.log(`Driver registered successfully: ${username}`);
    
    return res.status(201).json({ 
      message: 'Profile launched successfully!',
      user: { username: newUser.username, email: newUser.email } 
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Database ignition failure.' });
  }
});

// 2. DRIVER SIGN IN (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and Access Key (password) are required.' });
    }

    const user = await User.findOne({ username: username.trim() });
    
    if (!user) {
      return res.status(404).json({ error: 'User does not exist. Please register first!' });
    }
    
    if (user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    console.log(`Driver signed in: ${username}`);
    return res.json({ 
      message: 'Engine ignited!',
      user: { username: user.username, email: user.email } 
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Database ignition failure.' });
  }
});

/* ─────────────────────── CUSTOMIZATION SAVING ROUTES ─────────────────────── */

// 3. SAVE CUSTOMIZED CAR CONFIGURATION
app.post('/api/cars/save', async (req, res) => {
  try {
    const { 
      username, carId, carName, paintColor, paintType, 
      wrapType, rimColor, rimSize, rimStyle, bumper, hood, spoiler, suspension, tuning 
    } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Authentication signature is required.' });
    }

    // Save or update customization setup
    const newCustomization = new SavedCar({
      username: username.trim(),
      carId,
      carName,
      paintColor,
      paintType,
      wrapType,
      rimColor,
      rimSize,
      rimStyle,
      bumper,
      hood,
      spoiler,
      suspension,
      tuning
    });

    await newCustomization.save();
    console.log(`Car configuration saved for user: ${username} (${carName})`);
    return res.status(201).json({ message: 'Car configuration saved to garage successfully!' });
  } catch (err) {
    console.error('Save customization error:', err);
    return res.status(500).json({ error: 'Failed to save customization to database.' });
  }
});

// 4. RETRIEVE USER'S SAVED GARAGE CARS
app.get('/api/cars/saved/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const configurations = await SavedCar.find({ username: username.trim() }).sort({ savedAt: -1 });
    return res.json(configurations);
  } catch (err) {
    console.error('Retrieve garage error:', err);
    return res.status(500).json({ error: 'Failed to retrieve configurations from database.' });
  }
});

/* ─────────────────────── GLOBAL FEED ROUTES ─────────────────────── */

// 5. PUBLISH BUILD TO GLOBAL FEED
app.post('/api/feed/publish', async (req, res) => {
  try {
    const { username, carId, carName, snapshot, paintColor, tuning, story } = req.body;

    if (!username || !snapshot) {
      return res.status(400).json({ error: 'Driver signature and snapshot are required to publish.' });
    }

    const newPost = new PublishedCar({
      username: username.trim(),
      carId,
      carName,
      snapshot, // Base64 string from canvas.toDataURL()
      paintColor,
      tuning,
      story
    });

    await newPost.save();
    console.log(`Car published to feed by: ${username}`);
    return res.status(201).json({ message: 'Masterpiece published to Global Showroom!' });
  } catch (err) {
    console.error('Publish feed error:', err);
    return res.status(500).json({ error: 'Failed to publish to global feed.' });
  }
});

// 6. GET GLOBAL FEED
app.get('/api/feed', async (req, res) => {
  try {
    // Return latest 50 published cars
    const feed = await PublishedCar.find().sort({ publishedAt: -1 }).limit(50);
    return res.json(feed);
  } catch (err) {
    console.error('Retrieve feed error:', err);
    return res.status(500).json({ error: 'Failed to retrieve global feed.' });
  }
});

// 7. LIKE A PUBLISHED CAR (POST /api/feed/like/:id)
app.post('/api/feed/like/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    const post = await PublishedCar.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Published design not found.' });
    }

    if (username) {
      const idx = post.likedBy.indexOf(username);
      if (idx !== -1) {
        // Unlike if already liked
        post.likedBy.splice(idx, 1);
        post.likes = Math.max(0, post.likes - 1);
      } else {
        // Like if not already liked
        post.likedBy.push(username);
        post.likes += 1;
      }
    } else {
      // Direct increment for guests
      post.likes += 1;
    }

    await post.save();
    return res.json({ likes: post.likes, likedBy: post.likedBy });
  } catch (err) {
    console.error('Like feed error:', err);
    return res.status(500).json({ error: 'Failed to process like.' });
  }
});

// 8. COMMENT ON A PUBLISHED CAR (POST /api/feed/comment/:id)
app.post('/api/feed/comment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, text } = req.body;

    if (!username || !text) {
      return res.status(400).json({ error: 'Racer Tag and comment text are required.' });
    }

    const post = await PublishedCar.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Published design not found.' });
    }

    post.comments.push({ username, text, createdAt: new Date() });
    await post.save();

    return res.status(201).json(post.comments);
  } catch (err) {
    console.error('Comment feed error:', err);
    return res.status(500).json({ error: 'Failed to add comment.' });
  }
});

app.get('/', (req, res) => {
  res.send('Car Canvas Premium Database Server Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
