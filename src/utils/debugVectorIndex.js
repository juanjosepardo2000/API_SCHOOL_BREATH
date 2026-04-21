// utils/debugVectorIndex.js - Debug MongoDB Atlas Vector Search index
const { withDatabaseConnection } = require('./dbConnection');
const FAQ = require('../models/faq.model');

// Debug vector search index
async function debugVectorIndex() {
  try {
    console.log('🔍 Debugging MongoDB Atlas Vector Search Index...\n');
    
    // Test 1: Check if we can query the index at all
    console.log('🧪 Test 1: Basic vector search with dummy vector...');
    try {
      const dummyVector = new Array(1536).fill(0.1); // Create a dummy 1536-dimensional vector
      
      const results = await FAQ.aggregate([
        {
          $vectorSearch: {
            queryVector: dummyVector,
            path: "embedding",
            numCandidates: 10,
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
      
      console.log(`✅ Basic vector search: Found ${results.length} results`);
      if (results.length > 0) {
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. Score: ${result.score.toFixed(4)} - ${result.question.substring(0, 50)}...`);
        });
      }
    } catch (error) {
      console.log('❌ Basic vector search failed:', error.message);
    }
    
    // Test 2: Check if we can find any documents with embeddings
    console.log('\n🧪 Test 2: Checking documents with embeddings...');
    const faqWithEmbedding = await FAQ.findOne({ 
      embedding: { $exists: true, $ne: [] } 
    });
    
    if (faqWithEmbedding) {
      console.log('✅ Found FAQ with embedding:');
      console.log(`Question: ${faqWithEmbedding.question.substring(0, 50)}...`);
      console.log(`Embedding length: ${faqWithEmbedding.embedding.length}`);
      console.log(`First 5 values: [${faqWithEmbedding.embedding.slice(0, 5).join(', ')}]`);
      
      // Test 3: Try vector search with this FAQ's own embedding
      console.log('\n🧪 Test 3: Vector search with FAQ\'s own embedding...');
      try {
        const selfSearchResults = await FAQ.aggregate([
          {
            $vectorSearch: {
              queryVector: faqWithEmbedding.embedding,
              path: "embedding",
              numCandidates: 10,
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
        
        console.log(`✅ Self-search: Found ${selfSearchResults.length} results`);
        if (selfSearchResults.length > 0) {
          selfSearchResults.forEach((result, index) => {
            console.log(`  ${index + 1}. Score: ${result.score.toFixed(4)} - ${result.question.substring(0, 50)}...`);
          });
        }
      } catch (error) {
        console.log('❌ Self-search failed:', error.message);
      }
    } else {
      console.log('❌ No FAQs with embeddings found!');
    }
    
    // Test 4: Check if the index exists and has data
    console.log('\n🧪 Test 4: Checking index status...');
    try {
      // This will show us if the index exists and has data
      const indexInfo = await mongoose.connection.db.admin().listIndexes();
      console.log('📊 Available indexes:');
      indexInfo.forEach(index => {
        console.log(`  - ${index.name}: ${index.type}`);
      });
    } catch (error) {
      console.log('❌ Could not list indexes:', error.message);
    }
    
  } catch (error) {
    console.error('Error debugging vector index:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('🔧 MongoDB Atlas Vector Search Debug Script\n');
    
    await withDatabaseConnection(async (connection) => {
      await debugVectorIndex();
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

module.exports = { debugVectorIndex };
