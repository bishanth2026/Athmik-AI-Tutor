import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../clientApi';
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  RotateCcw,
  Sparkles,
  User,
  Loader2,
} from 'lucide-react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const HISTORY_KEY = 'athmik_ai_assistant_history_v1';
const MODEL = 'gemini-3.8-live';

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const samples = new Float32Array(Math.floor(binary.length / 2));
  for (let i = 0; i < samples.length; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    let value = (hi << 8) | lo;
    if (value & 0x8000) value -= 0x10000;
    samples[i] = value / 32768;
  }
  return samples;
}

function float32ToPcm16Base64(input: Float32Array, inputRate: number): string {
  const ratio = inputRate / 16000;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const bytes = new Uint8Array(outputLength * 2);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = Math.min(input.length - 1, Math.floor(i * ratio));
    const sample = Math.max(-1, Math.min(1, input[sourceIndex]));
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    const intValue = Math.round(value);
    bytes[i * 2] = intValue & 0xff;
    bytes[i * 2 + 1] = (intValue >> 8) & 0xff;
  }

  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function readStoredHistory(studentId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY}_${studentId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-60) : [];
  } catch {
    return [];
  }
}

export const AIAssistantView: React.FC = () => {
  const { student } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredHistory(student.id));
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextAudioTimeRef = useRef(0);
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const assistantDraftRef = useRef('');
  const sessionHandleRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`${HISTORY_KEY}_${student.id}`, JSON.stringify(messages.slice(-60)));
    } catch {}
  }, [messages, student.id]);

  const stopPlayback = useCallback(() => {
    playbackSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    });
    playbackSourcesRef.current = [];
    nextAudioTimeRef.current = 0;
    setSpeaking(false);
  }, []);

  const cleanupMicrophone = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    processorRef.current = null;
    sourceRef.current = null;
    mediaStreamRef.current = null;
    setListening(false);
  }, []);

  const closeSession = useCallback(() => {
    cleanupMicrophone();
    stopPlayback();
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN) socket.close(1000, 'User closed session');
    setConnected(false);
    setConnecting(false);
    setStatus('Ready');
  }, [cleanupMicrophone, stopPlayback]);

  const appendMessage = useCallback((role: ChatMessage['role'], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text: clean },
    ]);
  }, []);

  const queueAudio = useCallback(async (base64: string) => {
    if (muted) return;
    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === 'suspended') await context.resume();

    const samples = pcm16Base64ToFloat32(base64);
    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const now = context.currentTime;
    const startAt = Math.max(now + 0.01, nextAudioTimeRef.current || now + 0.01);
    nextAudioTimeRef.current = startAt + buffer.duration;
    setSpeaking(true);

    source.onended = () => {
      playbackSourcesRef.current = playbackSourcesRef.current.filter((item) => item !== source);
      if (playbackSourcesRef.current.length === 0 && context.currentTime >= nextAudioTimeRef.current - 0.03) {
        setSpeaking(false);
      }
    };
    playbackSourcesRef.current.push(source);
    source.start(startAt);
  }, [muted]);

  const connect = useCallback(async () => {
    if (connected || connecting) return;
    setError('');
    setConnecting(true);
    setStatus('Connecting to AI voice...');

    try {
      const tokenController = new AbortController();
      const tokenTimeout = setTimeout(() => tokenController.abort(), 12000);
      let tokenResponse: Response;
      try {
        tokenResponse = await apiFetch('/api/ai-assistant/token', {
          method: 'POST',
          signal: tokenController.signal,
        });
      } finally {
        clearTimeout(tokenTimeout);
      }
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData?.token) {
        throw new Error(tokenData?.error || 'Could not create a secure AI voice session.');
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const socket = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenData.token)}`
      );
      socketRef.current = socket;

      // There are two separate phases: the TCP/WebSocket handshake and Gemini's
      // setup acknowledgement. A socket can be OPEN while Gemini has rejected or
      // is still processing the setup payload, so the old CONNECTING-only timeout
      // could leave the UI spinning forever.
      let setupCompleteReceived = false;
      const setupTimeout = window.setTimeout(() => {
        if (!setupCompleteReceived) {
          try { socket.close(1000, 'Gemini setup timeout'); } catch {}
          setError('Gemini Live setup timed out. The voice session was not accepted.');
          setStatus('Setup timed out');
          setConnecting(false);
          setConnected(false);
        }
      }, 12000);

      const socketTimeout = window.setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.close();
          setError('Gemini Live WebSocket connection timed out. Please try again.');
          setStatus('Connection timed out');
          setConnecting(false);
          setConnected(false);
        }
      }, 15000);

      socket.onopen = () => {
        window.clearTimeout(socketTimeout);
        setStatus('Authorised — starting Gemini Live...');

        // Keep the first setup payload deliberately minimal and aligned with the
        // raw Live API wire schema. Advanced session features are added only after
        // the baseline voice connection is proven.
        socket.send(JSON.stringify({
          setup: {
            model: `models/${MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
            },
            systemInstruction: {
              parts: [{
                text: `You are Athmik's friendly AI Assistant. Student name: ${student.name}. Have natural, helpful, age-appropriate conversations. Answer general questions, school questions, maths, science, English, Malayalam and Manglish. Explain clearly for a Class 5 CBSE student when the question is academic, but do not force quiz evaluation unless the student explicitly asks for a quiz or answer checking. Remember the current conversation and answer follow-up questions naturally. If the student speaks Malayalam or Manglish, respond naturally in Malayalam/Manglish as appropriate. Keep spoken answers clear and reasonably concise.`,
              }],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }));
      };

      socket.onmessage = async (event) => {
        let response: any;
        try {
          response = JSON.parse(event.data);
        } catch {
          setError('Gemini Live returned an invalid message.');
          setStatus('Protocol error');
          setConnecting(false);
          return;
        }

        if (response.error) {
          window.clearTimeout(setupTimeout);
          const apiMessage = response.error.message || response.error.status || 'Gemini Live rejected the session setup.';
          setError(`Gemini Live error: ${apiMessage}`);
          setStatus('Gemini setup rejected');
          setConnecting(false);
          setConnected(false);
          try { socket.close(1000, 'Gemini setup rejected'); } catch {}
          return;
        }

        const content = response.serverContent;

        if (response.setupComplete) {
          setupCompleteReceived = true;
          window.clearTimeout(setupTimeout);
          setConnected(true);
          setConnecting(false);
          setStatus('Connected — tap the microphone and talk');
        }

        if (response.sessionResumptionUpdate?.resumable && response.sessionResumptionUpdate.newHandle) {
          sessionHandleRef.current = response.sessionResumptionUpdate.newHandle;
        }

        if (content?.interrupted) {
          stopPlayback();
          assistantDraftRef.current = '';
          setStatus('Listening');
        }

        if (content?.inputTranscription?.text) {
          const text = content.inputTranscription.text.trim();
          if (text) appendMessage('user', text);
        }

        if (content?.outputTranscription?.text) {
          assistantDraftRef.current += content.outputTranscription.text;
        }

        if (content?.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data && String(part.inlineData.mimeType || '').startsWith('audio/pcm')) {
              await queueAudio(part.inlineData.data);
            }
          }
        }

        if (content?.turnComplete) {
          const assistantText = assistantDraftRef.current.trim();
          if (assistantText) appendMessage('assistant', assistantText);
          assistantDraftRef.current = '';
          setStatus(listening ? 'Listening' : 'Connected');
        }
      };

      socket.onerror = () => {
        window.clearTimeout(setupTimeout);
        setError('Voice connection failed. Gemini Live could not establish the session.');
        setStatus('Connection error');
        setConnecting(false);
        setConnected(false);
      };

      socket.onclose = (event) => {
        window.clearTimeout(socketTimeout);
        window.clearTimeout(setupTimeout);
        socketRef.current = null;
        cleanupMicrophone();
        stopPlayback();
        setConnected(false);
        setConnecting(false);
        if (event.code !== 1000) {
          setError('The AI voice session ended. Tap Connect to start a new session.');
          setStatus('Disconnected');
        } else {
          setStatus('Ready');
        }
      };
    } catch (err: any) {
      const message = err?.name === 'AbortError'
        ? 'The AI Assistant connection timed out. Please try again.'
        : (err?.message || 'Unable to connect to the AI Assistant.');
      setError(message);
      setStatus(err?.name === 'AbortError' ? 'Connection timed out' : 'Connection failed');
      setConnecting(false);
      setConnected(false);
    }
  }, [appendMessage, cleanupMicrophone, connected, connecting, listening, queueAudio, stopPlayback, student.name]);

  const startMicrophone = useCallback(async () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      await connect();
      return;
    }
    if (listening) {
      cleanupMicrophone();
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      }
      setStatus('Connected');
      return;
    }

    try {
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      await context.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      sourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const base64 = float32ToPcm16Base64(inputData, context.sampleRate);
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000',
            },
          },
        }));
      };

      source.connect(processor);
      processor.connect(context.destination);
      setListening(true);
      setStatus('Listening — speak naturally');
    } catch (err: any) {
      setError(err?.message || 'Microphone permission was denied.');
      setStatus('Microphone unavailable');
    }
  }, [cleanupMicrophone, connect, listening]);

  const sendText = useCallback(() => {
    const text = input.trim();
    const socket = socketRef.current;
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

    appendMessage('user', text);
    setInput('');
    setStatus('Thinking...');
    socket.send(JSON.stringify({ realtimeInput: { text } }));
  }, [appendMessage, input]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    assistantDraftRef.current = '';
    try { localStorage.removeItem(`${HISTORY_KEY}_${student.id}`); } catch {}
  }, [student.id]);

  useEffect(() => () => closeSession(), [closeSession]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-indigo-100 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" /> AI Assistant
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-3">
              Talk to Athmik AI
            </h1>
            <p className="text-sm text-indigo-200 mt-1 max-w-2xl">
              Ask anything. Speak naturally, interrupt the assistant, ask follow-up questions, or type when you prefer.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {connected ? <Wifi className="w-4 h-4 text-emerald-300" /> : <WifiOff className="w-4 h-4 text-slate-400" />}
            <span>{status}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-bold text-slate-900">Conversation</h2>
              <p className="text-[11px] text-slate-400">Your recent discussion is kept on this device.</p>
            </div>
          </div>
          <button onClick={clearConversation} className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        <div className="min-h-[360px] max-h-[52vh] overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center">
                <Bot className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 mt-4">Hello {student.name}! 👋</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Connect your voice assistant and ask me anything — lessons, homework, general knowledge, or just have a conversation.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-6 ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}>
                  {message.text}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 p-4 sm:p-5 space-y-3">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5">
              {error}
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={connected ? startMicrophone : connect}
              disabled={connecting}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
                listening
                  ? 'bg-red-500 text-white animate-pulse'
                  : connected
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
              } disabled:opacity-60`}
              title={connected ? (listening ? 'Stop listening' : 'Start microphone') : 'Connect AI Assistant'}
            >
              {connecting ? <Loader2 className="w-7 h-7 animate-spin" /> : listening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            {connected && (
              <button
                onClick={() => { setMuted((value) => !value); if (!muted) stopPlayback(); }}
                className="w-11 h-11 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                title={muted ? 'Turn voice on' : 'Mute AI voice'}
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
            {connected && (
              <button onClick={closeSession} className="px-4 h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Disconnect
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }}
              disabled={!connected}
              placeholder={connected ? 'Type a question or follow-up...' : 'Connect the AI Assistant first'}
              className="flex-1 min-h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              onClick={sendText}
              disabled={!connected || !input.trim()}
              className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <p className="text-center text-[11px] text-slate-400">
            Voice input uses your browser microphone. Keep the tab open while talking.
          </p>
        </div>
      </div>
    </div>
  );
};
