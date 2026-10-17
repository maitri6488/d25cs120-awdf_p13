const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// In-memory rate limiting map (IP / task title -> timestamp)
const rateLimitMap = new Map();
const RATE_LIMIT_SECONDS = 5; // Simple per-client rate limit to avoid quota exhaustion

// Fallback intelligent description generator (Graceful Degradation)
function generateFallbackDescription(title) {
  const lower = title.toLowerCase();
  let suggestion = `Complete the necessary action items for "${title}". Ensure all requirements are documented, verified, and aligned with project standards.`;
  let priority = 'medium';

  if (lower.includes('exam') || lower.includes('deadline') || lower.includes('urgent') || lower.includes('critical') || lower.includes('security')) {
    suggestion = `High-priority objective: Complete all deliverable criteria for "${title}" ahead of scheduled milestone review. Cross-check for zero defects and prepare compliance documentation.`;
    priority = 'high';
  } else if (lower.includes('research') || lower.includes('study') || lower.includes('read') || lower.includes('course')) {
    suggestion = `Study and research session for "${title}". Synthesize core principles, capture technical notes, and formulate actionable takeaways.`;
    priority = 'medium';
  } else if (lower.includes('clean') || lower.includes('optional') || lower.includes('backup') || lower.includes('archive')) {
    suggestion = `Maintenance task: Execute routine cleanup and housekeeping operations for "${title}".`;
    priority = 'low';
  }

  return { suggestion, priority };
}

/**
 * POST /api/ai/generate-description
 * Secure server-side route that calls OpenAI / Gemini or degrades gracefully to offline generator
 */
router.post('/generate-description', async (req, res) => {
  const { title } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Task title is required to generate an AI description'
    });
  }

  const clientKey = req.ip + '_' + title.trim().toLowerCase();
  const now = Date.now();
  if (rateLimitMap.has(clientKey)) {
    const lastRequest = rateLimitMap.get(clientKey);
    const elapsed = (now - lastRequest) / 1000;
    if (elapsed < RATE_LIMIT_SECONDS) {
      return res.status(429).json({
        success: false,
        rateLimited: true,
        message: `Rate limit active: Please wait ${Math.ceil(RATE_LIMIT_SECONDS - elapsed)} seconds before requesting AI for this task again.`
      });
    }
  }
  rateLimitMap.set(clientKey, now);

  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  // If an OpenAI API Key is provided, attempt live API call
  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const client = new OpenAI({ apiKey });
      const prompt = `You are a concise productivity assistant. Write a clear, professional 2-sentence task description and suggest a priority level ('low', 'medium', or 'high') for a task titled: "${title.trim()}". Return plain text description followed by [Priority: <level>].`;

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.7
      });

      const raw = completion.choices[0]?.message?.content || '';
      let priority = 'medium';
      let cleanDesc = raw;

      const priorityMatch = raw.match(/\[Priority:\s*(low|medium|high)\]/i);
      if (priorityMatch) {
        priority = priorityMatch[1].toLowerCase();
        cleanDesc = raw.replace(/\[Priority:\s*(low|medium|high)\]/i, '').trim();
      }

      return res.status(200).json({
        success: true,
        description: cleanDesc,
        suggestedPriority: priority,
        model: 'gpt-4o-mini',
        fallback: false,
        disclaimer: 'Note: This description is AI-generated and should be reviewed by the user.'
      });

    } catch (err) {
      console.warn(`[AI API Error] External call failed (${err.message}). Activating Graceful Degradation.`);
      // Graceful degradation: Fall through to fallback generator instead of throwing or crashing
    }
  }

  // Graceful Degradation / Fallback Path (Zero external crash risk)
  const { suggestion, priority } = generateFallbackDescription(title.trim());

  return res.status(200).json({
    success: true,
    description: suggestion,
    suggestedPriority: priority,
    model: apiKey ? 'graceful-degradation-engine' : 'built-in-semantic-generator',
    fallback: true,
    disclaimer: 'Note: This suggestion was generated via fallback intelligence and should be reviewed before saving.'
  });
});

module.exports = router;
