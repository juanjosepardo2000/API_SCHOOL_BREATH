const mongoose = require('mongoose');
const MantraCategory = require('../models/mantraCategory.model');
require('dotenv').config();

/**
 * Update benefit categories with correct colors and labels from the image
 * Based on the mobile app UI requirements
 */
const benefitUpdates = [
  {
    identifier: 'ENERGY',
    updates: {
      label: 'Energy & Focus',
      color: '#f97316', // Orange - matches image
      icon: 'Zap',
      description: 'Boost vitality and sharpen concentration',
      order: 0,
    }
  },
  {
    identifier: 'CALM',
    updates: {
      label: 'Anxiety & Stress',
      color: '#14b8a6', // Teal-green - matches image
      icon: 'Smile',
      description: 'Find peace and reduce anxiety',
      order: 1,
    }
  },
  {
    identifier: 'SLEEP',
    updates: {
      label: 'Deep Sleep & Rest',
      color: '#6366f1', // Purple (indigo) - matches image
      icon: 'Moon',
      description: 'Release tension and drift into rest',
      order: 2,
    }
  },
  {
    identifier: 'PROTECTION',
    updates: {
      label: 'Courage & Protection',
      color: '#ef4444', // Red - matches image
      icon: 'Shield',
      description: 'Shield yourself from negativity',
      order: 3,
    }
  },
  {
    identifier: 'HEALING',
    updates: {
      label: 'Healing & Recovery',
      color: '#10b981', // Green (emerald) - matches image
      icon: 'Heart',
      description: 'Restore body, mind, and spirit',
      order: 4,
    }
  },
  {
    identifier: 'DEVOTION',
    updates: {
      label: 'Devotion & Connection',
      color: '#ec4899', // Pink - matches image
      icon: 'Anchor',
      description: 'Deepen spiritual connection',
      order: 5,
    }
  },
  {
    identifier: 'CONFIDENCE',
    updates: {
      label: 'Confidence',
      color: '#f97316', // Orange - matches image (same as Energy & Focus)
      icon: 'Target',
      description: 'Build self-assurance and remove self-doubt',
      order: 6,
    }
  },
  {
    identifier: 'FORGIVENESS',
    updates: {
      label: 'Letting Go',
      color: '#a855f7', // Purple (fuchsia) - matches image
      icon: 'Sparkles',
      description: 'Release past hurts and find peace',
      order: 7,
    }
  },
];

/**
 * Update benefit categories in the database
 */
async function updateBenefits() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://abhishekdug:AONgv5tx5LngDz4b@cluster0.j2ulcwk.mongodb.net/?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    console.log(`📝 Updating ${benefitUpdates.length} benefit categories...\n`);

    const results = [];

    for (const { identifier, updates } of benefitUpdates) {
      try {
        // Find the category by type and identifier
        const category = await MantraCategory.findOne({
          type: 'BENEFIT',
          identifier: identifier
        });

        if (!category) {
          console.log(`⚠️  Category ${identifier} not found, skipping...`);
          results.push({ identifier, status: 'not_found' });
          continue;
        }

        // Update the category
        Object.assign(category, updates);
        await category.save();

        console.log(`✅ Updated ${identifier}:`);
        console.log(`   Label: ${category.label}`);
        console.log(`   Color: ${category.color}`);
        console.log(`   Icon: ${category.icon}`);
        console.log('');

        results.push({ identifier, status: 'updated', label: category.label, color: category.color });

      } catch (error) {
        console.error(`❌ Error updating ${identifier}:`, error.message);
        results.push({ identifier, status: 'error', error: error.message });
      }
    }

    // Print summary
    console.log('\n📊 Update Summary:');
    const updated = results.filter(r => r.status === 'updated');
    const notFound = results.filter(r => r.status === 'not_found');
    const errors = results.filter(r => r.status === 'error');

    console.log(`   ✅ Updated: ${updated.length}`);
    console.log(`   ⚠️  Not Found: ${notFound.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    if (updated.length > 0) {
      console.log('\n📋 Updated Benefits:');
      updated.forEach(r => {
        console.log(`   - ${r.identifier}: ${r.label} (${r.color})`);
      });
    }

    console.log('\n🎉 Update completed!');

  } catch (error) {
    console.error('❌ Error updating benefits:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the update function
if (require.main === module) {
  updateBenefits();
}

module.exports = { benefitUpdates, updateBenefits };

