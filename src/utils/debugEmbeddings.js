// utils/debugEmbeddings.js - Debug script to check embeddings and vector search
const { withDatabaseConnection } = require('./dbConnection');
const FAQ = require('../models/faq.model');

// Check FAQ embeddings
async function checkFAQEmbeddings() {
  try {
    console.log('🔍 Checking FAQ embeddings...\n');
    
    // Count total FAQs
    const totalFAQs = await FAQ.countDocuments();
    console.log(`📊 Total FAQs: ${totalFAQs}`);
    
    // Count FAQs with embeddings
    const faqsWithEmbeddings = await FAQ.countDocuments({ 
      embedding: { $exists: true, $ne: [] } 
    });
    console.log(`✅ FAQs with embeddings: ${faqsWithEmbeddings}`);
    console.log(`❌ FAQs without embeddings: ${totalFAQs - faqsWithEmbeddings}`);
    
    // Check specific FAQ
    const holisticFAQ = await FAQ.findOne({
      $or: [
        { question: { $regex: 'holistic', $options: 'i' } },
        { answer: { $regex: 'holistic', $options: 'i' } }
      ]
    });
    
    if (holisticFAQ) {
      console.log('\n🎯 Found Holistic FAQ:');
      console.log(`Question: ${holisticFAQ.question}`);
      console.log(`Answer: ${holisticFAQ.answer.substring(0, 100)}...`);
      console.log(`Has embedding: ${holisticFAQ.embedding ? '✅ Yes' : '❌ No'}`);
      if (holisticFAQ.embedding) {
        console.log(`Embedding dimensions: ${holisticFAQ.embedding.length}`);
      }
    } else {
      console.log('\n❌ No Holistic FAQ found!');
    }
    
    // Test vector search manually
    if (holisticFAQ && holisticFAQ.embedding) {
      console.log('\n🧪 Testing vector search manually...');
      
      try {
        const results = await FAQ.aggregate([
          {
            $vectorSearch: {
              queryVector: holisticFAQ.embedding, // Use the FAQ's own embedding as query
              path: "embedding",
              numCandidates: 100,
              limit: 5,
              index: "faq_vector_index"
            }
          },
          {
            $project: {
              question: 1,
              answer: 1,
              score: { $meta: "vectorSearchScore" }
            }
          }
        ]);
        
        console.log(`✅ Vector search test successful! Found ${results.length} results`);
        results.forEach((result, index) => {
          console.log(`${index + 1}. Score: ${result.score.toFixed(4)} - ${result.question.substring(0, 50)}...`);
        });
        
      } catch (error) {
        console.log('❌ Vector search test failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error checking embeddings:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('🔧 FAQ Embeddings Debug Script\n');
    
    await withDatabaseConnection(async (connection) => {
      await checkFAQEmbeddings();
    });
    
  } catch (error) {
    console.error('Main execution failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  main().then(() => {
    console.log('\nDebug script completed. Exiting...');
    process.exit(0);
  }).catch(error => {
    console.error('Debug script failed:', error);
    process.exit(1);
  });
}

module.exports = { checkFAQEmbeddings };
