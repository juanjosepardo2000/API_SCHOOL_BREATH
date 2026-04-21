const mongoose = require('mongoose');
const Mantra = require('../models/mantra.model');
require('dotenv').config();

const MANTRA_AUDIO_BASE = "https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Audios/";

/**
 * Mantra seed data based on web version
 * Includes SHIVA tracks and general MANTRAS from constants.ts
 */
const mantrasData = [
  // ============================================
  // SHIVA MANTRAS
  // ============================================
  {
    title: 'Om Namah Shivaya (Obstacle Destroyer)',
    duration: 600,
    category: 'SHIVA',
    tags: ['Success', 'Power'],
    description: 'An ancient mantra that destroys obstacles and brings success.',
    color: 'bg-[#1e1b4b]',
    pointsReward: 50,
    audioUrl: `${MANTRA_AUDIO_BASE}Om%20Namah%20Shivaya%20%20Ancient%20Mantra%20That%20Destroys%20Obstacles%20and%20Brings%20Success.mp3`,
    deity: 'SHIVA',
    benefit: 'ENERGY',
    difficulty: 'BEGINNER',
    popularityScore: 15400,
    isPremium: false,
    isActive: true,
    position: 0
  },
  {
    title: 'Om Namah Shivaya (Powerful Meditation)',
    duration: 480,
    category: 'SHIVA',
    tags: ['Meditation', 'Focus'],
    description: 'Most powerful meditation mantra for deep stillness.',
    color: 'bg-[#312e81]',
    pointsReward: 50,
    audioUrl: `${MANTRA_AUDIO_BASE}Om%20Namah%20Shivaya%20%20Most%20Powerful%20Meditation%20Mantra.mp3`,
    deity: 'SHIVA',
    benefit: 'CALM',
    difficulty: 'BEGINNER',
    popularityScore: 22000,
    isPremium: false,
    isActive: true,
    position: 1
  },
  {
    title: 'Om Namah Shivaya (Healing & Peace)',
    duration: 900,
    category: 'SHIVA',
    tags: ['Healing', 'Peace'],
    description: 'Mantra for deep healing, protection and inner peace.',
    color: 'bg-[#4338ca]',
    pointsReward: 60,
    audioUrl: `${MANTRA_AUDIO_BASE}Om%20Namah%20Shivaya%20Mantra%20for%20Deep%20Healing%2C%20Protection%20%26%20Inner%20Peace%20%2815Min%20Meditation%29.mp3`,
    deity: 'SHIVA',
    benefit: 'HEALING',
    difficulty: 'BEGINNER',
    popularityScore: 18900,
    isPremium: false,
    isActive: true,
    position: 2
  },
  {
    title: 'Karacharana Kritam Vaa (Karma Cleansing)',
    duration: 360,
    category: 'SHIVA',
    tags: ['Purification', 'Karma'],
    description: 'Powerful Shiva mantra for karma cleansing and purification.',
    color: 'bg-[#3730a3]',
    pointsReward: 40,
    audioUrl: `${MANTRA_AUDIO_BASE}Powerful%20Shiva%20Mantra%20for%20Karma%20Cleansing%20and%20Purification%20%20Karacharana%20Kritam%20Vaa.mp3`,
    deity: 'SHIVA',
    benefit: 'FORGIVENESS',
    difficulty: 'INTERMEDIATE',
    popularityScore: 9200,
    isPremium: true,
    isActive: true,
    position: 3
  },
  {
    title: 'Shiv Gayatri Mantra',
    duration: 300,
    category: 'SHIVA',
    tags: ['Wisdom', 'Meditation'],
    description: 'Om Tatpurushaya Vidmahe — Chants for meditation and clarity.',
    color: 'bg-[#1e1b4b]',
    pointsReward: 50,
    audioUrl: `${MANTRA_AUDIO_BASE}Shiv%20Gayatri%20Mantra%20%20Om%20Tatpurushaya%20Vidmahe%20-%20Chants%20For%20Meditation.mp3`,
    deity: 'SHIVA',
    benefit: 'ENERGY',
    difficulty: 'BEGINNER',
    popularityScore: 12100,
    isPremium: true,
    isActive: true,
    position: 4
  },
  {
    title: 'Shiva Protection Mantra',
    duration: 540,
    category: 'SHIVA',
    tags: ['Protection', 'Shield'],
    description: 'Shield yourself from negative energy and start fresh.',
    color: 'bg-[#4c1d95]',
    pointsReward: 50,
    audioUrl: `${MANTRA_AUDIO_BASE}Shiva%20Mantra%20for%20Protection%202026%20_%20Shield%20Yourself%20from%20Negative%20Energy%20%26%20Start%20Fresh.mp3`,
    deity: 'SHIVA',
    benefit: 'PROTECTION',
    difficulty: 'BEGINNER',
    popularityScore: 14500,
    isPremium: true,
    isActive: true,
    position: 5
  },
  {
    title: 'Rapid Spiritual Growth Mantra',
    duration: 660,
    category: 'SHIVA',
    tags: ['Ascension', 'Growth'],
    description: 'The most powerful Shiva mantra for rapid spiritual growth.',
    color: 'bg-[#5b21b6]',
    pointsReward: 70,
    audioUrl: `${MANTRA_AUDIO_BASE}The%20MOST%20POWERFUL%20Shiva%20Mantra%20for%20RAPID%20SPIRITUAL%20GROWTH.mp3`,
    deity: 'SHIVA',
    benefit: 'ENERGY',
    difficulty: 'ADVANCED',
    popularityScore: 8800,
    isPremium: true,
    isActive: true,
    position: 6
  },
  {
    title: 'Lord Shiva Power Vibration',
    duration: 320,
    category: 'SHIVA',
    tags: ['Vibration', 'Power'],
    description: 'Experience the intense energy of this powerful Lord Shiva mantra.',
    color: 'bg-[#6d28d9]',
    pointsReward: 45,
    audioUrl: `${MANTRA_AUDIO_BASE}You%20Won%27t%20Believe%20the%20Energy%20of%20This%20Powerful%20Lord%20Shiva%20Mantra%21%20%281%29.mp3`,
    deity: 'SHIVA',
    benefit: 'ENERGY',
    difficulty: 'INTERMEDIATE',
    popularityScore: 11000,
    isPremium: true,
    isActive: true,
    position: 7
  },

  // ============================================
  // KRISHNA MANTRAS
  // ============================================
  {
    title: 'Hare Krishna (Peace & Healing)',
    duration: 600,
    category: 'MANTRA',
    tags: ['Peace', 'Healing', 'Bhakti'],
    description: 'Hare Krishna Mahamantra for deep spiritual peace and healing.',
    color: 'bg-cyan-500',
    deity: 'KRISHNA',
    benefit: 'HEALING',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Hare%20Krishna%20Mahamantra%20for%20Deep%20Spiritual%20Peace%20%26%20Healing.mp3`,
    popularityScore: 19500,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 8
  },
  {
    title: 'Hare Krishna Hare Rama',
    duration: 480,
    category: 'MANTRA',
    tags: ['Meditation', 'Joy'],
    description: 'Mahamantra for meditation and profound inner peace.',
    color: 'bg-blue-400',
    deity: 'KRISHNA',
    benefit: 'CALM',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Hare%20Krishna%20Hare%20Rama%20Mahamantra%20for%20Meditation%20%26%20Inner%20Peace.mp3`,
    popularityScore: 17200,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 9
  },
  {
    title: 'Chanting Hare Krishna',
    duration: 300,
    category: 'MANTRA',
    tags: ['Chanting', 'Energy'],
    description: 'A rhythmic rendition of the Hare Krishna mantra.',
    color: 'bg-sky-600',
    deity: 'KRISHNA',
    benefit: 'ENERGY',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}The%20School%20of%20Mantras%20Chanting%20HARE%20KRISHNA.mp3`,
    popularityScore: 12000,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 10
  },

  // ============================================
  // GANESHA MANTRAS
  // ============================================
  {
    title: 'Vakratunda Mahakaya',
    duration: 180,
    category: 'MANTRA',
    tags: ['Obstacles', 'New Beginnings'],
    description: 'Ganesha mantra for removing obstacles and spiritual growth.',
    color: 'bg-red-600',
    deity: 'GANESHA',
    benefit: 'CONFIDENCE',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Ganesha%20Mantra%20Vakratund%20Mahakaya%20The%20SECRET%20to%20Spiritual%20Growth.mp3`,
    popularityScore: 25000,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 11
  },

  // ============================================
  // HANUMAN MANTRAS
  // ============================================
  {
    title: 'Hanuman Chalisa (Life Changing)',
    duration: 600,
    category: 'MANTRA',
    tags: ['Strength', 'Devotion'],
    description: 'Master the Hanuman Chalisa for life-changing strength and protection.',
    color: 'bg-orange-700',
    deity: 'HANUMAN',
    benefit: 'PROTECTION',
    difficulty: 'INTERMEDIATE',
    audioUrl: `${MANTRA_AUDIO_BASE}Master%20HANUMAN%20CHALISA%20in%2040%20Days%20for%20Life%20Changing%20Results.mp3`,
    popularityScore: 32000,
    pointsReward: 60,
    isPremium: true,
    isActive: true,
    position: 12
  },
  {
    title: 'Hanuman Stuti for Strength',
    duration: 300,
    category: 'MANTRA',
    tags: ['Strength', 'Protection'],
    description: 'Powerful Hanuman Stuti for immense physical and mental strength.',
    color: 'bg-amber-600',
    deity: 'HANUMAN',
    benefit: 'ENERGY',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}The%20MOST%20POWERFUL%20Hanuman%20Stuti%20for%20STRENGTH%20and%20Protection.mp3`,
    popularityScore: 21000,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 13
  },

  // ============================================
  // UNIVERSAL MANTRAS
  // ============================================
  {
    title: 'Gayatri Mantra (Positive Energy)',
    duration: 300,
    category: 'MANTRA',
    tags: ['Universal', 'Light'],
    description: 'Om Bhur Bhuvah Swaha — Invoke the light of the inner sun.',
    color: 'bg-yellow-500',
    deity: 'UNIVERSAL',
    benefit: 'ENERGY',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Gayatri%20Mantra%20for%20Positive%20Energy%20-%20Om%20Bhur%20Bhuvah%20Swaha.mp3`,
    popularityScore: 45000,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 14
  },
  {
    title: 'Om Shanti (Focus & Study)',
    duration: 120,
    category: 'MANTRA',
    tags: ['Study', 'Focus'],
    description: 'Ideal mantra before beginning study or meditation for focus.',
    color: 'bg-teal-600',
    deity: 'UNIVERSAL',
    benefit: 'CALM',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Mantra%20Before%20Beginning%20Study%20or%20Meditation%20-%20Om%20Shanti.mp3`,
    popularityScore: 18000,
    pointsReward: 40,
    isPremium: true,
    isActive: true,
    position: 15
  },
  {
    title: 'Shanti Mantra for Peace',
    duration: 240,
    category: 'MANTRA',
    tags: ['Peace', 'Universal'],
    description: 'A traditional mantra for establishing profound inner and outer peace.',
    color: 'bg-emerald-500',
    deity: 'UNIVERSAL',
    benefit: 'CALM',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Shanti%20Mantra%20for%20Peace.mp3`,
    popularityScore: 22500,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 16
  },
  {
    title: 'Lokah Samastah (World Peace)',
    duration: 300,
    category: 'MANTRA',
    tags: ['Healing', 'Peace'],
    description: 'May all beings everywhere be happy and free. A mantra for healing.',
    color: 'bg-green-600',
    deity: 'UNIVERSAL',
    benefit: 'HEALING',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Mantra%20for%20Healing%20%26%20Peace%20-%20Lokah%20Samastah%20Sukhino%20Bhavantu.mp3`,
    popularityScore: 16400,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 17
  },
  {
    title: 'Mantra for Liberation',
    duration: 600,
    category: 'MANTRA',
    tags: ['Liberation', 'Peace'],
    description: 'Om Namah Shivaya rendition focused on inner peace and liberation.',
    color: 'bg-indigo-700',
    deity: 'UNIVERSAL',
    benefit: 'FORGIVENESS',
    difficulty: 'INTERMEDIATE',
    audioUrl: `${MANTRA_AUDIO_BASE}Mantra%20for%20Inner%20Peace%20and%20Liberation%20-%20Om%20Nama%20Shivaya.mp3`,
    popularityScore: 11200,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 18
  },
  {
    title: 'Kundalini Awakening Mantra',
    duration: 420,
    category: 'MANTRA',
    tags: ['Energy', 'Power'],
    description: 'Activate your spiritual energy and divine power.',
    color: 'bg-purple-700',
    deity: 'UNIVERSAL',
    benefit: 'ENERGY',
    difficulty: 'ADVANCED',
    audioUrl: `${MANTRA_AUDIO_BASE}Kundalini%20Awakening%20Mantra%20Activate%20Your%20Spiritual%20Energy%20%26%20Divine%20Power.mp3`,
    popularityScore: 9800,
    pointsReward: 60,
    isPremium: true,
    isActive: true,
    position: 19
  },
  {
    title: 'OM Chant (Intuition)',
    duration: 300,
    category: 'MANTRA',
    tags: ['Intuition', 'Third Eye'],
    description: 'Sharpen intuition and open the Third Eye with the OM chant.',
    color: 'bg-brand-dark',
    deity: 'UNIVERSAL',
    benefit: 'CALM',
    difficulty: 'BEGINNER',
    audioUrl: `${MANTRA_AUDIO_BASE}Mantra%20to%20Sharpen%20Intuition%20and%20Open%20Third%20Eye%20-%20OM%20Chant.mp3`,
    popularityScore: 28000,
    pointsReward: 50,
    isPremium: true,
    isActive: true,
    position: 20
  }
];

/**
 * Seed function to populate mantras collection
 */
async function seedMantras() {
  try {
    // Connect to MongoDB
    const mongoUri = 'mongodb+srv://abhishekdug:AONgv5tx5LngDz4b@cluster0.j2ulcwk.mongodb.net/?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing mantras (optional - remove this if you want to keep existing data)
    const existingCount = await Mantra.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing mantras`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        readline.question('Do you want to clear existing mantras? (yes/no): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() === 'yes') {
        await Mantra.deleteMany({});
        console.log('🗑️  Cleared existing mantras');
      } else {
        console.log('⏭️  Keeping existing mantras, will add new ones');
      }
    }

    // Insert mantras
    console.log(`📝 Inserting ${mantrasData.length} mantras...`);
    const result = await Mantra.insertMany(mantrasData);
    console.log(`✅ Successfully inserted ${result.length} mantras!`);

    // Print summary
    console.log('\n📊 Summary by Deity:');
    const deities = ['SHIVA', 'KRISHNA', 'HANUMAN', 'GANESHA', 'UNIVERSAL'];
    for (const deity of deities) {
      const count = await Mantra.countDocuments({ deity });
      console.log(`   ${deity}: ${count} mantras`);
    }

    console.log('\n📊 Summary by Benefit:');
    const benefits = ['ENERGY', 'CALM', 'HEALING', 'PROTECTION', 'FORGIVENESS', 'CONFIDENCE'];
    for (const benefit of benefits) {
      const count = await Mantra.countDocuments({ benefit });
      console.log(`   ${benefit}: ${count} mantras`);
    }

    console.log('\n🎉 Seed completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding mantras:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seed function
if (require.main === module) {
  seedMantras();
}

module.exports = { mantrasData, seedMantras };
