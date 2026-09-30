import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { aiTutorService } from '../../services/aiTutorService';
import { learningMemoryService } from '../../services/learningMemoryService';
import {
  TutorMode,
  TutorChatMessage,
  Subject,
  Chapter,
  ChapterLearningMemory,
} from '../../types';
import { SubjectIcon } from '../../components/common/SubjectIcon';
import { Button } from '../../components/common/Button';
import { ProgressBar } from '../../components/common/ProgressBar';
import {
  Sparkles,
  Send,
  Volume2,
  VolumeX,
  Lightbulb,
  Award,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  HelpCircle,
  FileQuestion,
  ChevronDown,
  Brain,
  Layers,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface AITutorAgentViewProps {
  initialSubjectId?: string;
  initialChapterId?: string;
  onNavigate?: (path: string) => void;
}

export const AITutorAgentView: React.FC<AITutorAgentViewProps> = ({
  initialSubjectId,
  initialChapterId,
  onNavigate,
}) => {
  const { student, activeSubjects, chapters, refreshData } = useApp();

  // Subject and Chapter selection
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && activeSubjects.some((s) => s.id === initialSubjectId)) {
      return initialSubjectId;
    }
    return activeSubjects.length > 0 ? activeSubjects[0].id : '';
  });

  const selectedSubject = activeSubjects.find((s) => s.id === selectedSubjectId) || activeSubjects[0];
  const subjectChapters = chapters.filter((c) => c.subject_id === selectedSubject?.id && c.active);

  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (initialChapterId && subjectChapters.some((c) => c.id === initialChapterId)) {
      return initialChapterId;
    }
    return subjectChapters.length > 0 ? subjectChapters[0].id : '';
  });

  const selectedChapter = subjectChapters.find((c) => c.id === selectedChapterId) || subjectChapters[0];

  // Synchronized context selectors
  const handleSelectSubject = (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
    const newSubjectChapters = chapters.filter((c) => c.subject_id === newSubjectId && c.active);
    if (newSubjectChapters.length > 0) {
      setSelectedChapterId(newSubjectChapters[0].id);
    }
  };

  const handleSelectChapter = (newChapterId: string) => {
    setSelectedChapterId(newChapterId);
  };

  // Tutor state
  const [mode, setMode] = useState<TutorMode>('learn');
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizIndex, setQuizIndex] = useState(1);
  const [quizScore, setQuizScore] = useState(0);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [lastAttemptedText, setLastAttemptedText] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(() => Date.now());
  const [sessionQuestionsAttempted, setSessionQuestionsAttempted] = useState(0);
  const [sessionCorrectAnswers, setSessionCorrectAnswers] = useState(0);

  // Learning Memory for the active chapter
  const [memory, setMemory] = useState<ChapterLearningMemory>(() => {
    if (selectedSubject && selectedChapter) {
      return learningMemoryService.getChapterMemory(
        student.id,
        selectedSubject.id,
        selectedChapter.id,
        selectedChapter.chapter_name
      );
    }
    return {
      student_id: student.id,
      subject_id: '',
      chapter_id: '',
      topic: '',
      questions_attempted: 0,
      correct_answers: 0,
      incorrect_answers: 0,
      mastery_score: 0,
      difficulty_level: 2,
      last_interaction: new Date().toISOString(),
      common_mistakes: [],
      mastered_concepts: [],
      needs_practice: [],
    };
  });

  // Record session on component unmount if questions were attempted
  useEffect(() => {
    return () => {
      const durationSeconds = Math.max(15, Math.round((Date.now() - sessionStartTime) / 1000));
      if (selectedSubject && selectedChapter && sessionQuestionsAttempted > 0) {
        learningMemoryService.recordCompletedSession({
          student_id: student.id,
          subject_id: selectedSubject.id,
          subject_name: selectedSubject.name,
          chapter_id: selectedChapter.id,
          chapter_name: selectedChapter.chapter_name,
          topic: selectedChapter.chapter_name,
          mode,
          started_at: new Date(sessionStartTime).toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          questions_attempted: sessionQuestionsAttempted,
          correct_answers: sessionCorrectAnswers,
          incorrect_answers: Math.max(0, sessionQuestionsAttempted - sessionCorrectAnswers),
          starting_mastery: memory.mastery_score,
          ending_mastery: memory.mastery_score,
          starting_difficulty: memory.difficulty_level,
          ending_difficulty: memory.difficulty_level,
        });
      }
    };
  }, [sessionStartTime, sessionQuestionsAttempted, sessionCorrectAnswers, selectedSubject, selectedChapter, mode, memory, student.id]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update chapter selection if subject changes
  useEffect(() => {
    if (subjectChapters.length > 0 && !subjectChapters.some((c) => c.id === selectedChapterId)) {
      setSelectedChapterId(subjectChapters[0].id);
    }
  }, [selectedSubjectId, subjectChapters, selectedChapterId]);

  // Sync memory when student, subject, or chapter changes
  useEffect(() => {
    if (selectedSubject && selectedChapter) {
      const mem = learningMemoryService.getChapterMemory(
        student.id,
        selectedSubject.id,
        selectedChapter.id,
        selectedChapter.chapter_name
      );
      setMemory(mem);
    }
  }, [student.id, selectedSubject, selectedChapter]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initial Welcome / Kick-off message when chapter or mode changes
  useEffect(() => {
    if (!selectedSubject || !selectedChapter) return;

    let initialPromptText = '';
    const chapterTitle = `Chapter ${selectedChapter.chapter_number}: ${selectedChapter.chapter_name}`;

    switch (mode) {
      case 'learn':
        initialPromptText = `Hi ${student.name}! Let's learn **${chapterTitle}** step by step. Have you studied this in school yet, or are we discovering it together for the first time?`;
        break;
      case 'ask':
        initialPromptText = `I'm here to answer any question you have about **${selectedSubject.name}** and **${selectedChapter.chapter_name}**! What would you like to know?`;
        break;
      case 'practice':
        initialPromptText = `Awesome! Let's do some fun practice on **${selectedChapter.chapter_name}** (Difficulty Level: ${memory.difficulty_level}/5). Are you ready for your first question?`;
        break;
      case 'quiz':
        setQuizStarted(false);
        setQuizIndex(1);
        setQuizScore(0);
        initialPromptText = `Welcome to the 5-Question CBSE Challenge for **${selectedChapter.chapter_name}**! Let's see how much you know. Ready for Question 1?`;
        break;
      case 'revision':
        if (memory.common_mistakes.length > 0) {
          const mistake = memory.common_mistakes[0];
          initialPromptText = `Welcome to Revision! Earlier, we noticed that **${mistake.mistake_type}** was a bit tricky. Let's do a quick, friendly review together so it becomes crystal clear!`;
        } else {
          initialPromptText = `Welcome to Revision! We'll review the key formulas and concepts of **${selectedChapter.chapter_name}** step by step.`;
        }
        break;
    }

    const firstMessage: TutorChatMessage = {
      id: `msg_init_${Date.now()}`,
      role: 'assistant',
      content: initialPromptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
      suggestedReplies:
        mode === 'learn'
          ? ['We are discovering it together!', 'I learned a little bit in class', "Let's start!"]
          : mode === 'practice' || mode === 'quiz'
          ? ["Yes, I'm ready!", 'Give me a warm-up first']
          : mode === 'ask'
          ? ['What are the main concepts?', 'Can you give an everyday example?']
          : ["Let's review!"],
    };

    setMessages([firstMessage]);

    if (audioEnabled) {
      aiTutorService.speak(initialPromptText);
    }
  }, [mode, selectedSubjectId, selectedChapterId]);

  const handleSendMessage = async (textToSend?: string, isRetry: boolean = false) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading || !selectedSubject || !selectedChapter) return;

    if (!isRetry) {
      setInputValue('');
    }
    setLastAttemptedText(text);

    let updatedMessages = messages;
    if (!isRetry) {
      const userMessage: TutorChatMessage = {
        id: `msg_user_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode,
      };
      updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
    }

    // Start quiz tracking if in quiz mode
    if (mode === 'quiz' && !quizStarted) {
      setQuizStarted(true);
    }

    setIsLoading(true);

    const historyForAI = updatedMessages
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const result = await aiTutorService.sendMessage({
      student,
      subject: selectedSubject,
      chapter: selectedChapter,
      topic: selectedChapter.chapter_name,
      mode,
      messages: historyForAI,
      difficultyLevel: memory.difficulty_level,
      previousMistakes: memory.common_mistakes.map((m) => `${m.mistake_type}: ${m.description}`),
      quizIndex,
      isHomeworkHelp: text.toLowerCase().includes('homework') || text.toLowerCase().includes('solve this for me'),
      currentMastery: memory.mastery_score,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      setLastAttemptedText(null);
      const { reply, evaluation, suggestedReplies } = result.data;

      // Handle quiz progression
      if (mode === 'quiz' && evaluation && evaluation.status !== 'unclear') {
        if (evaluation.status === 'correct') {
          setQuizScore((prev) => prev + 1);
        }
        setQuizIndex((prev) => Math.min(5, prev + 1));
      }

      const botMessage: TutorChatMessage = {
        id: `msg_bot_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode,
        evaluation: evaluation && evaluation.status !== 'unclear' ? evaluation : undefined,
        suggestedReplies,
        sources: result.data.sources,
        isGrounded: result.data.isGrounded,
      };

      setMessages((prev) => [...prev.filter((m) => !m.isError), botMessage]);

      // Update session metrics
      if (evaluation && evaluation.status !== 'unclear') {
        setSessionQuestionsAttempted((prev) => prev + 1);
        if (evaluation.status === 'correct') {
          setSessionCorrectAnswers((prev) => prev + 1);
        }
      }

      // Refresh local memory and app-wide progress
      const updatedMem = learningMemoryService.getChapterMemory(
        student.id,
        selectedSubject.id,
        selectedChapter.id,
        selectedChapter.chapter_name
      );
      if (result.data.updatedMastery !== undefined) {
        updatedMem.mastery_score = result.data.updatedMastery;
      }
      if (result.data.updatedDifficulty !== undefined) {
        updatedMem.difficulty_level = result.data.updatedDifficulty;
      }
      setMemory({ ...updatedMem });
      refreshData();

      if (audioEnabled) {
        setIsSpeaking(true);
        aiTutorService.speak(reply, () => setIsSpeaking(false));
      }
    } else {
      const errorMessage: TutorChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: result.error || "We couldn't connect to your tutor right now. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode,
        isError: true,
        failedPrompt: text,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleRequestHint = async () => {
    if (isLoading || !selectedSubject || !selectedChapter) return;
    setIsLoading(true);

    const lastBotMessage = [...messages].reverse().find((m) => m.role === 'assistant');
    const question = lastBotMessage?.content || selectedChapter.chapter_name;

    const hint = await aiTutorService.getHint(
      question,
      inputValue,
      selectedSubject.name,
      selectedChapter.chapter_name
    );

    setIsLoading(false);

    const hintMessage: TutorChatMessage = {
      id: `msg_hint_${Date.now()}`,
      role: 'assistant',
      content: `💡 **Socratic Hint:** ${hint}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
      suggestedReplies: ['Got it, let me try!', 'Could you give another hint?'],
    };

    setMessages((prev) => [...prev, hintMessage]);

    if (audioEnabled) {
      aiTutorService.speak(`Hint: ${hint}`);
    }
  };

  const toggleAudio = () => {
    if (audioEnabled) {
      aiTutorService.stopSpeaking();
      setIsSpeaking(false);
      setAudioEnabled(false);
    } else {
      setAudioEnabled(true);
      const lastBotMessage = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastBotMessage) {
        setIsSpeaking(true);
        aiTutorService.speak(lastBotMessage.content, () => setIsSpeaking(false));
      }
    }
  };

  const getDifficultyLabel = (level: number) => {
    switch (level) {
      case 1:
        return 'Level 1: Basic';
      case 2:
        return 'Level 2: Easy';
      case 3:
        return 'Level 3: Medium';
      case 4:
        return 'Level 4: Challenging';
      case 5:
        return 'Level 5: Advanced Class 5';
      default:
        return `Level ${level}`;
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Session Configuration Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Subject & Chapter Context Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-semibold">Subject:</span>
              <select
                value={selectedSubject?.id || ''}
                onChange={(e) => handleSelectSubject(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {activeSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs max-w-xs">
              <span className="text-slate-400 font-semibold">Chapter:</span>
              <select
                value={selectedChapter?.id || ''}
                onChange={(e) => handleSelectChapter(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer truncate"
              >
                {subjectChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    Ch {c.chapter_number}: {c.chapter_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Metrics & Voice Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Adaptive Difficulty Indicator */}
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono tabular-nums"
              title="Difficulty adapts automatically as Athmik answers questions"
            >
              {getDifficultyLabel(memory.difficulty_level)}
            </span>

            {/* Mastery Pill */}
            <button
              onClick={() => setShowMemoryPanel(!showMemoryPanel)}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              title="Click to view learning memory and common mistakes"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>{memory.mastery_score}% Mastery</span>
            </button>

            {/* Audio Speech Toggle */}
            <button
              onClick={toggleAudio}
              className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                audioEnabled
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title={audioEnabled ? 'Voice Read-Aloud is ON. Click to mute.' : 'Turn on Voice Read-Aloud'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 5 Tutor Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
          {[
            { id: 'learn', label: 'Learn', icon: BookOpen, desc: 'Step-by-step Socratic teaching' },
            { id: 'ask', label: 'Ask', icon: HelpCircle, desc: 'Ask any Class 5 question' },
            { id: 'practice', label: 'Practice', icon: FileQuestion, desc: 'Interactive 1-by-1 questions' },
            { id: 'quiz', label: mode === 'quiz' && quizStarted ? `Quiz (Q${quizIndex}/5)` : 'Quiz', icon: Award, desc: '5-question test' },
            { id: 'revision', label: 'Revision', icon: RotateCcw, desc: 'Review mistakes & formulas' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as TutorMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Learning Memory Drawer / Dropdown Panel */}
      {showMemoryPanel && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-sm text-xs space-y-3 shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Brain className="w-4 h-4 text-indigo-600" />
              <span>Athmik&apos;s Chapter Memory & Adaptive Analytics</span>
            </div>
            <button
              onClick={() => setShowMemoryPanel(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Attempted</span>
              <span className="text-sm font-bold font-mono tabular-nums">{memory.questions_attempted} questions</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Correct Answers</span>
              <span className="text-sm font-bold text-emerald-700 font-mono tabular-nums">{memory.correct_answers}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Current Difficulty</span>
              <span className="text-sm font-bold text-indigo-700 font-mono tabular-nums">{getDifficultyLabel(memory.difficulty_level)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Calculated Mastery</span>
              <span className="text-sm font-bold text-emerald-700 font-mono tabular-nums">{memory.mastery_score}%</span>
            </div>
          </div>

          {/* Mastered concepts & Common mistakes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="font-semibold text-slate-700 block mb-1 text-[11px]">Concepts Understood:</span>
              {memory.mastered_concepts.length === 0 ? (
                <span className="text-slate-400 text-[11px]">Discovering concepts in progress...</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {memory.mastered_concepts.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                      ✓ {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1 text-[11px]">Things We&apos;re Practicing:</span>
              {memory.common_mistakes.length === 0 ? (
                <span className="text-slate-400 text-[11px]">No recurring mistakes recorded!</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {memory.common_mistakes.map((m) => (
                    <span key={m.id} className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
                      • {m.mistake_type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 shadow-xs">
        {messages.map((msg) => {
          const isTutor = msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isTutor ? 'justify-start' : 'justify-end'}`}
            >
              {isTutor && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.isError
                      ? 'bg-rose-50 border border-rose-200 text-rose-900'
                      : isTutor
                      ? 'bg-slate-50 border border-slate-200 text-slate-800'
                      : 'bg-indigo-600 text-white rounded-tr-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Retry Action for Error Messages */}
                  {msg.isError && (
                    <div className="mt-3 pt-3 border-t border-rose-200/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const promptToRetry = msg.failedPrompt || lastAttemptedText;
                          if (promptToRetry) {
                            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                            handleSendMessage(promptToRetry, true);
                          }
                        }}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Message</span>
                      </button>
                    </div>
                  )}

                  {/* Encouraging Answer Evaluation Badge */}
                  {msg.evaluation && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80 text-xs">
                      {msg.evaluation.status === 'correct' ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{msg.evaluation.feedback || 'Excellent thinking! That is correct!'}</span>
                        </div>
                      ) : msg.evaluation.status === 'partially_correct' ? (
                        <div className="flex items-center gap-1.5 text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{msg.evaluation.feedback || 'Good attempt! You got part of it right.'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-indigo-900 font-semibold bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                          <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{msg.evaluation.feedback || "Let's look at that step again together!"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RAG Grounded Source Attribution (Prompt Rule 18) */}
                  {isTutor && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-indigo-700 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Sources used:</span>
                        </span>
                        {msg.sources.map((src, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-950 border border-indigo-200/60 font-medium"
                            title={`Document: ${src.documentTitle} · Chapter: ${src.chapter || ''}`}
                          >
                            <span className="truncate max-w-[200px]">
                              {src.documentTitle.replace(/NCERT Mathematics: Math-Magic \(Class 5\) - /i, '')}
                            </span>
                            {src.pageNumber && (
                              <span className="text-indigo-600 font-bold">· Page {src.pageNumber}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Reply Suggestions */}
                {isTutor && msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestedReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(reply)}
                        disabled={isLoading}
                        className="text-xs bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[10px] text-slate-400 px-1 ${
                    isTutor ? 'text-left' : 'text-right'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {!isTutor && (
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {student.name.charAt(0)}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading / Thinking Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <span>Athmik&apos;s Tutor is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input & Action Dock */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs shrink-0 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Hint button */}
          <button
            type="button"
            onClick={handleRequestHint}
            disabled={isLoading}
            className="min-h-[44px] px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Ask for a step-by-step Socratic hint without spoiling the answer"
          >
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Hint</span>
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              mode === 'learn'
                ? `Answer the question or say what you know about ${selectedChapter?.chapter_name}...`
                : mode === 'ask'
                ? 'Ask any question about this chapter...'
                : mode === 'quiz'
                ? 'Type your answer for the quiz question...'
                : 'Type your answer or question...'
            }
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="min-h-[44px] min-w-[44px] px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0 shadow-sm shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
