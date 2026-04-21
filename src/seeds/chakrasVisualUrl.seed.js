const mongoose = require('mongoose');
const Music = require('../models/music.model');
const Category = require('../models/categories.model');
require('dotenv').config();

const CHAKRA_BASE_URL = 'https://storage.googleapis.com/schoolbreathvideos/Chakra%20version%202';

/**
 * Map chakra identifier to visual video URL (matches app CHAKRAS data).
 * Used to seed/update Music documents in the "shakra" category.
 */
const CHAKRA_VISUAL_URLS = {
  root: `${CHAKRA_BASE_URL}/rootchakramusic.mp4`,
  sacral: `${CHAKRA_BASE_URL}/sacralchakramusic.mp4`,
  solar: `${CHAKRA_BASE_URL}/solarplexuschakramusic.mp4`,
  heart: `${CHAKRA_BASE_URL}/Heartchakramusic.mp4`,
  throat: `${CHAKRA_BASE_URL}/throatchakramusic.mp4`,
  third_eye: `${CHAKRA_BASE_URL}/thirdeyechakramusic.mp4`,
  crown: `${CHAKRA_BASE_URL}/crownchakramusic.mp4`,
};

/**
 * Derive chakra key from music name for matching (e.g. "Root", "Root Chakra" -> root).
 */
function getChakraKeyFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.toLowerCase().trim();
  if (lower.includes('root')) return 'root';
  if (lower.includes('sacral')) return 'sacral';
  if (lower.includes('solar') || lower.includes('plexus')) return 'solar';
  if (lower.includes('heart')) return 'heart';
  if (lower.includes('throat')) return 'throat';
  if (lower.includes('third') || lower.includes('3rd') || lower.includes('eye')) return 'third_eye';
  if (lower.includes('crown')) return 'crown';
  return null;
}

/**
 * Seed visualUrl on all Music documents in the shakra category.
 * Does not delete any existing fields; only adds/updates visualUrl.
 */
async function seedChakrasVisualUrl() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not set. Set it in .env or environment.');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const shakraCategory = await Category.findOne({ name: 'shakra' });
    if (!shakraCategory) {
      console.log('⚠️ Category "shakra" not found. Create it first, then run this seed.');
      await mongoose.disconnect();
      process.exit(1);
    }

    const chakraTracks = await Music.find({
      categories: shakraCategory._id,
    });

    if (chakraTracks.length === 0) {
      console.log('⚠️ No music documents found in "shakra" category. Add chakra tracks first.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`📝 Found ${chakraTracks.length} chakra track(s). Updating visualUrl...`);

    let updated = 0;
    let skipped = 0;

    for (const track of chakraTracks) {
      const key = getChakraKeyFromName(track.name);
      const visualUrl = key ? CHAKRA_VISUAL_URLS[key] : null;

      if (!visualUrl) {
        console.log(`   ⏭️  No mapping for name "${track.name}" (id: ${track._id})`);
        skipped++;
        continue;
      }

      await Music.findByIdAndUpdate(track._id, { $set: { visualUrl } });
      console.log(`   ✅ ${track.name} -> visualUrl set`);
      updated++;
    }

    console.log(`\n🎉 Done. Updated: ${updated}, Skipped (no match): ${skipped}.`);
  } catch (error) {
    console.error('❌ Error seeding chakras visualUrl:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

if (require.main === module) {
  seedChakrasVisualUrl();
}

module.exports = { seedChakrasVisualUrl, CHAKRA_VISUAL_URLS, getChakraKeyFromName };
