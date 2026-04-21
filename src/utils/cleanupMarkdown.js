// utils/cleanupMarkdown.js - Clean up markdown and long responses in FAQs
const { withDatabaseConnection } = require('./dbConnection');
const FAQ = require('../models/faq.model');

// Clean markdown from text
function cleanMarkdown(text) {
  if (!text) return text;
  
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')           // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1')               // Remove *italic*
    .replace(/##\s*/g, '')                     // Remove ## headers
    .replace(/#\s*/g, '')                      // Remove # headers
    .replace(/-\s*/g, '')                      // Remove - lists
    .replace(/\n\s*\n/g, '\n')                // Remove extra line breaks
    .replace(/^\s+|\s+$/g, '')                // Trim whitespace
    .replace(/[🌟🌼🙏😊✨💫💫🎯🚀🔧💡⏰🎉✅❌🔄📊🧪🔍🗄️🔌📝🔑]/g, '') // Remove emojis
    .replace(/\s+/g, ' ')                     // Normalize spaces
    .trim();
}

// Shorten long responses
function shortenResponse(text, maxLength = 200) {
  if (!text || text.length <= maxLength) return text;
  
  // Try to find a good breaking point
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let result = '';
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if ((result + trimmed).length > maxLength) {
      break;
    }
    result += (result ? '. ' : '') + trimmed;
  }
  
  return result + (result.endsWith('.') ? '' : '.');
}

// Clean up all FAQs
async function cleanupFAQs() {
  try {
    console.log('🧹 Starting FAQ cleanup...\n');
    
    const allFAQs = await FAQ.find({});
    console.log(`📊 Found ${allFAQs.length} FAQs to process`);
    
    let updatedCount = 0;
    let cleanedCount = 0;
    
    for (const faq of allFAQs) {
      let needsUpdate = false;
      let originalAnswer = faq.answer;
      
      // Clean markdown
      const cleanedAnswer = cleanMarkdown(faq.answer);
      if (cleanedAnswer !== faq.answer) {
        faq.answer = cleanedAnswer;
        needsUpdate = true;
        cleanedCount++;
      }
      
      // Shorten if too long
      const shortenedAnswer = shortenResponse(faq.answer, 200);
      if (shortenedAnswer !== faq.answer) {
        faq.answer = shortenedAnswer;
        needsUpdate = true;
      }
      
      // Update if needed
      if (needsUpdate) {
        await FAQ.findByIdAndUpdate(faq._id, {
          $set: { 
            answer: faq.answer,
            updatedAt: new Date()
          }
        });
        updatedCount++;
        
        console.log(`✅ Updated: ${faq.question.substring(0, 50)}...`);
        console.log(`   Before: ${originalAnswer.substring(0, 100)}...`);
        console.log(`   After:  ${faq.answer.substring(0, 100)}...`);
        console.log('');
      }
    }
    
    console.log('🎉 FAQ cleanup completed!');
    console.log(`📊 Total FAQs processed: ${allFAQs.length}`);
    console.log(`🧹 Markdown cleaned: ${cleanedCount}`);
    console.log(`✂️  Responses shortened: ${updatedCount}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('🧹 FAQ Markdown Cleanup Script\n');
    
    await withDatabaseConnection(async (connection) => {
      await cleanupFAQs();
    });
    
  } catch (error) {
    console.error('Main execution failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  main().then(() => {
    console.log('\nCleanup script completed. Exiting...');
    process.exit(0);
  }).catch(error => {
    console.error('Cleanup script failed:', error);
    process.exit(1);
  });
}

module.exports = { cleanupFAQs, cleanMarkdown, shortenResponse };
