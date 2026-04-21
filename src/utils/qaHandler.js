// utils/qaHandler.js - OpenAI Assistant implementation (minimally improved)

const axios = require('axios');
const guideService = require('../services/guideService');

// OpenAI Assistant configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = "asst_MeHsxxAOO77rSU2KKA2vCXqF";
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID; // for file_search

const OPENAI_HEADERS = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
  'OpenAI-Beta': 'assistants=v2'
};

// Delay helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Clean response function (narrow removals, keep [] and ())
function cleanResponse(answer) {
  return String(answer || '')
    .replace(/【[^】]*】/g, '')        // Remove in-house citations
    .replace(/\b\d+:\d+†source\b/g, '')
    .replace(/†source\b/g, '')
    .replace(/[🌟🌼🙏😊✨💫]/g, '')    // Remove emojis
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// RAG: Main handler with PRE-GENERATED embeddings (super fast!)
async function handleUserQuestion(query, selectedGuide = 'abhi') {
  const lowerCaseQuery = String(query || '').toLowerCase().trim();

  // Greeting detection (more robust)
  const isGreeting = /\b(hello|hi|hey|good (morning|afternoon|evening))\b/i.test(lowerCaseQuery);
  if (isGreeting) {
    const greetings = [
      "Hello there! How can I help you today?",
      "Hi! What's on your mind?",
      "Hey! Ask me anything about The School of Breath."
    ];
    return {
      answer: greetings[Math.floor(Math.random() * greetings.length)],
      bullets: [],
      steps: [],
      shortcuts: [
        "How do I start meditation?",
        "What breathing techniques do you recommend?",
        "Tell me about your courses"
      ],
      backgroundColor: "#E8D1D1",
      source: 'greeting'
    };
  }

  try {
    const assistantResponse = await getOpenAIResponse(query, selectedGuide);

    // Always return a stable shape
    return {
      answer: assistantResponse?.answer ?? (typeof assistantResponse === 'string' ? assistantResponse : ''),
      bullets: assistantResponse?.bullets ?? [],
      steps: assistantResponse?.steps ?? [],
      shortcuts: assistantResponse?.shortcuts ?? [],
      backgroundColor: "#E8D1D1",
      source: assistantResponse?.source || 'openai_assistant'
    };
  } catch (error) {
    console.error('Error handling question:', error.message || error);
    return {
      answer: "I apologize, but I'm having trouble processing your question right now. Please try again later.",
      bullets: [],
      steps: [],
      shortcuts: [],
      backgroundColor: "#F2E8E8",
      source: 'error'
    };
  }
}

// Get response from OpenAI Assistant
async function getOpenAIResponse(query, selectedGuide = 'abhi') {
  if (!OPENAI_API_KEY || !ASSISTANT_ID) {
    console.error('OpenAI API key or Assistant ID not found');
    return {
      answer: "I apologize, but I'm having trouble accessing my knowledge base right now. Please try again later.",
      bullets: [],
      steps: [],
      shortcuts: []
    };
  }

  try {
    const guideContext = await guideService.getGuideSystemPrompt(selectedGuide);

    // 1. Create a thread with metadata (required by latest API)
    const threadRes = await axios.post('https://api.openai.com/v1/threads', {
      metadata: {
        source: 'breathwork_app',
        guide: selectedGuide,
        timestamp: new Date().toISOString()
      }
    }, { headers: OPENAI_HEADERS });

    if (!threadRes.data?.id) throw new Error('Failed to create thread: No thread ID returned');
    const threadId = threadRes.data.id;
    console.log('Thread created:', threadId);

    // 2. Add user message (user text only; move context to run.instructions)
    const messageRes = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      { role: 'user', content: String(query || '') },
      { headers: OPENAI_HEADERS }
    );
    if (!messageRes.data?.id) throw new Error('Failed to add message: No message ID returned');
    console.log('Message added:', messageRes.data.id);

    // 3. Run the assistant (attach vector store; fix instructions; update model)
    const runRes = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        assistant_id: ASSISTANT_ID,
        model: "gpt-4.1-mini",
        tools: [{ type: "file_search" }],
        ...(VECTOR_STORE_ID ? { tool_resources: { file_search: { vector_store_ids: [VECTOR_STORE_ID] } } } : {}),
        instructions: `${guideContext}

INSTRUCTIONS:
ROLE
• Act as the selected guide (“${selectedGuide}”) for The School of Breath.

SOURCES
• Use ONLY the provided knowledge base: FAQs format and files via file_search.
• Do NOT invent facts. If information is missing, return empty fields.

OUTPUT
• Return VALID JSON ONLY. No prose outside JSON. No code fences. No emojis.
• Keys exactly: answer, shortcuts.

MATCHING FLOW
1) Try to match the user query to the best FAQ.
2) You can also consult the uploaded documents via file_search for supporting information.
3) If nothing relevant is found, is nothing matched produce empty fields per schema.

CONTENT RULES
• “answer”: Markdown format for  paragraphs, headings,bold words and lists.
• Append at the very end of “answer”: " For more visit www.youtube.com/@TheSchoolofBreath, www.meditatewithabhi.com"
• “shortcuts”: up to 4 related questions  and knowledge base.

MARKDOWN RULES (CommonMark/GitHub basics)
• Paragraphs: separate blocks with a single blank line; avoid trailing spaces.
• Headings: "# ", "## ", "### " when helpful; prefer plain paragraphs unless sectioning is requested.
• Emphasis: **bold** (or __bold__), *italic* (or _italic_). Use sparingly.
• Bulleted lists: each item starts with "- " (or "* "); add a blank line before the list; one item per line.
• Ordered lists: "1. ", "2. ", … with exactly one space after the marker.
• Nested lists: indent sub-items by 2–4 spaces under the parent item.
• Links: don't use links.
• Code blocks: avoid unless explicitly requested; don’t include fenced code in normal answers.
• Tables/images/footnotes: avoid unless the user asks.
• Do not use raw HTML; do not use emojis.

SCHEMA (MUST MATCH EXACTLY)
{ "answer": "<Markdown string>",  "shortcuts": ["string"] }

EMPTY CASE
{ "answer": "", "shortcuts": [] }

VALIDATION
• If your draft is not valid JSON per the schema, regenerate until it is valid.`
      },
      { headers: OPENAI_HEADERS }
    );
    if (!runRes.data?.id) throw new Error('Failed to create run: No run ID returned');
    const runId = runRes.data.id;
    console.log('Run created:', runId);

    // 4. Poll until completion with timeout
    let runStatus = 'queued';
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (['queued', 'in_progress'].includes(runStatus) && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;

      try {
        const statusRes = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          { headers: OPENAI_HEADERS }
        );

        runStatus = statusRes.data.status;
        console.log(`Run status (attempt ${attempts}):`, runStatus);

        if (runStatus === 'failed') {
          const errorDetails = statusRes.data.last_error;
          throw new Error(`Assistant run failed: ${errorDetails?.message || 'Unknown error'}`);
        }
        if (runStatus === 'expired') throw new Error('Assistant run expired');
        if (runStatus === 'cancelled') throw new Error('Assistant run was cancelled');

        if (runStatus === 'in_progress') {
          await sleep(500);
        }
        if (runStatus === 'completed') {
          await sleep(500);
          break;
        }
      } catch (error) {
        if (error.response?.status === 429) {
          console.log('Rate limited, waiting 2 seconds...');
          await sleep(2000);
          continue;
        }
        throw error;
      }
    }

    if (attempts >= maxAttempts) throw new Error('Assistant run timed out');

    // 5. Get messages with proper error handling
    const messagesRes = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      { headers: OPENAI_HEADERS }
    );
    if (!messagesRes.data?.data || !Array.isArray(messagesRes.data.data)) {
      throw new Error('Invalid messages response structure');
    }

    const assistantMessage = messagesRes.data.data.find(msg => msg.role === 'assistant');
    if (!assistantMessage) throw new Error('No assistant message found in response');

    // Combine all text parts; handle code-fenced JSON
    const parts = (assistantMessage.content || [])
      .map(p => p?.text?.value || p?.text || '')
      .filter(Boolean);
    const raw = parts.join('\n');
    const jsonText = raw.replace(/^```json\s*|\s*```$/g, '');

    // Parse JSON; fallback to plain text
    let jsonResponse = null;
    try { jsonResponse = JSON.parse(jsonText); } catch {}

    if (jsonResponse && typeof jsonResponse === 'object') {
      const response = {
        answer: cleanResponse(jsonResponse.answer || ""),
        bullets: Array.isArray(jsonResponse.bullets) ? jsonResponse.bullets.filter(Boolean) : [],
        steps: Array.isArray(jsonResponse.steps) ? jsonResponse.steps.filter(Boolean) : [],
        shortcuts: Array.isArray(jsonResponse.shortcuts) ? jsonResponse.shortcuts.filter(Boolean) : [],
        source: 'openai_assistant_json'
      };
      return response;
    }

    // Fallback to plain text response (wrap into schema)
    return {
      answer: cleanResponse(jsonText || raw),
      bullets: [],
      steps: [],
      shortcuts: [],
      source: 'openai_assistant'
    };

  } catch (error) {
    console.error('Error getting OpenAI Assistant response:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    if (error.response?.status === 400) {
      return { answer: "I apologize, but there was an issue with the request format. Please try rephrasing your question.", bullets: [], steps: [], shortcuts: [] };
    } else if (error.response?.status === 401) {
      return { answer: "I apologize, but there's an authentication issue. Please contact support.", bullets: [], steps: [], shortcuts: [] };
    } else if (error.response?.status === 429) {
      return { answer: "I apologize, but the service is currently busy. Please try again in a moment.", bullets: [], steps: [], shortcuts: [] };
    } else if (error.response?.status >= 500) {
      return { answer: "I apologize, but the service is experiencing technical difficulties. Please try again later.", bullets: [], steps: [], shortcuts: [] };
    }
    return { answer: "I apologize, but I'm having trouble connecting to my knowledge base right now. Please try again later.", bullets: [], steps: [], shortcuts: [] };
  }
}

// Log unanswered questions
async function logUnansweredQuestion(question, userId = null) {
  try {
    console.log(`Unanswered question logged: "${question}" from user ${userId || 'anonymous'}`);
  } catch (error) {
    console.error('Error logging unanswered question:', error.message || error);
  }
}

// Test function to verify cleanResponse works correctly
function testCleanResponse() {
  const testCases = [
    "To start a daily practice, try the 9Day Breathwork Challenge for Energy, Health & Vitality. Visit www.youtube.com/Theschoolofbreath.",
    "Some text with 4:15†source and emojis 🌟🌼🙏"
  ];

  console.log('Testing cleanResponse function:');
  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}:`);
    console.log('Before:', testCase);
    console.log('After:', cleanResponse(testCase));
  });
}

// Uncomment the line below to test the cleaning function
// testCleanResponse();

module.exports = {
  // Core RAG functions
  handleUserQuestion,
  getOpenAIResponse,
  logUnansweredQuestion,
  testCleanResponse
};