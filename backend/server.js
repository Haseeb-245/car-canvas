const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allow requests from the Vercel frontend and local dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // set this in Vercel env vars
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    // In dev or if no FRONTEND_URL set, allow all
    if (!process.env.FRONTEND_URL) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
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
/* ─────────────────────── HYBRID AI 3D MAPPING ADVISOR ─────────────────────── */
const fs = require('fs');
const path = require('path');

app.post('/api/ai/smart-configure', async (req, res) => {
  try {
    const { userQuery, carName } = req.body;
    if (!userQuery) {
      return res.status(400).json({ error: "Configuration prompt or query is required." });
    }

    // 1. Rule-Based / Keyword Heuristics filtering from local dataset
    let localizedDataset = [];
    try {
      const dataPath = path.join(__dirname, 'pak_car_mods_dataset.json');
      if (fs.existsSync(dataPath)) {
        localizedDataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      }
    } catch (e) {
      console.error("Local dataset read failure:", e);
    }

    const normalizedQuery = userQuery.toLowerCase();

    // Contextual rule matches for the AI context (top 3)
    let contextualMatches = localizedDataset.filter(item =>
      normalizedQuery.includes(item.vibe.toLowerCase()) ||
      normalizedQuery.includes(item.market_data.sourcing_city.toLowerCase()) ||
      item.keywords.split(', ').some(kw => normalizedQuery.includes(kw.toLowerCase()))
    ).slice(0, 3);

    if (contextualMatches.length === 0 && localizedDataset.length > 0) {
      contextualMatches = localizedDataset.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    // Heuristical Fallback Matcher to support keyless operations beautifully!
    const getFallbackMatch = () => {
      let bestItem = null;
      let highestScore = -1;

      for (const item of localizedDataset) {
        let score = 0;

        // Car model compatibility match
        const compatibility = (item.car_compatibility || '').toLowerCase();
        const activeCar = (carName || '').toLowerCase();
        if (activeCar && (compatibility.includes(activeCar) || activeCar.includes(compatibility) ||
          (activeCar.includes('supra') && compatibility.includes('supra')) ||
          (activeCar.includes('skyline') && compatibility.includes('skyline')) ||
          (activeCar.includes('e63') && compatibility.includes('e63')) ||
          (activeCar.includes('gt4') && compatibility.includes('gt4')) ||
          (activeCar.includes('911') && compatibility.includes('911')))) {
          score += 10; // High preference for compatible models
        }

        // Match vibe
        if (item.vibe && normalizedQuery.includes(item.vibe.toLowerCase())) {
          score += 15;
        }

        // Match sourcing city
        if (item.market_data && item.market_data.sourcing_city && normalizedQuery.includes(item.market_data.sourcing_city.toLowerCase())) {
          score += 12;
        }

        // Match keywords
        if (item.keywords) {
          const kwList = item.keywords.split(', ');
          for (const kw of kwList) {
            if (normalizedQuery.includes(kw.toLowerCase())) {
              score += 8;
            }
          }
        }

        // Match theme title words
        if (item.theme_title) {
          const words = item.theme_title.toLowerCase().split(' ');
          for (const word of words) {
            if (word.length > 2 && normalizedQuery.includes(word)) {
              score += 3;
            }
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestItem = item;
        }
      }

      // Default fallback if dataset is empty or no match
      if (!bestItem) {
        return {
          config: {
            bodyColorHex: "#0a0a0a",
            wrapIndex: 0,
            rimStyleIndex: 0,
            rimColorIndex: 0,
            bumperIndex: 0,
            hoodIndex: 0,
            spoilerIndex: 0,
            suspensionOffset: 0.0,
            tuningIndex: null
          },
          market_report: {
            estimated_cost_pkr: 450000,
            sourcing_city: "Lahore",
            primary_hub: "Montgomery Road",
            trusted_importer: "CarX Lahore",
            summary: "Stealth build custom mapping applied based on general aesthetics. Sourcing premium parts via McLeod Road/Montgomery Road importers in Lahore."
          }
        };
      }

      return {
        config: {
          bodyColorHex: bestItem.config_mapping.bodyColorHex,
          wrapIndex: bestItem.config_mapping.wrapIndex,
          rimStyleIndex: bestItem.config_mapping.rimStyleIndex,
          rimColorIndex: bestItem.config_mapping.rimColorIndex,
          bumperIndex: bestItem.config_mapping.bumperIndex,
          hoodIndex: bestItem.config_mapping.hoodIndex,
          spoilerIndex: bestItem.config_mapping.spoilerIndex,
          suspensionOffset: bestItem.config_mapping.suspensionOffset,
          tuningIndex: bestItem.config_mapping.tuningIndex
        },
        market_report: {
          estimated_cost_pkr: bestItem.market_data.estimated_cost_pkr,
          sourcing_city: bestItem.market_data.sourcing_city,
          primary_hub: bestItem.market_data.primary_hub,
          trusted_importer: bestItem.market_data.trusted_importer,
          summary: `Matched with Pakistani build "${bestItem.theme_title}" (${bestItem.vibe}). This setup lowers the suspension stance to ${bestItem.config_mapping.suspensionOffset}m and applies a curated ${bestItem.config_mapping.bodyColorLabel} body finish. Premium performance components can be sourced at ${bestItem.market_data.primary_hub} in ${bestItem.market_data.sourcing_city} via ${bestItem.market_data.trusted_importer}.`
        }
      };
    };

    // 2. Process via AI API (if key is present) or fallback to heuristical matcher
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("No GEMINI_API_KEY detected. Gracefully falling back to context-aware local database heuristics.");
      return res.json(getFallbackMatch());
    }

    try {
      const mappingPrompt = `
        You are an expert AI 3D Configurator Mapping Engine for the "Car Canvas" platform in Pakistan.
        Your task is to parse a user query and determine the exact array indices and styling parameters for a 3D Canvas.

        Car Target Model: ${carName}
        User Customization Intent: "${userQuery}"

        Reference contextual builds from our Pakistani tuning database:
        ${JSON.stringify(contextualMatches, null, 2)}

        Strict Mapping Indices (Obey these limits based on React UI component models):
        - bodyColorHex: Return a valid HEX color code that perfectly matches the user's intent (e.g. #ff00ff for hot pink, #00ff00 for neon green, etc). You are no longer restricted to predefined colors.
        - wrapIndex: Integer from 0 to 5 (0=None, 1=Carbon, 2=Steel, 3=Satin, 4=Holographic, 5=Camo)
        - rimStyleIndex: Integer from 0 to 2
        - rimColorIndex: Integer from 0 to 5 (0=Gloss Black, 1=Silver, 2=Gold, 3=Gunmetal, 4=Red, 5=White)
        - bumperIndex: Integer index (0=Stock, 1=Aero Kit, 2=Race Spec)
        - hoodIndex: Integer index (0=Stock, 1=Carbon Bonnet, 2=Vented)
        - spoilerIndex: Integer index (0=Deleted/None, 1=Custom Lip, 2=Performance GT Wing)
        - suspensionOffset: Float value strictly bounded between -0.08 (lowered stance) and 0.04 (lifted stance)
        - tuningIndex: Integer from 0 to 3 (0=Stage 1, 1=Stage 2, 2=Stage 3, 3=Race Build), or null for Stock.

        Return ONLY a pure, valid raw JSON object matching the schema below. Do not wrap inside markdown code block formatting.

        Response Schema:
        {
          "config": {
            "bodyColorHex": "#0a0a0a",
            "wrapIndex": 1,
            "rimStyleIndex": 1,
            "rimColorIndex": 0,
            "bumperIndex": 2,
            "hoodIndex": 1,
            "spoilerIndex": 2,
            "suspensionOffset": -0.05,
            "tuningIndex": 2
          },
          "market_report": {
            "estimated_cost_pkr": 1250000,
            "sourcing_city": "Rawalpindi / Lahore / Karachi",
            "primary_hub": "Name of local marketplace (e.g., Chah Sultan / Montgomery Road / Plaza Market)",
            "trusted_importer": "Recommended local specialized shop or vendor",
            "summary": "Explain how this exact 3D selection reflects their styling intent and detail how/where to clear customs or purchase these parts locally in Pakistan."
          }
        }
      `;

      const aiCall = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: mappingPrompt }] }] })
        }
      );

      if (!aiCall.ok) {
        throw new Error(`Gemini API returned status ${aiCall.status}`);
      }

      const rawData = await aiCall.json();
      let replyText = rawData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      // Sanitize any accidental AI code block wraps
      replyText = replyText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();

      return res.json(JSON.parse(replyText));
    } catch (apiError) {
      console.warn("AI API call failed or timed out. Falling back to local dataset heuristics:", apiError.message);
      return res.json(getFallbackMatch());
    }

  } catch (err) {
    console.error("Hybrid AI Configurator Mapping Failure:", err);
    return res.status(500).json({ error: "Failed to map natural query parameters to the 3D canvas." });
  }
});

app.post('/api/ai/evaluate-build', async (req, res) => {
  try {
    const { carName, currentConfig, lastModified } = req.body;
    
    // 1. Fallback Heuristics Function
    const getHeuristicEvaluation = () => {
      let total_pkr = 0;
      let breakdown = [];
      
      if (currentConfig.rimStyleIndex > 0) { total_pkr += 250000; breakdown.push("Custom Rims: 250k"); }
      if (currentConfig.wrapIndex > 0) { total_pkr += 150000; breakdown.push("Premium Wrap: 150k"); }
      if (currentConfig.bumperIndex > 0) { total_pkr += 180000; breakdown.push("Aero Bumper: 180k"); }
      if (currentConfig.hoodIndex > 0) { total_pkr += 120000; breakdown.push("Carbon Hood: 120k"); }
      if (currentConfig.spoilerIndex > 0) { total_pkr += 90000; breakdown.push("GT Wing: 90k"); }
      if (currentConfig.suspensionOffset < 0) { total_pkr += 85000; breakdown.push("Lowering Springs: 85k"); }
      if (currentConfig.tuningIndex > 0) { 
        let tCost = currentConfig.tuningIndex * 150000;
        total_pkr += tCost; 
        breakdown.push(`Stage ${currentConfig.tuningIndex} Tune: ${tCost/1000}k`); 
      }
      if (total_pkr === 0) { total_pkr = 50000; breakdown.push("Base Paint/Inspection: 50k"); }

      const suggestions = [];
      
      // Dynamic Rim / Paint Suggestion
      if (currentConfig.bodyColorHex === "#0a0a0a" || currentConfig.bodyColorHex === "#1a1a1a") {
        suggestions.push({ type: "rimColor", value: "#ffffff", label: "Ceramic White Rims", reason: "Striking high-contrast mafia aesthetic against the dark body." });
      } else {
        suggestions.push({ type: "paint", value: "#0a0a0a", label: "Obsidian Black Paint", reason: "A deep, glossy black will instantly elevate the luxury road presence." });
      }

      // Dynamic Wrap Suggestion
      if (currentConfig.wrapIndex === 0) {
        suggestions.push({ type: "wrap", value: 4, label: "Holographic / Chrome Wrap", reason: "Adds 150k PKR to value but guarantees breaking necks in local car meets." });
      } else {
        suggestions.push({ type: "tuning", value: 3, label: "Stage 3 Race Tune", reason: "Your aggressive wrap demands an engine that matches the visual intensity." });
      }

      // Dynamic Stance Suggestion
      if (currentConfig.suspensionOffset >= 0) {
        suggestions.push({ type: "stance", value: -0.06, label: "Lowered Track Stance", reason: "Improves aerodynamics and dramatically enhances visual presence." });
      }

      const breakdownText = breakdown.join(", ");

      return {
        suggestions: suggestions.slice(0, 2),
        market_report: {
          total_estimated_pkr: total_pkr,
          sourcing_city: "Karachi / Lahore / Pindi",
          primary_hub: "Plaza Market & Montgomery Road",
          trusted_importer: "Local Certified Importers",
          build_rating: currentConfig.tuningIndex > 1 ? "[RATE LIMITED] 9.0/10 - Track Menace" : "[RATE LIMITED] 8.0/10 - Street Cred",
          performance_impact: "⚠️ Google Gemini API Free-Tier Limit Reached (15 requests/min). The AI will resume in 60 seconds. Showing offline heuristic data.",
          summary: `Cost Breakdown: [${breakdownText}]. Your ${carName} build totals PKR ${total_pkr.toLocaleString()}. Highly recommended to source these mods from Montgomery Road.`
        }
      };
    };

    // 2. Try Gemini AI Evaluation
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("No GEMINI_API_KEY detected for evaluate-build. Using heuristics.");
      return res.json(getHeuristicEvaluation());
    }

    try {
      const evaluationPrompt = `
        You are an expert AI automotive evaluator for the "Car Canvas" platform in Pakistan.
        The user has actively configured their ${carName} with the following exact state parameters:
        ${JSON.stringify(currentConfig, null, 2)}
        
        CRITICAL CONTEXT: The user JUST modified their ${lastModified || 'build'}.
        
        Provide a hyper-realistic analysis based on Pakistani car modification culture (e.g. Chah Sultan, Montgomery Road, Plaza Market).
        
        CRITICAL INSTRUCTIONS:
        1. "suggestions": Give exactly 4 HIGHLY ENHANCED styling suggestions. Each suggestion MUST include:
           - A highly descriptive, exotic label (e.g. "Forged Matte Bronze TE37 Rims", "Full Satin Nardo Grey Wrap", "Carbon Fiber Track Splitter").
           - A deeply technical and aesthetic "reason" explaining exactly why it perfectly matches their newly modified ${lastModified || 'build'} and elevates their current vibe. Talk about aerodynamics, color theory, or street-cred!
        2. "market_report": Estimate realistic "total_estimated_pkr" (as an integer). Calculate costs of their chosen Wrap, Paint, Bodykits, and Tuning Stages! Generate a "build_rating" (e.g. '9.5/10 - Street Menace') and a deeply analytical "performance_impact" explaining how the suspension, aero, and tuning dynamically changes the car's handling. Write a 2-sentence "summary" detailing their build vibe and how it commands respect on local streets.
        
        Return ONLY valid JSON matching this schema exactly:
        {
          "suggestions": [
            { "label": "String", "reason": "String" }
          ],
          "market_report": {
            "total_estimated_pkr": Number,
            "sourcing_city": "String",
            "primary_hub": "String",
            "trusted_importer": "String",
            "build_rating": "String",
            "performance_impact": "String",
            "summary": "String"
          }
        }
      `;

      const aiCall = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: evaluationPrompt }] }] })
        }
      );

      if (!aiCall.ok) throw new Error("Gemini API Error");
      
      const rawData = await aiCall.json();
      let replyText = rawData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      replyText = replyText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      
      return res.json(JSON.parse(replyText));
    } catch (apiError) {
      console.warn("AI Evaluate-Build failed, falling back to heuristics:", apiError.message);
      return res.json(getHeuristicEvaluation());
    }

  } catch (err) {
    console.error("Evaluate Build Error:", err);
    return res.status(500).json({ error: "Failed to evaluate build." });
  }
});

// Start server locally; Vercel uses the exported app instead
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Required for Vercel serverless deployment
module.exports = app;

