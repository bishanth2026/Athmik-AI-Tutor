import { apiFetch } from '../clientApi';
import {
  Student,
  Subject,
  Chapter,
  TutorMode,
  TutorChatMessage,
  AnswerEvaluation,
  GroundedSourceAttribution,
  AgentDecision,
} from '../types';

export interface SendMessageParams {
  student: Student;
  subject: Subject;
  chapter?: Chapter;
  topic?: string;
  mode: TutorMode;
  messages: { role: 'user' | 'assistant'; content: string }[];
  difficultyLevel: number;
  previousMistakes: string[];
  quizIndex?: number;
  isHomeworkHelp?: boolean;
  currentMastery?: number;
}

export type TutorErrorCode =
  | 'AI_REQUEST_FAILED'
  | 'AI_RESPONSE_EMPTY'
  | 'AI_RESPONSE_PARSE_FAILED'
  | 'INVALID_CONTEXT'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface TutorResponseData {
  reply: string;
  evaluation?: AnswerEvaluation;
  suggestedReplies?: string[];
  difficultyAdjustment?: number;
  sources?: GroundedSourceAttribution[];
  isGrounded?: boolean;
  agentDecision?: AgentDecision;
  updatedMastery?: number;
  updatedDifficulty?: number;
  masteryStateLabel?: string;
  isDeterministicEval?: boolean;
}

export const aiTutorService = {
  /**
   * Send a message to the AI Tutor backend
   */
  async sendMessage(params: SendMessageParams): Promise<{
    success: boolean;
    data?: TutorResponseData;
    error?: string;
    errorCode?: TutorErrorCode;
  }> {
    try {
      const response = await apiFetch('/api/tutor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const code: TutorErrorCode = errorData.errorCode || 'AI_REQUEST_FAILED';
        console.warn(`[aiTutorService] Server error: code=${code}, message=${errorData.details || errorData.error}`);
        return {
          success: false,
          errorCode: code,
          error: "We couldn't connect to your tutor right now. Please check your connection and try again.",
        };
      }

      const resJson = await response.json();
      if (!resJson.success || !resJson.data) {
        const code: TutorErrorCode = resJson.errorCode || 'AI_RESPONSE_PARSE_FAILED';
        console.warn(`[aiTutorService] Invalid response payload: code=${code}`);
        return {
          success: false,
          errorCode: code,
          error: "We couldn't connect to your tutor right now. Please check your connection and try again.",
        };
      }

      const data: TutorResponseData = resJson.data;

      return {
        success: true,
        data,
      };
    } catch (err: any) {
      console.error('[aiTutorService] Connection failed:', err?.message || err);
      return {
        success: false,
        errorCode: 'AI_REQUEST_FAILED',
        error: "We couldn't connect to your tutor right now. Please check your connection and try again.",
      };
    }
  },

  /**
   * Request a Socratic Hint
   */
  async getHint(question: string, studentAnswer: string, subjectName: string, chapterName: string): Promise<string> {
    try {
      const response = await apiFetch('/api/tutor/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, studentAnswer, subjectName, chapterName }),
      });
      const data = await response.json();
      return data.hint || "Let's break the problem into smaller parts! What is the first thing we know?";
    } catch {
      return "Let's review the first step together. Can you identify the numbers given?";
    }
  },

  /**
   * Speak text using Web Speech Synthesis API
   */
  speak(text: string, onEnd?: () => void): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Stop any previous speech

    // Clean markdown characters like asterisks before speaking
    const cleanText = text.replace(/[*_#`~]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95; // Slightly slower for age 10 comprehension
    utterance.pitch = 1.05; // Friendly warm pitch

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  },

  /**
   * Stop speech
   */
  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },
};
