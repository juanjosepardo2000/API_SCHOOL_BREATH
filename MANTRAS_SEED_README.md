# Mantras Database Seeding Guide

This guide explains how to populate your MongoDB database with mantra data from the web version

## Overview

The seed script (`src/seeds/mantras.seed.js`) contains **21 mantras** organized by deity:

- **SHIVA**: 8 mantras (Om Namah Shivaya variations, Protection, Karma Cleansing, etc.)
- **KRISHNA**: 3 mantras (Hare Krishna variations)
- **GANESHA**: 1 mantra (Vakratunda Mahakaya)
- **HANUMAN**: 2 mantras (Hanuman Chalisa, Hanuman Stuti)
- **UNIVERSAL**: 7 mantras (Gayatri, Om Shanti, Lokah Samastah, etc.)

All mantras include:
- Audio URLs pointing to Google Cloud Storage
- Proper categorization (deity, benefit, difficulty)
- Engagement metrics (popularity score, points reward)
- Visual styling (Tailwind colors)
- Access control flags

## Prerequisites

1. MongoDB running locally or connection string in `.env`
2. Node.js installed
3. Dependencies installed (`npm install`)

## Environment Setup

Make sure your `.env` file has the MongoDB connection string:

```env
DB_URL=mongodb://localhost:27017/schoolofbreath
# Or for MongoDB Atlas:
# DB_URL=mongodb+srv://username:password@cluster.mongodb.net/schoolofbreath
```

## Running the Seed Script

### Option 1: Direct Node Execution

```bash
cd /Users/usuario/Documents/abhi/v2/api/SchoolOfBreathBackendAPIs
node src/seeds/mantras.seed.js
```

### Option 2: Using npm script (recommended)

First, add this script to your `package.json`:

```json
{
  "scripts": {
    "seed:mantras": "node src/seeds/mantras.seed.js"
  }
}
```

Then run:

```bash
npm run seed:mantras
```

## What Happens During Seeding

1. **Connection**: Script connects to MongoDB using `DB_URL` from `.env`
2. **Check Existing**: Counts existing mantras in database
3. **Prompt**: If mantras exist, asks if you want to clear them (yes/no)
4. **Insert**: Inserts all 21 mantras from the seed data
5. **Summary**: Displays statistics by deity and benefit
6. **Cleanup**: Disconnects from database

## Expected Output

```
✅ Connected to MongoDB
⚠️  Found 15 existing mantras
Do you want to clear existing mantras? (yes/no): yes
🗑️  Cleared existing mantras
📝 Inserting 21 mantras...
✅ Successfully inserted 21 mantras!

📊 Summary by Deity:
   SHIVA: 8 mantras
   KRISHNA: 3 mantras
   HANUMAN: 2 mantras
   GANESHA: 1 mantras
   UNIVERSAL: 7 mantras

📊 Summary by Benefit:
   ENERGY: 9 mantras
   CALM: 5 mantras
   HEALING: 3 mantras
   PROTECTION: 2 mantras
   FORGIVENESS: 1 mantras
   CONFIDENCE: 1 mantras

🎉 Seed completed successfully!
👋 Disconnected from MongoDB
```

## Verifying the Data

### Using MongoDB Shell

```bash
mongosh
use schoolofbreath
db.mantras.countDocuments()
db.mantras.find({ deity: 'SHIVA' }).pretty()
db.mantras.find({ benefit: 'ENERGY' }).count()
```

### Using the API

After seeding, test the endpoints:

```bash
# Get all mantras
curl http://localhost:3000/mantras

# Get SHIVA mantras
curl http://localhost:3000/mantras?deity=SHIVA

# Get mantras by deity (explorer)
curl http://localhost:3000/mantras/explore/by-deity

# Get popular mantras
curl http://localhost:3000/mantras/popular/list?limit=5
```

## Customizing the Seed Data

To modify the seed data, edit `src/seeds/mantras.seed.js`:

### Adding a New Mantra

```javascript
{
  title: 'Your Mantra Title',
  duration: 300, // seconds
  category: 'MANTRA', // or 'SHIVA', 'KRISHNA', etc.
  tags: ['Tag1', 'Tag2'],
  description: 'Description of the mantra',
  color: 'bg-purple-500',
  pointsReward: 50,
  audioUrl: `${MANTRA_AUDIO_BASE}YourAudioFile.mp3`,
  deity: 'SHIVA', // SHIVA, KRISHNA, HANUMAN, GANESHA, DEVI, GURU, UNIVERSAL
  benefit: 'ENERGY', // ENERGY, CALM, SLEEP, PROTECTION, HEALING, DEVOTION, CONFIDENCE, FORGIVENESS
  difficulty: 'BEGINNER', // BEGINNER, INTERMEDIATE, ADVANCED
  popularityScore: 10000,
  isPremium: false,
  isActive: true,
  position: 22 // next position
}
```

### Changing Access Control

To make mantras premium:

```javascript
isPremium: true,  // Change to true
```

To hide mantras from public:

```javascript
isActive: false,  // Change to false
```

## Troubleshooting

### Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Make sure MongoDB is running:
```bash
# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or check your MongoDB Atlas connection string
```

### Duplicate Key Error

```
E11000 duplicate key error
```

**Solution**: Clear existing data or change `_id` fields:
```bash
mongosh
use schoolofbreath
db.mantras.deleteMany({})
```

### Missing dotenv

```
Error: Cannot find module 'dotenv'
```

**Solution**: Install dependencies:
```bash
npm install dotenv
```

## Re-running the Seed

You can safely re-run the seed script multiple times. It will:
1. Detect existing mantras
2. Ask if you want to clear them
3. Insert fresh data

To avoid the prompt and always clear:

```javascript
// In mantras.seed.js, replace the prompt section with:
await Mantra.deleteMany({});
console.log('🗑️  Cleared existing mantras');
```

## Next Steps

After seeding:

1. ✅ Verify data in MongoDB
2. ✅ Test API endpoints
3. ✅ Update frontend to use new `/mantras` endpoints
4. ✅ Remove hardcoded mantra data from frontend
5. ✅ Test access control with different user emails

## Production Deployment

For production, you can:

1. Run seed script once manually on production database
2. Or create a migration script that runs on deployment
3. Or add mantras via admin panel (once you build it)

**Security Note**: Keep the audio URLs accessible but consider:
- Using signed URLs for premium content
- Rate limiting the audio endpoints
- Caching frequently accessed mantras

## Support

If you encounter issues:
1. Check MongoDB connection
2. Verify `.env` configuration
3. Check console output for specific errors
4. Review the seed data format

For questions, refer to:
- `MANTRAS_API_DOCUMENTATION.md` - API endpoint reference
- `src/models/mantra.model.js` - Schema definition
- `src/controllers/mantra.controller.js` - Business logic
