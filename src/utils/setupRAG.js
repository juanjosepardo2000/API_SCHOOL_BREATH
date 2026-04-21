// utils/setupRAG.js - Setup script for RAG with External Tools
const FAQ = require('../models/faq.model');
const { OPENAI_API_KEY } = require('../configs/vars');
const { generateAllFAQEmbeddings, setupVectorSearchIndex } = require('./qaHandler');

// Check if OpenAI API key is available
function checkOpenAIKey() {
  if (!OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('📝 Please add OPENAI_API_KEY to your .env file or configs/vars.js');
    console.log('🔑 Get your key from: https://platform.openai.com/api-keys');
    return false;
  }
  console.log('✅ OPENAI_API_KEY found');
  return true;
}

// Initialize metrics for existing FAQs
async function initializeMetrics() {
  try {
    console.log('📊 Initializing metrics for existing FAQs...');
    
    const faqsWithoutMetrics = await FAQ.find({
      $or: [
        { views: { $exists: false } },
        { lastAccessed: { $exists: false } }
      ]
    });
    
    if (faqsWithoutMetrics.length === 0) {
      console.log('✅ All FAQs already have metrics');
      return;
    }
    
    console.log(`Found ${faqsWithoutMetrics.length} FAQs without metrics`);
    
    for (const faq of faqsWithoutMetrics) {
      await FAQ.findByIdAndUpdate(faq._id, {
        $set: {
          views: 0,
          lastAccessed: faq.createdAt || new Date()
        }
      });
    }
    
    console.log('✅ Metrics initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing metrics:', error);
  }
}

// Main setup function
async function setupRAG() {
  try {
    console.log('🚀 Setting up RAG system with External Tools...\n');
    
    // Step 1: Check OpenAI API key
    if (!checkOpenAIKey()) {
      console.log('\n⚠️  Setup cannot continue without OpenAI API key');
      return;
    }
    
    // Step 2: Initialize metrics
    await initializeMetrics();
    
    // Step 3: Setup MongoDB Atlas Vector Search index
    console.log('\n🗄️  Setting up MongoDB Atlas Vector Search...');
    await setupVectorSearchIndex();
    
    // Step 4: Generate embeddings for all FAQs
    console.log('\n🧠 Generating OpenAI embeddings for FAQs...');
    await generateAllFAQEmbeddings();
    
    console.log('\n✅ RAG setup completed successfully!');
    console.log('\n🎯 Your FAQ system is now powered by:');
    console.log('- OpenAI text-embedding-3-small for semantic understanding');
    console.log('- MongoDB Atlas Vector Search for fast similarity search');
    console.log('- RAG pipeline for intelligent response generation');
    console.log('- No more hardcoded responses!');
    
    console.log('\n📋 Next steps:');
    console.log('1. Create the vector search index in MongoDB Atlas');
    console.log('2. Test your RAG system with questions');
    console.log('3. Monitor performance and adjust as needed');
    
  } catch (error) {
    console.error('❌ RAG setup failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  setupRAG().then(() => {
    console.log('\nSetup complete. Exiting...');
    process.exit(0);
  }).catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { 
  setupRAG, 
  initializeMetrics,
  checkOpenAIKey
};
