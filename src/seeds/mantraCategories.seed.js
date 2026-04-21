const mongoose = require('mongoose');
const MantraCategory = require('../models/mantraCategory.model');
require('dotenv').config();

/**
 * Category seed data based on web version MantraExplorer.tsx
 */
const categoriesData = [
  // ============================================
  // DEITY CATEGORIES
  // ============================================
  {
    type: 'DEITY',
    identifier: 'SHIVA',
    label: 'Shiva',
    description: 'Stillness & Power',
    longDescription: 'Lord Shiva represents the transformative aspect of consciousness. Chanting Shiva mantras helps destroy obstacles, negative patterns, and brings deep inner peace. The power of Shiva mantras lies in their ability to calm the mind while awakening spiritual energy.',
    image: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/ShivaMantraImage.jpg',
    icon: 'Flame',
    color: 'bg-gradient-to-br from-indigo-900 to-purple-800',
    order: 0,
    keywords: ['transformation', 'meditation', 'stillness', 'power', 'destruction', 'renewal'],
    isActive: true
  },
  {
    type: 'DEITY',
    identifier: 'HANUMAN',
    label: 'Hanuman',
    description: 'Strength & Courage',
    longDescription: 'Hanuman represents unwavering devotion, immense strength, and fearless courage. His mantras are invoked for protection, overcoming difficulties, and building physical and mental resilience. Perfect for those facing challenges or seeking inner strength.',
    image: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/HanumanMantraImage1.jpg',
    icon: 'Shield',
    color: 'bg-gradient-to-br from-orange-600 to-red-700',
    order: 1,
    keywords: ['strength', 'courage', 'protection', 'devotion', 'resilience', 'warrior'],
    isActive: true
  },
  {
    type: 'DEITY',
    identifier: 'KRISHNA',
    label: 'Krishna',
    description: 'Love & Peace',
    longDescription: 'Lord Krishna embodies divine love, joy, and supreme peace. Krishna mantras, especially the Hare Krishna Mahamantra, bring deep spiritual healing, inner joy, and connection to divine consciousness. Ideal for cultivating devotion and experiencing bliss.',
    image: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/KrishnamantraImage1.jpg',
    icon: 'Heart',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    order: 2,
    keywords: ['love', 'peace', 'devotion', 'joy', 'healing', 'bhakti'],
    isActive: true
  },
  {
    type: 'DEITY',
    identifier: 'DEVI',
    label: 'Devi',
    description: 'Shakti & Grace',
    longDescription: 'The Divine Mother, Devi, represents the feminine power of the universe - Shakti. Her mantras invoke creative energy, courage, and divine grace. Chanting to Devi helps remove fears, attract abundance, and awaken the dormant kundalini energy.',
    image: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/DeviMantraImage1.jpg',
    icon: 'Sparkles',
    color: 'bg-gradient-to-br from-pink-500 to-rose-600',
    order: 3,
    keywords: ['shakti', 'feminine', 'power', 'grace', 'abundance', 'kundalini'],
    isActive: true
  },
  {
    type: 'DEITY',
    identifier: 'GANESHA',
    label: 'Ganesha',
    description: 'Removing Obstacles',
    longDescription: 'Lord Ganesha is the remover of obstacles and the deity of new beginnings. His mantras are traditionally chanted before starting any new venture, journey, or spiritual practice. Invoke Ganesha for wisdom, success, and smooth progress in all endeavors.',
    image: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/GaneshaMantraImage.jpg',
    icon: 'Target',
    color: 'bg-gradient-to-br from-red-500 to-orange-600',
    order: 4,
    keywords: ['obstacles', 'new beginnings', 'wisdom', 'success', 'auspicious', 'confidence'],
    isActive: true
  },
  {
    type: 'DEITY',
    identifier: 'UNIVERSAL',
    label: 'Universal',
    description: 'Ancient Wisdom',
    longDescription: 'Universal mantras transcend specific deities and connect directly to cosmic consciousness. These include ancient Vedic mantras like Gayatri, Om, and Shanti mantras that work with universal energies for enlightenment, peace, and spiritual awakening.',
    image: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/UniversalMantraImage.jpg',
    icon: 'Compass',
    color: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    order: 5,
    keywords: ['universal', 'cosmic', 'enlightenment', 'vedic', 'om', 'peace'],
    isActive: true
  },

  // ============================================
  // BENEFIT CATEGORIES
  // ============================================
  {
    type: 'BENEFIT',
    identifier: 'ENERGY',
    label: 'Energy & Focus',
    description: 'Boost vitality and sharpen concentration',
    longDescription: 'Mantras for energy activation help awaken dormant prana (life force), increase mental clarity, and enhance focus. Perfect for morning practice, before important tasks, or when you need a natural energy boost without stimulants.',
    icon: 'Zap',
    color: 'bg-gradient-to-br from-orange-400 to-red-500',
    order: 0,
    keywords: ['energy', 'focus', 'vitality', 'concentration', 'alertness', 'prana'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'CALM',
    label: 'Anxiety & Stress',
    description: 'Find peace and reduce anxiety',
    longDescription: 'Calming mantras work by regulating the nervous system, slowing down racing thoughts, and creating inner stillness. Use these mantras during anxious moments, before sleep, or as a daily practice to maintain emotional equilibrium and reduce stress.',
    icon: 'Smile',
    color: 'bg-gradient-to-br from-teal-400 to-emerald-500',
    order: 1,
    keywords: ['calm', 'peace', 'anxiety', 'stress', 'relaxation', 'tranquility'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'SLEEP',
    label: 'Deep Sleep & Rest',
    description: 'Release tension and drift into rest',
    longDescription: 'Sleep mantras help quiet the mind, release physical tension, and prepare the body for deep, restorative sleep. Chant these before bedtime to let go of the day\'s worries and enter a state of profound relaxation conducive to quality sleep.',
    icon: 'Moon',
    color: 'bg-gradient-to-br from-indigo-400 to-purple-500',
    order: 2,
    keywords: ['sleep', 'rest', 'insomnia', 'relaxation', 'bedtime', 'deep rest'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'PROTECTION',
    label: 'Courage & Protection',
    description: 'Shield yourself from negativity',
    longDescription: 'Protection mantras create an energetic shield around you, warding off negative influences, fear, and harmful energies. Invoke these powerful vibrations for courage in challenging situations, psychic protection, and maintaining strong boundaries.',
    icon: 'Shield',
    color: 'bg-gradient-to-br from-red-400 to-rose-600',
    order: 3,
    keywords: ['protection', 'courage', 'shield', 'boundaries', 'safety', 'fearless'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'HEALING',
    label: 'Healing & Recovery',
    description: 'Restore body, mind, and spirit',
    longDescription: 'Healing mantras work on multiple levels - physical, emotional, and spiritual. The vibrations help accelerate recovery, release emotional wounds, clear energetic blockages, and restore wholeness. Use during illness, emotional pain, or spiritual crisis.',
    icon: 'Heart',
    color: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    order: 4,
    keywords: ['healing', 'recovery', 'restoration', 'wellness', 'health', 'wholeness'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'DEVOTION',
    label: 'Devotion & Connection',
    description: 'Deepen spiritual connection',
    longDescription: 'Devotional mantras open the heart chakra and create a direct connection with the divine. Through repetition with sincere feeling, these mantras cultivate bhakti (devotion), surrender, and the experience of oneness with universal consciousness.',
    icon: 'Anchor',
    color: 'bg-gradient-to-br from-pink-400 to-rose-500',
    order: 5,
    keywords: ['devotion', 'bhakti', 'connection', 'surrender', 'love', 'divine'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'CONFIDENCE',
    label: 'Confidence',
    description: 'Build self-assurance and remove self-doubt',
    longDescription: 'Confidence mantras help remove limiting beliefs, overcome fear of failure, and build unshakeable self-assurance. These powerful vibrations work on the solar plexus chakra, awakening your inner power and helping you step into your authentic strength.',
    icon: 'Target',
    color: 'bg-gradient-to-br from-amber-400 to-orange-500',
    order: 6,
    keywords: ['confidence', 'self-esteem', 'empowerment', 'courage', 'self-belief'],
    isActive: true
  },
  {
    type: 'BENEFIT',
    identifier: 'FORGIVENESS',
    label: 'Letting Go',
    description: 'Release past hurts and find peace',
    longDescription: 'Forgiveness mantras help release karmic patterns, let go of resentment, and find inner peace. Through regular practice, these mantras dissolve the emotional weight of past experiences, freeing you to move forward with lightness and clarity.',
    icon: 'Sparkles',
    color: 'bg-gradient-to-br from-purple-400 to-fuchsia-600',
    order: 7,
    keywords: ['forgiveness', 'release', 'letting go', 'karma', 'peace', 'liberation'],
    isActive: true
  },

  // ============================================
  // DIFFICULTY CATEGORIES
  // ============================================
  {
    type: 'DIFFICULTY',
    identifier: 'BEGINNER',
    label: 'Beginner',
    description: 'Perfect for those new to mantra practice',
    longDescription: 'Beginner mantras are simple, easy to pronounce, and suitable for newcomers to mantra meditation. These foundational practices establish a solid base for your spiritual journey and can be practiced by anyone, regardless of experience.',
    icon: 'BookOpen',
    color: 'bg-gradient-to-br from-green-400 to-emerald-500',
    order: 0,
    keywords: ['beginner', 'easy', 'simple', 'foundational', 'starter'],
    isActive: true
  },
  {
    type: 'DIFFICULTY',
    identifier: 'INTERMEDIATE',
    label: 'Intermediate',
    description: 'For practitioners with some experience',
    longDescription: 'Intermediate mantras require consistent practice and deeper concentration. They may be longer, have more complex pronunciation, or require sustained focus. Suitable for those who have established a regular practice routine.',
    icon: 'Compass',
    color: 'bg-gradient-to-br from-blue-400 to-indigo-500',
    order: 1,
    keywords: ['intermediate', 'moderate', 'developing', 'progressing'],
    isActive: true
  },
  {
    type: 'DIFFICULTY',
    identifier: 'ADVANCED',
    label: 'Advanced',
    description: 'For experienced practitioners',
    longDescription: 'Advanced mantras are powerful practices that require dedication, proper guidance, and a strong foundation. These mantras work with intense energies and are best approached with respect, preparation, and ideally under the guidance of a teacher.',
    icon: 'Flame',
    color: 'bg-gradient-to-br from-purple-500 to-pink-600',
    order: 2,
    keywords: ['advanced', 'expert', 'mastery', 'intensive', 'powerful'],
    isActive: true
  }
];

/**
 * Seed function to populate categories collection
 */
async function seedCategories() {
  try {
    // Connect to MongoDB
    const mongoUri = 'mongodb+srv://abhishekdug:AONgv5tx5LngDz4b@cluster0.j2ulcwk.mongodb.net/?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing categories (optional)
    const existingCount = await MantraCategory.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing categories`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        readline.question('Do you want to clear existing categories? (yes/no): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() === 'yes') {
        await MantraCategory.deleteMany({});
        console.log('🗑️  Cleared existing categories');
      } else {
        console.log('⏭️  Keeping existing categories');
      }
    }

    // Insert categories
    console.log(`📝 Inserting ${categoriesData.length} categories...`);
    const result = await MantraCategory.insertMany(categoriesData);
    console.log(`✅ Successfully inserted ${result.length} categories!`);

    // Print summary
    console.log('\n📊 Summary by Type:');
    const types = ['DEITY', 'BENEFIT', 'DIFFICULTY'];
    for (const type of types) {
      const count = await MantraCategory.countDocuments({ type });
      console.log(`   ${type}: ${count} categories`);
    }

    console.log('\n📋 Deities:');
    const deities = await MantraCategory.find({ type: 'DEITY' }).sort({ order: 1 });
    deities.forEach(d => console.log(`   - ${d.label}: ${d.description}`));

    console.log('\n📋 Benefits:');
    const benefits = await MantraCategory.find({ type: 'BENEFIT' }).sort({ order: 1 });
    benefits.forEach(b => console.log(`   - ${b.label}: ${b.description}`));

    console.log('\n🎉 Seed completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seed function
if (require.main === module) {
  seedCategories();
}

module.exports = { categoriesData, seedCategories };
