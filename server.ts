import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { KnowledgeBaseService } from './src/server/knowledgeBase.ts';
import { studentLearningMemory } from './src/server/studentLearningMemory.ts';
import { createSupabaseRestClient } from './src/server/supabaseRest.ts';
import { SupabaseMemorySync } from './src/server/supabaseMemorySync.ts';
import { verifySupabaseAccessToken, userCanAccessStudent, AuthUser } from './src/server/supabaseAuth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isSafeText(value: unknown, max = 2000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

const tutorRate = new Map<string, { count: number; resetAt: number }>();
function checkTutorRateLimit(studentId: string): boolean {
  const now = Date.now();
  const current = tutorRate.get(studentId);
  if (!current || now >= current.resetAt) {
    tutorRate.set(studentId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

function validateTutorContext(body: any): string | null {
  if (!body?.student || !isSafeId(body.student.id)) return 'A valid student id is required.';
  if (!body?.subject || !isSafeId(body.subject.id)) return 'A valid subject id is required.';
  if (body.chapter?.id && !isSafeId(body.chapter.id)) return 'Invalid chapter id.';
  if (body.topic !== undefined && !isSafeText(body.topic, 300)) return 'Invalid topic.';
  if (!['learn', 'ask', 'practice', 'quiz', 'revision'].includes(body.mode || 'learn')) return 'Invalid tutor mode.';
  if (!Array.isArray(body.messages) || body.messages.length > 50) return 'Invalid conversation history.';
  return null;
}

// Initialize Google GenAI with recommended header and API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Initialize Knowledge Base Service
const knowledgeBase = new KnowledgeBaseService(ai);
const supabaseMemorySync = new SupabaseMemorySync(createSupabaseRestClient(), studentLearningMemory);
const supabaseDb = createSupabaseRestClient();
const authRequired = process.env.SUPABASE_AUTH_REQUIRED === 'true' || (!!supabaseDb && process.env.SUPABASE_AUTH_REQUIRED !== 'false');
const durableMemoryRequired = process.env.SUPABASE_DURABLE_MEMORY_REQUIRED === 'true' || (!!supabaseDb && process.env.SUPABASE_DURABLE_MEMORY_REQUIRED !== 'false');

// Authentication is enforced only when Supabase is configured (or explicitly required).
// This keeps local/demo mode usable while making production mode fail closed.
async function requireAuth(req: any, res: any, next: any) {
  if (!authRequired) return next();
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ success: false, errorCode: 'AUTH_REQUIRED', error: 'Authentication required.' });
  try {
    const user = await verifySupabaseAccessToken(match[1]);
    if (!user) return res.status(401).json({ success: false, errorCode: 'AUTH_INVALID', error: 'Invalid or expired authentication token.' });
    req.authUser = user;
    return next();
  } catch (error) {
    console.warn('[Auth] Token validation failed:', error);
    return res.status(401).json({ success: false, errorCode: 'AUTH_INVALID', error: 'Invalid or expired authentication token.' });
  }
}

async function requireStudentAccess(req: any, res: any, next: any) {
  if (!authRequired) return next();
  if (!supabaseDb || !req.authUser) return res.status(503).json({ success: false, errorCode: 'AUTH_CONFIG_REQUIRED', error: 'Authentication storage is not configured.' });
  try {
    const allowed = await userCanAccessStudent(supabaseDb, req.authUser.id, req.params.id || req.body?.student?.id);
    if (!allowed) return res.status(403).json({ success: false, errorCode: 'STUDENT_ACCESS_DENIED', error: 'You are not authorized to access this student.' });
    return next();
  } catch (error) {
    console.error('[Auth] Student authorization failed:', error);
    return res.status(403).json({ success: false, errorCode: 'STUDENT_ACCESS_DENIED', error: 'Student access could not be verified.' });
  }
}


// Secure short-lived token for the browser's Gemini Live API voice session.
// The long-lived GEMINI_API_KEY never leaves the server.
app.post('/api/ai-assistant/token', requireAuth, async (req, res) => {
  try {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        errorCode: 'GEMINI_API_KEY_MISSING',
        error: 'Voice AI is not configured on the server.',
      });
    }

    const now = Date.now();
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: 'models/gemini-3.8-live',
          config: {
            responseModalities: ['AUDIO'],
            sessionResumption: {},
            contextWindowCompression: { slidingWindow: {} },
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.name) {
      console.error('[AI Assistant] Ephemeral token provisioning failed:', data);
      return res.status(502).json({
        success: false,
        errorCode: 'LIVE_TOKEN_FAILED',
        error: 'Could not start the voice assistant session.',
      });
    }

    return res.json({
      success: true,
      token: data.name,
      expiresAt: data.expireTime || null,
      model: 'gemini-3.8-live',
    });
  } catch (error: any) {
    console.error('[AI Assistant] Token endpoint error:', error);
    return res.status(502).json({
      success: false,
      errorCode: 'LIVE_TOKEN_ERROR',
      error: 'Could not start the voice assistant session.',
    });
  }
});

app.use('/api/tutor/chat', requireAuth);
app.use('/api/tutor/hint', requireAuth);
app.use('/api/knowledge', requireAuth);

// Knowledge-base mutations are privileged operations. Authenticated student/parent
// sessions may read/search knowledge, but only explicitly allowlisted operator
// identities may upload or delete documents. Configure a comma-separated list of
// Supabase Auth user IDs in KNOWLEDGE_ADMIN_USER_IDS.
function requireKnowledgeAdmin(req: any, res: any, next: any) {
  if (!authRequired) return next();
  const configured = String(process.env.KNOWLEDGE_ADMIN_USER_IDS || '')
    .split(',').map(v => v.trim()).filter(Boolean);
  if (!configured.length) {
    return res.status(503).json({ success: false, errorCode: 'KNOWLEDGE_ADMIN_NOT_CONFIGURED', error: 'Knowledge administration is not configured.' });
  }
  if (!req.authUser || !configured.includes(req.authUser.id)) {
    return res.status(403).json({ success: false, errorCode: 'KNOWLEDGE_ADMIN_REQUIRED', error: 'Knowledge administration requires an authorized operator account.' });
  }
  return next();
}

app.use('/api/knowledge/upload', requireKnowledgeAdmin);
app.use('/api/knowledge/documents/:id', requireKnowledgeAdmin);
app.use('/api/student/:id', requireAuth, requireStudentAccess);
if (supabaseMemorySync.enabled) console.log('[Data] Supabase durable-memory mode enabled.');
if (durableMemoryRequired && !supabaseMemorySync.enabled) console.warn('[Data] Durable memory is required but Supabase is not configured. Student writes will be rejected.');

// List of supported Google AI Studio models in order of priority:
// 1. gemini-3.1-flash-lite: Ultra-fast, lightweight, highly responsive, healthy quota
// 2. gemini-flash-latest: Modern fast model
// 3. gemma-4-26b-a4b-it: Fallback open-weights model
const TUTOR_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemma-4-26b-a4b-it',
];

async function callGeminiWithCascade(params: {
  contents: string;
  systemInstruction: string;
  useStructuredOutput?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (const model of TUTOR_MODELS) {
    try {
      console.log(`[AI Tutor] Attempting generation with model: ${model}`);
      const config: any = {
        systemInstruction: params.systemInstruction,
        // Athmik Tutor prioritizes fast interactive replies.
        thinkingConfig: { thinkingLevel: 'minimal' },
        maxOutputTokens: 800,
        // Do not let transient 429/5xx retries turn a short tutor question
        // into a long wait. The caller already has a model cascade/fallback.
        httpOptions: {
          timeout: 9000,
          retryOptions: { attempts: 1 },
        },
      };

      if (params.useStructuredOutput && !model.includes('gemma')) {
        config.responseMimeType = 'application/json';
        config.responseSchema = {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'The tutor message to the student',
            },
            evaluation: {
              type: Type.OBJECT,
              properties: {
                status: {
                  type: Type.STRING,
                  description: 'correct, partially_correct, incorrect, or unclear',
                },
                feedback: {
                  type: Type.STRING,
                  description: 'Encouraging evaluation feedback',
                },
                scoreDelta: {
                  type: Type.NUMBER,
                  description: 'Score delta (0 to 10)',
                },
                conceptUnderstood: {
                  type: Type.STRING,
                  description: 'Concept understood or empty string',
                },
                mistake: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
              },
            },
            suggestedReplies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 3 quick clickable response suggestions',
            },
            difficultyAdjustment: {
              type: Type.INTEGER,
              description: '-1 to lower difficulty, 0 to keep same, 1 to raise difficulty',
            },
            usedSourceIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exact source IDs from the retrieved knowledge context that were actually used. Empty if none.',
            },
          },
          required: ['reply', 'suggestedReplies'],
        };
      }

      const res = await ai.models.generateContent({
        model,
        contents: params.contents,
        config,
      });

      if (res && res.text) {
        console.log(`[AI Tutor] Success with model: ${model}`);
        return { text: res.text, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[AI Tutor] Model ${model} encountered issue (${err?.status || err?.message?.slice(0, 60)}). Trying next candidate...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models in cascade failed');
}

function parseTutorResponse(rawText: string) {
  if (!rawText || !rawText.trim()) {
    throw new Error('AI_RESPONSE_EMPTY');
  }

  let cleaned = rawText.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.reply === 'string') {
      return {
        reply: parsed.reply,
        evaluation: parsed.evaluation || undefined,
        suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0
          ? parsed.suggestedReplies
          : ["I'm ready!", 'Can you explain more?', 'Let us practice!'],
        difficultyAdjustment: typeof parsed.difficultyAdjustment === 'number' ? parsed.difficultyAdjustment : 0,
        usedSourceIds: Array.isArray(parsed.usedSourceIds) ? parsed.usedSourceIds.filter((id: any) => typeof id === 'string') : [],
      };
    }
  } catch {
    // If not JSON, return clean conversational text
  }

  return {
    reply: cleaned.replace(/```[a-z]*|```/g, '').trim(),
    suggestedReplies: ["I'm ready!", 'Can you explain with an example?', 'Give me a question!'],
    difficultyAdjustment: 0,
    usedSourceIds: [],
  };
}

function generateCurriculumFallbackResponse(params: {
  studentName: string;
  subjectName: string;
  chapterName: string;
  currentTopic: string;
  mode: string;
  effectiveDifficulty: number;
  effectiveMastery: number;
  isStudentAnswer: boolean;
  lastAssistantMsg: any;
  lastUserMsg: any;
  unresolvedMistakes: any[];
  hasRetrievedKnowledge: boolean;
  ragSearchResult: any;
  quizIndex?: number;
}) {
  const {
    studentName,
    chapterName,
    currentTopic,
    mode,
    effectiveDifficulty,
    isStudentAnswer,
    lastAssistantMsg,
    lastUserMsg,
    quizIndex = 1,
  } = params;

  if (isStudentAnswer && lastAssistantMsg && lastUserMsg) {
    const detEval = studentLearningMemory.evaluateDeterministicAnswer(
      lastAssistantMsg.content,
      lastUserMsg.content
    );

    if (detEval.isDeterministic && detEval.isCorrect !== undefined) {
      if (detEval.isCorrect) {
        return {
          reply: `Super thinking, ${studentName}! ${lastUserMsg.content} is exactly right! You solved that like a champion mathematician. Here is your next question: A motor boat travels 20 km in 1 hour. How far can it travel in 6 hours?`,
          evaluation: {
            status: 'correct',
            feedback: `Super thinking! ${lastUserMsg.content} is exactly correct!`,
            scoreDelta: 10,
            conceptUnderstood: currentTopic,
            mistake: null,
          },
          suggestedReplies: ['120 km', '100 km', '80 km'],
          difficultyAdjustment: 1,
        };
      } else {
        return {
          reply: `Good attempt, ${studentName}! The correct answer is ${detEval.expectedValue}. Remember to multiply the rate by the quantity: step by step! Let's try another fun one: If 1 kg of sardines costs ₹40, how much will 3 kg cost?`,
          evaluation: {
            status: 'incorrect',
            feedback: `Good attempt! The correct answer is ${detEval.expectedValue}. Let's look at that step together!`,
            scoreDelta: 0,
            conceptUnderstood: null,
            mistake: {
              type: 'calculation',
              description: `Calculation check on ${currentTopic}`,
            },
          },
          suggestedReplies: ['₹120', '₹80', 'Can you give a hint?'],
          difficultyAdjustment: -1,
        };
      }
    }

    const userText = lastUserMsg.content.toLowerCase();
    const isAffirmative = userText.includes('ready') || userText.includes('yes') || userText.includes('start') || userText.includes("let's") || userText.includes('sure');
    if (isAffirmative) {
      return {
        reply: `Awesome enthusiasm! Here is your question for ${currentTopic} (Difficulty Level ${effectiveDifficulty} of 5):\n\nA log boat travels about 4 km in 1 hour. How long will it take to go a distance of 10 km?`,
        evaluation: undefined,
        suggestedReplies: ['2 hours and 30 minutes', '2 hours', '3 hours'],
        difficultyAdjustment: 0,
      };
    }

    // Never invent a correctness result when the AI evaluator is unavailable.
    // The previous fallback incorrectly treated every non-deterministic answer as
    // correct, which could make a wrong quiz answer appear correct and inflate score.
    return {
      reply: `Good effort, ${studentName}! I want to check that answer carefully against the question before scoring it. Let's try the question once more, or ask me for a hint.`,
      evaluation: undefined,
      suggestedReplies: ['Try again', 'Give me a hint', 'Explain the question'],
      difficultyAdjustment: 0,
    };
  }

  switch (mode) {
    case 'learn':
      return {
        reply: `Hi ${studentName}! Welcome to **${chapterName}**! In this chapter, we explore **${currentTopic}** using real-life examples like boats, fishermen, and fish markets. For example, a simple log boat goes 4 km in 1 hour. In 2 hours, how far does it travel?`,
        suggestedReplies: ['8 km', '6 km', 'Can you explain the formula?'],
        difficultyAdjustment: 0,
      };
    case 'practice':
      return {
        reply: `Welcome to Practice Mode! Let's try an interactive problem at Difficulty Level ${effectiveDifficulty} of 5:\n\nFloramma sells prawns for ₹150 for 1 kg. How much money should Athmik pay if he buys 2 kg?`,
        suggestedReplies: ['₹300', '₹250', '₹150'],
        difficultyAdjustment: 0,
      };
    case 'quiz':
      return {
        reply: `Welcome to the 5-Question CBSE Challenge for **${chapterName}**! Question ${quizIndex} of 5:\n\nIf 20 women each save ₹25 every month in their Meenkar Bank, how much money is collected each month in total?`,
        suggestedReplies: ['₹500', '₹250', '₹400'],
        difficultyAdjustment: 0,
      };
    case 'revision':
      return {
        reply: `Welcome to Revision! Let's review key concepts for **${currentTopic}**.\n\nRemember:\n• Speed = Distance ÷ Time\n• Distance = Speed × Time\n\nIf a motor boat travels at 20 km in 1 hour, how far will it travel in 6 hours?`,
        suggestedReplies: ['120 km', '100 km', 'Explain step-by-step'],
        difficultyAdjustment: 0,
      };
    case 'ask':
    default:
      return {
        reply: `I'm right here to answer any Class 5 CBSE question about **${chapterName}** and **${currentTopic}**. What would you like to explore together?`,
        suggestedReplies: ['How fast do different boats travel?', 'What is Meenkar Bank?', 'How to find price per kg?'],
        difficultyAdjustment: 0,
      };
  }
}

// Primary Tutor Chat Endpoint
app.post('/api/tutor/chat', async (req, res) => {
  const requestStartedAt = Date.now();
  try {
    const {
      student,
      subject,
      chapter,
      topic,
      mode = 'learn',
      messages = [],
      difficultyLevel = 2,
      previousMistakes = [],
      quizIndex = 1,
      isHomeworkHelp = false,
      currentMastery = 0,
    } = req.body;

    const contextError = validateTutorContext(req.body);
    if (contextError) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_CONTEXT', error: contextError });
    }

    const studentId = student.id;
    const authUser = (req as express.Request & { authUser?: AuthUser }).authUser;
    const authStageStartedAt = Date.now();
    if (authRequired && supabaseDb && authUser) {
      const [allowed] = await Promise.all([
        userCanAccessStudent(supabaseDb, authUser.id, studentId),
        supabaseMemorySync.hydrateStudent(studentId),
      ]);
      if (!allowed) return res.status(403).json({ success: false, errorCode: 'STUDENT_ACCESS_DENIED', error: 'You are not authorized to access this student.' });
    } else {
      await supabaseMemorySync.hydrateStudent(studentId);
    }
    console.log(`[TutorTiming] access+hydration=${Date.now() - authStageStartedAt}ms student=${studentId}`);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) throw new Error('DURABLE_MEMORY_NOT_CONFIGURED');
    if (!checkTutorRateLimit(studentId)) {
      return res.status(429).json({ success: false, errorCode: 'RATE_LIMITED', error: 'Too many tutor requests. Please wait a moment and try again.' });
    }
    const studentName = isSafeText(student.name, 120) ? student.name.trim() : 'Student';
    const studentClass = isSafeText(student.class, 20) ? student.class.trim() : '5';
    const studentBoard = isSafeText(student.board, 40) ? student.board.trim() : 'CBSE';
    const academicYear = isSafeText(student.academic_year, 30) ? student.academic_year.trim() : 'Unknown';
    const schoolName = isSafeText(student.school_name, 160) ? student.school_name.trim() : 'School';
    const learningPref = isSafeText(student.learning_preference, 160) ? student.learning_preference.trim() : 'Explanation + Practice';
    const subjectName = isSafeText(subject.name, 120) ? subject.name.trim() : subject.id;
    const chapterName = chapter ? `Ch ${chapter.chapter_number}: ${chapter.chapter_name}` : 'General Curriculum';
    const chapterDesc = isSafeText(chapter?.description, 1000) ? chapter.description.trim() : '';
    const currentTopic = (topic || chapter?.chapter_name || 'General Topic').trim();

    // Section 14, 15, 16: Retrieve Student Learning Memory & Historical Weaknesses
    const topicMastery = studentLearningMemory.getTopicMastery(
      studentId,
      subject?.id || 'sub_maths',
      chapter?.id || 'chap_math_1',
      currentTopic
    );
    const studentProfile = studentLearningMemory.getProfile(studentId);
    const unresolvedMistakes = studentLearningMemory.getMistakesForStudent(studentId, {
      chapter_id: chapter?.id,
      resolved: false,
    });
    const recentQuestions = studentLearningMemory.getRecentQuestionsForChapter(
      studentId,
      chapter?.id || 'chap_math_1'
    );

    // Dynamic adaptive difficulty (uses topic's current level unless explicitly overridden)
    const effectiveDifficulty = topicMastery.difficulty_level || 2;
    const effectiveMastery = topicMastery.mastery_score;

    // Extract student query for RAG retrieval
    const latestUserMessage = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')?.content || currentTopic;

    // Check if the student is responding to a previous question asked by the tutor
    const lastUserMsg = messages[messages.length - 1];
    const lastAssistantMsg = messages.length > 1 ? messages[messages.length - 2] : null;
    const activeQuestion = studentLearningMemory.getActiveQuestion(studentId);
    const isStudentAnswer = !!(
      lastUserMsg?.role === 'user' &&
      lastAssistantMsg?.role === 'assistant' &&
      !!lastAssistantMsg.content &&
      activeQuestion &&
      activeQuestion.question === lastAssistantMsg.content &&
      // A question from another subject/chapter must never be evaluated here.
      // This prevents an old Math/Fish Tale question from being scored while
      // the student is currently on Science, English, etc.
      (!subject?.id || !activeQuestion.subject_id || activeQuestion.subject_id === subject.id) &&
      (!chapter?.id || !activeQuestion.chapter_id || activeQuestion.chapter_id === chapter.id)
    );

    // Perform Hybrid Knowledge Base Retrieval (Class 5 CBSE prioritized).
    // This is intentionally cached server-side; the next major latency source
    // after auth/memory is query embedding + vector search.
    const ragStartedAt = Date.now();
    const ragSearchResult = await knowledgeBase.searchKnowledge({
      query: latestUserMessage,
      class: studentClass,
      board: studentBoard,
      subject_id: subject?.id,
      chapter_id: chapter?.id,
      chapter_number: chapter?.chapter_number,
      topic: currentTopic,
      limit: 5,
      minScore: 0.35,
    });

    console.log(`[TutorTiming] rag=${Date.now() - ragStartedAt}ms cachedOrRetrieved=${ragSearchResult.results.length}`);
    const hasRetrievedKnowledge = ragSearchResult.results.length > 0;
    let retrievedContextPrompt = '';
    if (hasRetrievedKnowledge) {
      retrievedContextPrompt = ragSearchResult.results.map((r, idx) => {
        return `[Source ${r.chunk.id || r.chunk.document_id + ':' + (r.chunk.chunk_index ?? idx)}]
Document: ${r.chunk.document_title}
Type: ${r.chunk.document_type}
Chapter: ${r.chunk.chapter_name || chapterName}
Page: ${r.chunk.page_number || 'N/A'}
Relevant content:
${r.chunk.content}`;
      }).join('\n\n');
    }

    // Core Tutoring Instruction with strict Textbook Grounding & Learning Memory (Prompt Section 14, 15, 16)
    const systemInstruction = `You are Athmik's personal Class 5 CBSE AI Tutor and Adaptive Learning Agent.

When curriculum-specific educational material is provided in the retrieved knowledge context, use that material as the primary source.
Do not invent textbook-specific facts.
Do not claim that information comes from the student's textbook unless the retrieved context supports it.
If the retrieved context does not contain enough information to answer a textbook-specific question, say that the relevant material was not found.
You may explain retrieved material in simpler language for the student.
Do not reproduce large sections of copyrighted textbook content.
Summarize, explain, teach and ask questions based on the retrieved material.

STUDENT LEARNING MEMORY (PERSONAL ADAPTIVE AGENT CONTEXT):
- Student: ${studentName}
- Class: ${studentClass} · Board: ${studentBoard} · School: ${schoolName}
- Subject: ${subjectName}
- Chapter: ${chapterName}
- Current Topic: ${currentTopic}
- Current Mastery Score: ${effectiveMastery}% (State: ${topicMastery.mastery_state.toUpperCase()})
- Adaptive Difficulty Level: Level ${effectiveDifficulty} of 5 (1=Basic, 2=Easy, 3=Medium, 4=Challenging, 5=Advanced)
- Total Questions Attempted: ${topicMastery.questions_attempted} (${topicMastery.correct_answers} correct, ${topicMastery.incorrect_answers} incorrect)
- Consecutive Correct: ${topicMastery.consecutive_correct} (3 in a row triggers level-up)
- Consecutive Incorrect: ${topicMastery.consecutive_incorrect} (2 in a row triggers level-down)
- Known Unresolved Difficulties: ${unresolvedMistakes.length > 0 ? unresolvedMistakes.map(m => `[${m.mistake_type} mistake, seen ${m.frequency}x]: ${m.description}`).join('; ') : 'None'}
- Recent Questions Asked (QUESTION DIVERSITY: DO NOT REPEAT THESE QUESTIONS OR IDENTICAL NUMBERS):
  ${recentQuestions.length > 0 ? recentQuestions.join(' | ') : 'None yet'}

RECOMMENDED PERSONALIZED TEACHING STRATEGY:
${effectiveMastery < 40
  ? '- Foundational Strategy (<40%): Keep explanations under 2 sentences, give a simple real-life analogy (cricket, pizza, sweets, fish market), and ask ONE basic check-in question.'
  : effectiveMastery < 70
  ? '- Developing/Practising Strategy (40-69%): Provide a brief worked example and ask a medium practice problem matching difficulty Level ' + effectiveDifficulty + '.'
  : '- Advanced Application Strategy (>=70%): Challenge Athmik with an application problem testing deeper concept transfer.'}
${unresolvedMistakes.length > 0
  ? `- Active Misconception Remediation: Athmik previously had trouble with "${unresolvedMistakes[0].description}". Address this concept gently using an alternative explanation.`
  : ''}

${hasRetrievedKnowledge ? `
RETRIEVED KNOWLEDGE CONTEXT (USE AS PRIMARY SOURCE):
${retrievedContextPrompt}
` : `
NOTE ON KNOWLEDGE BASE:
No official textbook material has been uploaded or retrieved for this specific chapter yet.
You may explain the topic using foundational Class 5 CBSE knowledge, or let Athmik know that his parent can add the chapter material to the Knowledge Base.
Clearly distinguish between textbook-grounded information and general educational knowledge.
`}

CRITICAL ANSWER-EVALUATION RULES:
1. When the latest student message is an answer to the tutor's previous question, evaluate that answer BEFORE writing encouragement. Compare it directly with the previous question and the chapter/context. Never assume an answer is correct merely because it is plausible or because the student tried hard.
2. If the student's answer is wrong, set evaluation.status to "incorrect" and explain the correction gently. "Good effort" or similar encouragement must never be used as evidence that the answer is correct. If the exact correct answer cannot be established from the available context, use "unclear" rather than guessing.
3. If the student's answer is correct, set evaluation.status to "correct". If only part is correct, use "partially_correct". Do not promote an incorrect answer to correct just to be encouraging.
4. In QUIZ mode, an answer must receive "correct" only when the answer actually satisfies the question. Incorrect answers must be recorded as incorrect so the quiz score and mastery are not inflated.

CRITICAL TEACHING RULES:
1. Short Teaching Cycles: Never a long monologue. Max 2-4 sentences per response. Follow: Explain simply -> Give one real-life example -> Ask a check-in question -> Wait for student answer.
2. Positive Reinforcement: Always encourage ("Good attempt!", "You're very close!", "Let's look at that step again!", "Super thinking!"). Never use negative/shaming words ("Wrong", "Bad answer").
3. Question Diversity (Section 13): Change numbers, scenario, context, and wording so every question feels fresh and engaging.
4. Homework/Hint Policy: ${isHomeworkHelp ? 'Student asks homework help: DO NOT give raw answers. Provide Hint 1 and ask them to try the first step.' : 'If asked direct calculation, guide step-by-step.'}
5. Mode Objectives:
   - LEARN: Interactive concept discovery based on retrieved chapter concepts.
   - ASK: Answer Athmik's question clearly for a 10-year-old, provide an everyday example, and ask a fun check-in question.
   - PRACTICE: Present ONE question at a time grounded in the chapter at Difficulty Level ${effectiveDifficulty}.
   - QUIZ: 5-question CBSE test grounded in the chapter. Question ${quizIndex} of 5.
   - REVISION: Address recorded mistakes gently with friendly review exercises.

OUTPUT FORMAT:
Respond with a JSON object:
{
  "reply": "Your friendly, warm message to Athmik",
  "evaluation": {
    "status": "correct" | "partially_correct" | "incorrect" | "unclear",
    "feedback": "1 encouraging sentence about student's answer (or empty if not answering a question)",
    "scoreDelta": 10 | 5 | 0,
    "conceptUnderstood": "Concept name or null",
    "mistake": { "type": "Mistake title", "description": "1 sentence description" } or null
  },
  "suggestedReplies": ["Quick reply 1", "Quick reply 2"],
  "difficultyAdjustment": -1 | 0 | 1,
  "usedSourceIds": ["exact source ID from context"]
}`;

    // Format only the latest turns for Gemini. Full history was growing after
    // every question and increasing input size/latency. Durable learning memory
    // already carries mastery, mistakes and question fingerprints.
    const recentMessages = messages.slice(-8);
    const conversationPrompt = recentMessages
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? studentName : 'Tutor'}: ${m.content}`)
      .join('\n\n');

    const prompt = conversationPrompt.length > 0
      ? `Conversation History:\n${conversationPrompt}\n\nRespond to ${studentName} now as their friendly Class 5 CBSE tutor in mode: ${mode}.`
      : `Start the ${mode} session with ${studentName} for ${chapterName} in ${subjectName}. Greet him warmly and begin!`;

    let parsedData: any = null;
    let modelUsed = 'gemini-3.1-flash-lite';

    const generationStartedAt = Date.now();
    try {
      const { text, modelUsed: returnedModel } = await callGeminiWithCascade({
        contents: prompt,
        systemInstruction,
        useStructuredOutput: true,
      });
      modelUsed = returnedModel;
      parsedData = parseTutorResponse(text);
      console.log(`[TutorTiming] generation=${Date.now() - generationStartedAt}ms model=${modelUsed}`);
    } catch (aiErr: any) {
      console.warn('[AI Tutor] AI model generation cascade failed or rate limit reached:', aiErr?.message);
      parsedData = generateCurriculumFallbackResponse({
        studentName,
        subjectName,
        chapterName,
        currentTopic,
        mode,
        effectiveDifficulty,
        effectiveMastery,
        isStudentAnswer,
        lastAssistantMsg,
        lastUserMsg,
        unresolvedMistakes,
        hasRetrievedKnowledge,
        ragSearchResult,
        quizIndex,
      });
      modelUsed = 'curriculum-adaptive-engine';
      console.log(`[TutorTiming] generation_failed_then_fallback=${Date.now() - generationStartedAt}ms`);
    }

    // Section 18 & 19: Post-Answer Evaluation with Deterministic Verification
    let attemptResult: any = null;
    let isDeterministic = false;

    if (isStudentAnswer && parsedData.evaluation && lastAssistantMsg) {
      // Deterministic evaluation check for arithmetic/numeric answers
      const isFishTaleMath = (
        subject?.id === 'sub_maths' ||
        subjectName.toLowerCase().includes('math') ||
        (chapter?.chapter_name || '').toLowerCase().includes('fish tale')
      );
      const detEval = isFishTaleMath
        ? studentLearningMemory.evaluateDeterministicAnswer(
            lastAssistantMsg.content,
            lastUserMsg.content
          )
        : { isDeterministic: false };

      if (detEval.isDeterministic && detEval.isCorrect !== undefined) {
        isDeterministic = true;
        if (detEval.isCorrect) {
          parsedData.evaluation.status = 'correct';
          parsedData.evaluation.scoreDelta = 10;
          parsedData.evaluation.feedback = `Super thinking! ${lastUserMsg.content} is exactly right!`;
          parsedData.evaluation.mistake = null;
        } else {
          parsedData.evaluation.status = 'incorrect';
          parsedData.evaluation.scoreDelta = 0;
          parsedData.evaluation.feedback = `Your answer ${lastUserMsg.content} is not correct. The correct answer is ${detEval.expectedValue}. Let's look at that step together!`;
          if (!parsedData.evaluation.mistake) {
            parsedData.evaluation.mistake = {
              type: 'calculation',
              description: `Incorrect arithmetic response for: ${lastAssistantMsg.content.slice(0, 50)}...`,
            };
          }
        }
      }

      // Record student attempt and update multi-signal learning memory & adaptive difficulty
      attemptResult = studentLearningMemory.recordQuestionAttempt({
        student_id: studentId,
        subject_id: subject?.id || 'sub_maths',
        chapter_id: chapter?.id || 'chap_math_1',
        topic: currentTopic,
        question: lastAssistantMsg.content,
        student_answer: lastUserMsg.content,
        expected_answer: detEval.expectedValue,
        status: parsedData.evaluation.status,
        mistake_type: (parsedData.evaluation.mistake?.type as any) || (parsedData.evaluation.status === 'incorrect' ? 'calculation' : undefined),
        mistake_description: parsedData.evaluation.mistake?.description,
      });
      if (supabaseMemorySync.enabled) {
        try {
          const latestMistake = parsedData.evaluation.status === 'incorrect'
            ? studentLearningMemory.getMistakesForStudent(studentId, { chapter_id: chapter?.id, resolved: false })[0]
            : undefined;
          supabaseMemorySync.queueAttempt(studentId, {
            client_attempt_id: activeQuestion?.id || undefined,
            student_id: studentId, subject_id: subject?.id || 'sub_maths', chapter_id: chapter?.id || 'chap_math_1',
            topic: currentTopic, question: lastAssistantMsg.content, student_answer: lastUserMsg.content,
            expected_answer: detEval.expectedValue, status: parsedData.evaluation.status,
            mistake_type: parsedData.evaluation.mistake?.type,
            mistake_description: parsedData.evaluation.mistake?.description,
            concept_understood: parsedData.evaluation.conceptUnderstood,
          }, attemptResult.mastery, latestMistake, attemptResult.profile);
        } catch (syncError) {
          // queueAttempt is intentionally non-blocking; errors are logged by the
          // per-student durable write queue without delaying the tutor reply.
          console.error('[Data] Durable atomic attempt queue failed:', syncError);
        }
      }

      // Section 13: Fingerprint new question if asked in reply
      if (parsedData.reply.includes('?')) {
        studentLearningMemory.recordQuestionFingerprint(
          studentId,
          chapter?.id || 'general',
          parsedData.reply
        );
      }
    }

    // Normalize the visible tutor reply to the verified evaluation.
    // Gemini may return encouraging wording even when evaluation.status is
    // incorrect/partially_correct. In quiz mode the student must see an explicit
    // result, not a misleading encouraging message that sounds like a correct answer.
    if (isStudentAnswer && parsedData.evaluation && parsedData.evaluation.status !== 'unclear') {
      const status = parsedData.evaluation.status;
      const feedback = typeof parsedData.evaluation.feedback === 'string'
        ? parsedData.evaluation.feedback.trim()
        : '';
      if (status === 'incorrect') {
        const correction = feedback || 'Your answer is not correct. Let’s check the correct steps together.';
        const cleanCorrection = correction.replace(/^good attempt[!,.]?\s*/i, '');
        parsedData.reply = `Sorry, ${studentName}. Your answer is not correct. ${cleanCorrection.replace(/^your answer [^.]+\.\s*/i, '')}`;
        parsedData.evaluation.scoreDelta = 0;
      } else if (status === 'partially_correct') {
        const correction = feedback || 'You have part of the idea right. Let’s fix the remaining step together.';
        const cleanCorrection = correction.replace(/^good progress[!,.]?\s*/i, '');
        parsedData.reply = `Good progress, ${studentName}! ${cleanCorrection}`;
        parsedData.evaluation.scoreDelta = Math.min(5, Number(parsedData.evaluation.scoreDelta) || 5);
      } else if (status === 'correct') {
        const confirmation = feedback || 'Your answer is correct!';
        parsedData.reply = `Excellent, ${studentName}! ${confirmation}`;
        parsedData.evaluation.scoreDelta = Math.max(10, Number(parsedData.evaluation.scoreDelta) || 10);
      }
    }
    // Persist exactly one active question per student so ordinary follow-up messages
    // are not accidentally scored as answers.
    let questionId: string | null = null;
    if (parsedData.reply.includes('?')) {
      questionId = studentLearningMemory.setActiveQuestion({
        student_id: studentId,
        subject_id: subject.id,
        chapter_id: chapter?.id,
        topic: currentTopic,
        question: parsedData.reply,
      });
      if (supabaseMemorySync.enabled) {
        supabaseMemorySync.queueActiveQuestion(
          studentId,
          studentLearningMemory.getActiveQuestion(studentId)
        );
      }
    } else if (isStudentAnswer) {
      studentLearningMemory.clearActiveQuestion(studentId, activeQuestion?.id);
      if (supabaseMemorySync.enabled) {
        supabaseMemorySync.queueActiveQuestion(studentId, null);
      }
    }

    console.log(`[TutorTiming] total=${Date.now() - requestStartedAt}ms student=${studentId}`);
    res.json({
      success: true,
      modelUsed,
      data: {
        ...parsedData,
        sources: hasRetrievedKnowledge ? ragSearchResult.sources : [],
        isGrounded: hasRetrievedKnowledge && Array.isArray(parsedData.usedSourceIds) && parsedData.usedSourceIds.length > 0 &&
          parsedData.usedSourceIds.some((id: string) => ragSearchResult.results.some((r: any, idx: number) => String(r.chunk.id || `${r.chunk.document_id}:${r.chunk.chunk_index ?? idx}`) === id)),
        agentDecision: attemptResult ? attemptResult.decision : {
          teaching_action: effectiveMastery < 40 ? 'explain' : 'practice',
          topic: currentTopic,
          difficulty: effectiveDifficulty,
          reason: 'Personalized adaptive flow',
          requires_answer: true,
          update_memory: true,
        },
        updatedMastery: attemptResult ? attemptResult.mastery.mastery_score : effectiveMastery,
        updatedDifficulty: attemptResult ? attemptResult.mastery.difficulty_level : effectiveDifficulty,
        masteryStateLabel: attemptResult ? attemptResult.mastery.mastery_state : topicMastery.mastery_state,
        isDeterministicEval: isDeterministic,
        questionId,
      },
    });
  } catch (error: any) {
    console.error('Tutor chat API fatal error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'AI_REQUEST_FAILED',
      error: "We couldn't connect to your tutor right now. Please check your connection and try again.",
      details: error?.message || 'Server error',
    });
  }
});

// Socratic Hint Endpoint
app.post('/api/tutor/hint', async (req, res) => {
  try {
    const { question, studentAnswer, subjectName, chapterName } = req.body;

    const hintPrompt = `The student is working on this Class 5 CBSE question: "${question}".
Their attempt or question was: "${studentAnswer || 'I am stuck'}".
Chapter: ${chapterName || 'General'}, Subject: ${subjectName || 'Math'}.
Provide a gentle, step-by-step Socratic HINT (Hint 1). DO NOT give the final answer. Keep it under 2 sentences with an encouraging tone.`;

    let hintText = '';
    try {
      const { text } = await callGeminiWithCascade({
        contents: hintPrompt,
        systemInstruction: 'You are a warm, encouraging Class 5 CBSE tutor. Give a hint that guides the student to solve the problem themselves without giving away the final number or answer.',
        useStructuredOutput: false,
      });
      hintText = text.trim();
    } catch {
      hintText = "Let's break it down: look at the rate per hour or price per kg given in the problem, and think about what operation connects them!";
    }

    res.json({
      success: true,
      hint: hintText || "Let's think about the first step together. What are the key numbers given in the problem?",
    });
  } catch (error: any) {
    console.error('Hint API error:', error);
    res.json({
      success: true,
      hint: "Let's look at the problem one small step at a time! What part seems tricky?",
    });
  }
});

// ==============================================================================
// MODULE 3: KNOWLEDGE BASE & RAG ENDPOINTS
// ==============================================================================

// 1. Get all knowledge documents with optional filtering
app.get('/api/knowledge/documents', async (req, res) => {
  try {
    const { subject_id, chapter_id } = req.query;
    const docs = await knowledgeBase.getDocuments({
      subject_id: subject_id ? String(subject_id) : undefined,
      chapter_id: chapter_id ? String(chapter_id) : undefined,
    });
    res.json({ success: true, data: docs });
  } catch (error: any) {
    console.error('Error fetching knowledge documents:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch documents' });
  }
});

// 2. Get specific document chunks
app.get('/api/knowledge/documents/:id/chunks', async (req, res) => {
  try {
    const { id } = req.params;
    const chunks = await knowledgeBase.getChunksForDocument(id);
    res.json({ success: true, data: chunks });
  } catch (error: any) {
    console.error('Error fetching document chunks:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch chunks' });
  }
});

// 3. Delete knowledge document and cascade remove chunks
app.delete('/api/knowledge/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await knowledgeBase.deleteDocument(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, message: 'Document and all chunks deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to delete document' });
  }
});

// 4. Test Knowledge Search Interface (Parent / Dev verification)
app.post('/api/knowledge/search', async (req, res) => {
  try {
    const {
      query,
      class: studentClass = '5',
      board = 'CBSE',
      subject_id,
      chapter_id,
      chapter_number,
      topic,
      minScore,
      limit = 5,
    } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query parameter is required' });
    }

    const searchResult = await knowledgeBase.searchKnowledge({
      query: query.trim(),
      class: studentClass,
      board,
      subject_id,
      chapter_id,
      chapter_number: chapter_number ? Number(chapter_number) : undefined,
      topic,
      minScore: minScore ? Number(minScore) : 0.35,
      limit: Number(limit),
    });

    res.json({
      success: true,
      query: query.trim(),
      results: searchResult.results,
      sources: searchResult.sources,
      queryEmbeddingGenerated: searchResult.queryEmbeddingGenerated,
      totalAvailableChunks: searchResult.totalAvailableChunks,
    });
  } catch (error: any) {
    console.error('Knowledge search error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Search execution failed' });
  }
});

// 5. Upload and Process Educational Document (PDF, Notes, Text)
app.post('/api/knowledge/upload', async (req, res) => {
  try {
    const {
      title,
      doc_type = 'textbook',
      document_type,
      subject_id,
      subject_name,
      chapter_id,
      chapter_name,
      chapter_number,
      topic,
      class: docClass = '5',
      board = 'CBSE',
      academic_year = '2026-27',
      file_name = 'document.txt',
      file_type = 'text/plain',
      file_size = 0,
      file_data_base64,
      raw_text,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Document title is required' });
    }
    if (!subject_id) {
      return res.status(400).json({ success: false, error: 'Subject selection is required' });
    }

    const resolvedType = document_type || doc_type || 'textbook';
    const extractedPages: { pageNumber: number; text: string }[] = [];

    // PDF Extraction with page awareness and scanned detection
    if (file_data_base64 && (file_type === 'application/pdf' || file_name.toLowerCase().endsWith('.pdf'))) {
      try {
        const pdfBuffer = Buffer.from(file_data_base64, 'base64');
        const parser = new (PDFParse as any)({ data: pdfBuffer });
        await parser.load();
        const info = await parser.getInfo();
        const totalPages = typeof info?.pages === 'number' ? info.pages : 1;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const pageContent = await parser.getPageText(pageNum);
          extractedPages.push({
            pageNumber: pageNum,
            text: (pageContent || '').trim(),
          });
        }
      } catch (pdfErr: any) {
        console.warn('[KnowledgeBase] PDF Parsing error:', pdfErr?.message);
        const failedDoc = await knowledgeBase.processAndStoreDocument(
          {
            title: title.trim(),
            doc_type: resolvedType,
            document_type: resolvedType,
            subject_id,
            subject_name: subject_name || 'Mathematics',
            chapter_id,
            chapter_name,
            chapter_number: chapter_number ? Number(chapter_number) : undefined,
            topic,
            class: docClass,
            board,
            academic_year,
            file_name,
            file_type,
            file_size: file_size || 0,
            uploaded_by: 'Parent',
            embedding_status: 'failed',
            processing_status: 'failed',
            version: 1,
            active: true,
          },
          [] // Empty triggers failure with useful reason
        );
        return res.json({ success: true, data: failedDoc });
      }
    } else if (raw_text && raw_text.trim()) {
      // Direct text or markdown input
      const pages = raw_text.split(/\f|\[Page\s+\d+\]/i);
      if (pages.length > 1) {
        pages.forEach((pText: string, idx: number) => {
          extractedPages.push({ pageNumber: idx + 1, text: pText.trim() });
        });
      } else {
        extractedPages.push({ pageNumber: 1, text: raw_text.trim() });
      }
    } else if (file_data_base64) {
      // Base64 encoded plain text / markdown
      const textBuffer = Buffer.from(file_data_base64, 'base64');
      const textContent = textBuffer.toString('utf-8');
      extractedPages.push({ pageNumber: 1, text: textContent.trim() });
    }

    // Process and chunk
    const storedDoc = await knowledgeBase.processAndStoreDocument(
      {
        title: title.trim(),
        doc_type: resolvedType,
        document_type: resolvedType,
        subject_id,
        subject_name: subject_name || 'Mathematics',
        chapter_id,
        chapter_name,
        chapter_number: chapter_number ? Number(chapter_number) : undefined,
        topic,
        class: docClass,
        board,
        academic_year,
        file_name,
        file_type,
        file_size: file_size || 0,
        uploaded_by: 'Parent',
        embedding_status: 'pending',
        processing_status: 'pending',
        version: 1,
        active: true,
      },
      extractedPages
    );

    res.json({ success: true, data: storedDoc });
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Document upload failed' });
  }
});

// ==============================================================================
// MODULE 4: STUDENT LEARNING MEMORY & ADAPTIVE AGENT REST ENDPOINTS
// ==============================================================================

// Reject malformed student identifiers before they reach persistence.
app.use('/api/student/:id', (req, res, next) => {
  if (!isSafeId(req.params.id)) {
    return res.status(400).json({ success: false, errorCode: 'INVALID_STUDENT_ID', error: 'Invalid student id.' });
  }
  next();
});

// 1. Get Student Learning Profile
app.get('/api/student/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const profile = studentLearningMemory.getProfile(id);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch profile' });
  }
});

// 2. Get Topic Masteries for Student
app.get('/api/student/:id/mastery', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const masteries = studentLearningMemory.getAllMasteriesForStudent(id);
    res.json({ success: true, data: masteries });
  } catch (error: any) {
    console.error('Error fetching student masteries:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch masteries' });
  }
});

// 3. Get Student Mistakes
app.get('/api/student/:id/mistakes', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const { chapter_id, resolved } = req.query;
    const mistakes = studentLearningMemory.getMistakesForStudent(id, {
      chapter_id: chapter_id ? String(chapter_id) : undefined,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
    });
    res.json({ success: true, data: mistakes });
  } catch (error: any) {
    console.error('Error fetching student mistakes:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch mistakes' });
  }
});

// 4. Record Question Attempt (from manual quiz / interactive practice)
app.post('/api/student/:id/attempt', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject_id,
      chapter_id,
      topic,
      question,
      student_answer,
      expected_answer,
      status,
      mistake_type,
      mistake_description,
      mistake_explanation,
    } = req.body;

    if (!isSafeId(subject_id) || !isSafeId(chapter_id) || !isSafeText(topic, 300)) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_ATTEMPT_CONTEXT', error: 'Valid subject, chapter and topic are required.' });
    }
    if (!['correct', 'partially_correct', 'incorrect', 'unclear'].includes(status)) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_ATTEMPT_STATUS', error: 'Invalid attempt status.' });
    }
    if (question !== undefined && !isSafeText(question, 4000)) return res.status(400).json({ success: false, error: 'Invalid question.' });
    if (student_answer !== undefined && !isSafeText(student_answer, 2000)) return res.status(400).json({ success: false, error: 'Invalid student answer.' });

    if (durableMemoryRequired && !isSafeText(req.body.client_attempt_id, 200)) {
      return res.status(400).json({ success: false, errorCode: 'CLIENT_ATTEMPT_ID_REQUIRED', error: 'A stable client_attempt_id is required for durable learning attempts.' });
    }
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const result = studentLearningMemory.recordQuestionAttempt({
      student_id: id,
      subject_id,
      chapter_id,
      topic,
      question,
      student_answer,
      expected_answer,
      status,
      mistake_type,
      mistake_description,
      mistake_explanation,
    });

    if (supabaseMemorySync.enabled) {
      try {
        const latestMistake = status === 'incorrect' ? studentLearningMemory.getMistakesForStudent(id, { chapter_id, resolved: false })[0] : undefined;
        await supabaseMemorySync.syncAttempt(id, { ...req.body, client_attempt_id: req.body.client_attempt_id || `manual_${id}_${Date.now()}_${Math.random().toString(36).slice(2,8)}` }, result.mastery, latestMistake, result.profile);
      } catch (syncError) {
        console.error('[Data] Durable attempt sync failed:', syncError);
        if (durableMemoryRequired) return res.status(503).json({ success: false, errorCode: 'DURABLE_WRITE_FAILED', error: 'Learning data could not be durably saved. Please retry.' });
      }
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error recording student attempt:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to record attempt' });
  }
});

// 5. Record Completed Learning Session
app.post('/api/student/:id/session', async (req, res) => {
  try {
    const { id } = req.params;
    const sessionData = req.body;
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const session = studentLearningMemory.recordSession({
      ...sessionData,
      student_id: id,
    });
    if (supabaseMemorySync.enabled) {
      try { await supabaseMemorySync.syncSession(session); }
      catch (syncError) {
        console.error('[Data] Durable session sync failed:', syncError);
        if (durableMemoryRequired) return res.status(503).json({ success: false, errorCode: 'DURABLE_WRITE_FAILED', error: 'Learning session could not be durably saved. Please retry.' });
      }
    }
    res.json({ success: true, data: session });
  } catch (error: any) {
    console.error('Error recording learning session:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to record session' });
  }
});

// 6. Generate "Today's Learning Plan" (Section 30)
app.get('/api/student/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const plan = studentLearningMemory.generateDailyLearningPlan(id);
    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error generating daily plan:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to generate plan' });
  }
});

// 7. Get Comprehensive Parent Topic Report (Section 24, 25, 26)
app.get('/api/student/:id/parent-report', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseMemorySync.hydrateStudent(id);
    if (durableMemoryRequired && !supabaseMemorySync.enabled) return res.status(503).json({ success: false, errorCode: 'DURABLE_MEMORY_NOT_CONFIGURED', error: 'Durable learning storage is not configured.' });
    const report = studentLearningMemory.getParentLearningReport(id);
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('Error fetching parent report:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to generate parent report' });
  }
});

// 8. Update Parent Controls & Study Preferences (Section 31)
app.put('/api/student/:id/parent-settings', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isSafeId(id)) return res.status(400).json({ success: false, error: 'Invalid student id.' });
    const { daily_study_goal_minutes, preferred_difficulty, priority_subjects } = req.body;
    if (daily_study_goal_minutes !== undefined && (!Number.isFinite(Number(daily_study_goal_minutes)) || Number(daily_study_goal_minutes) < 5 || Number(daily_study_goal_minutes) > 120)) {
      return res.status(400).json({ success: false, error: 'Invalid daily study goal.' });
    }
    if (preferred_difficulty !== undefined && (!Number.isInteger(Number(preferred_difficulty)) || Number(preferred_difficulty) < 1 || Number(preferred_difficulty) > 5)) {
      return res.status(400).json({ success: false, error: 'Invalid preferred difficulty.' });
    }
    if (priority_subjects !== undefined && (!Array.isArray(priority_subjects) || priority_subjects.length > 20 || priority_subjects.some((v: unknown) => !isSafeId(v)))) {
      return res.status(400).json({ success: false, error: 'Invalid priority subjects.' });
    }
    const updatedProfile = studentLearningMemory.updateProfileSettings(id, {
      daily_study_goal_minutes,
      preferred_difficulty,
      priority_subjects,
    });
    if (supabaseMemorySync.enabled) {
      try {
        await supabaseMemorySync.syncProfile(id, updatedProfile);
      } catch (syncError) {
        console.error('[Data] Durable profile sync failed:', syncError);
        if (durableMemoryRequired) return res.status(503).json({ success: false, errorCode: 'DURABLE_WRITE_FAILED', error: 'Settings could not be durably saved. Please retry.' });
      }
    }
    res.json({ success: true, data: updatedProfile });
  } catch (error: any) {
    console.error('Error updating parent settings:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to update settings' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), durableMemory: supabaseMemorySync.enabled, durableMemoryRequired });
});

// Vite Middleware integration for development
async function startServer() {
  // Initialize Knowledge Base with authentic CBSE materials
  try {
    await knowledgeBase.initialize();
  } catch (kbErr) {
    console.error('Failed to initialize Knowledge Base:', kbErr);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`AthmiK AI Tutor server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
