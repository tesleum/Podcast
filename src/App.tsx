import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Loader2, Volume2, Download, Wand2, Sun, Moon, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

function createWAV(pcm16Array: Int16Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + pcm16Array.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + pcm16Array.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, pcm16Array.length * 2, true);

  // Write PCM data
  for (let i = 0; i < pcm16Array.length; i++) {
    view.setInt16(44 + i * 2, pcm16Array[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

const defaultText = ``;

export default function App() {
  const [text, setText] = useState(() => {
    const saved = localStorage.getItem('solana-gold-script');
    return saved !== null ? saved : defaultText;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [voice, setVoice] = useState<'female' | 'male'>('female');
  const [rewriteTone, setRewriteTone] = useState<'informal' | 'formal' | 'promotional' | 'friendly'>('informal');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    localStorage.setItem('solana-gold-script', text);
  }, [text]);

  useEffect(() => {
    if (isPlaying && sourceNodeRef.current) {
      try {
        sourceNodeRef.current.playbackRate.value = playbackSpeed;
      } catch (e) {
        console.error(e);
      }
    }
  }, [playbackSpeed, isPlaying]);

  const handleCopyText = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleRewrite = async () => {
    if (!text.trim()) return;
    
    setIsRewriting(true);
    setError(null);

    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tone: rewriteTone })
      });

      if (!response.ok) {
        throw new Error('Failed to rewrite text');
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error('No text returned');
      }

      setText(data.text);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while rewriting text');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleGenerateAndPlay = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setError(null);
    stopAudio();
    setAudioBlob(null);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const data = await response.json();
      if (!data.audio) {
        throw new Error('No audio returned');
      }

      // Initialize AudioContext if needed
      if (!audioContextRef.current) {
        // Output sample rate is 24000
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Decode base64 to ArrayBuffer
      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode PCM (16-bit little-endian) to AudioBuffer
      const int16Array = new Int16Array(bytes.buffer);
      
      // Create WAV blob for download
      const wavBlob = createWAV(int16Array, 24000);
      setAudioBlob(wavBlob);

      const audioBuffer = audioContextRef.current.createBuffer(1, int16Array.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.playbackRate.value = playbackSpeed;
      sourceNode.connect(audioContextRef.current.destination);
      
      sourceNode.onended = () => {
        setIsPlaying(false);
      };

      sourceNodeRef.current = sourceNode;
      sourceNode.start();
      setIsPlaying(true);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating audio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zinc-500/20`} dir="rtl">
      <div className="max-w-4xl mx-auto relative">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`absolute top-0 left-0 p-2 rounded-lg transition-colors border ${isDarkMode ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border-zinc-800' : 'bg-white text-zinc-500 hover:text-zinc-900 border-zinc-200 shadow-sm'}`}
          aria-label="تغییر پوسته"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-10"
        >
          <div className={`inline-flex items-center justify-center p-3 rounded-lg mb-4 border ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-800 shadow-sm'}`}>
            <Volume2 className="w-7 h-7" />
          </div>
          <h1 className={`text-3xl font-semibold tracking-tight mb-2 ${isDarkMode ? 'text-zinc-50' : 'text-zinc-950'}`}>
            خوانشگر هوشمند Gold Voice
          </h1>
          <p className={`max-w-xl mx-auto text-sm ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
            متن خود را بنویسید، با هوش مصنوعی بازنویسی کنید و با صدای طبیعی گویندگان ایرانی پخش کنید.
          </p>
        </motion.div>

        <div className={`border rounded-xl overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <div className={`px-4 py-3 border-b flex justify-between items-center ${isDarkMode ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-100 bg-zinc-50/50'}`}>
            <div className="flex space-x-1.5 space-x-reverse">
              <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-zinc-700' : 'bg-zinc-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-zinc-700' : 'bg-zinc-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-zinc-700' : 'bg-zinc-300'}`}></div>
            </div>
            <div className={`text-xs font-mono tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
              GOLDVOICE // TTS ENGINE
            </div>
          </div>
          
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  متن ورودی
                </span>
                <button
                  onClick={handleCopyText}
                  disabled={!text}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                    copied
                      ? isDarkMode
                        ? 'bg-zinc-900 border-zinc-800 text-emerald-400'
                        : 'bg-zinc-50 border-zinc-200 text-emerald-600'
                      : isDarkMode
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                      : 'bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200 shadow-xs'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'کپی شد!' : 'کپی متن'}</span>
                </button>
              </div>
              <label htmlFor="script" className="sr-only">متن ارائه</label>
              <textarea
                id="script"
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir="rtl"
                className={`w-full h-[450px] border rounded-lg p-5 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all font-sans text-base ${isDarkMode ? 'bg-zinc-950/40 border-zinc-800 text-zinc-100 placeholder:text-zinc-700' : 'bg-zinc-50/50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`}
                placeholder="متن خود را اینجا وارد کنید..."
              />
            </div>
            
            <div className="md:w-64 flex flex-col gap-4">
              <div className={`rounded-lg p-5 border transition-colors duration-200 ${isDarkMode ? 'bg-zinc-950/30 border-zinc-800/80' : 'bg-zinc-50/40 border-zinc-200'}`}>
                <h3 className={`text-xs font-semibold uppercase font-mono tracking-wider mb-4 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  کنترل‌های پخش
                </h3>
                
                {error && (
                  <div className="mb-4 text-xs text-rose-500 bg-rose-500/5 p-3 rounded-lg border border-rose-500/20 leading-relaxed">
                    {error}
                  </div>
                )}
                
                {!isPlaying ? (
                  <button
                    onClick={handleGenerateAndPlay}
                    disabled={isLoading || !text.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      isDarkMode
                        ? 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-transparent'
                        : 'bg-zinc-950 text-zinc-100 hover:bg-zinc-800 border-transparent'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{isLoading ? 'در حال تولید...' : 'تولید و پخش صدا'}</span>
                  </button>
                ) : (
                  <button
                    onClick={stopAudio}
                    className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>توقف پخش</span>
                  </button>
                )}

                {audioBlob && (
                  <button
                    onClick={handleDownload}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all border mt-3 cursor-pointer ${
                      isDarkMode 
                        ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800' 
                        : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود فایل صوتی</span>
                  </button>
                )}

                <div className="mt-4">
                  <h4 className={`text-xs font-semibold font-mono uppercase tracking-wider mb-2.5 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    سرعت پخش
                  </h4>
                  <div className={`grid grid-cols-3 gap-1 p-1 rounded-lg border ${isDarkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                    {[0.8, 1.0, 1.2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                          playbackSpeed === speed
                            ? isDarkMode
                              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                              : 'bg-white text-zinc-900 border border-zinc-200 shadow-xs'
                            : isDarkMode
                            ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                        }`}
                      >
                        {speed === 0.8 ? '۰.۸x' : speed === 1.0 ? '۱.۰x' : '۱.۲x'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <hr className={`my-4 ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`} />
                
                <h3 className={`text-xs font-semibold font-mono uppercase tracking-wider mb-2.5 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  گوینده و صدا
                </h3>
                
                <div className={`grid grid-cols-2 gap-1 p-1 rounded-lg border mb-5 ${isDarkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                  <button
                    onClick={() => setVoice('female')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      voice === 'female'
                        ? isDarkMode
                          ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                          : 'bg-white text-zinc-900 border border-zinc-200 shadow-xs'
                        : isDarkMode
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                        : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                    }`}
                  >
                    زن ایرانی
                  </button>
                  <button
                    onClick={() => setVoice('male')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      voice === 'male'
                        ? isDarkMode
                          ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                          : 'bg-white text-zinc-900 border border-zinc-200 shadow-xs'
                        : isDarkMode
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                        : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                    }`}
                  >
                    مرد ایرانی
                  </button>
                </div>

                <h3 className={`text-xs font-semibold font-mono uppercase tracking-wider mb-2.5 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  عملیات متن
                </h3>
                
                <div className="mb-2">
                  <select
                    value={rewriteTone}
                    onChange={(e) => setRewriteTone(e.target.value as any)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'}`}
                    dir="rtl"
                  >
                    <option value="informal">عامیانه</option>
                    <option value="formal">رسمی</option>
                    <option value="promotional">تبلیغاتی</option>
                    <option value="friendly">دوستانه</option>
                  </select>
                </div>

                <button
                  onClick={handleRewrite}
                  disabled={isRewriting || isLoading || !text.trim()}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-xs transition-all border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    isDarkMode
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-transparent'
                  }`}
                >
                  {isRewriting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isRewriting ? 'در حال بازنویسی...' : 'بازنویسی با هوش مصنوعی'}</span>
                </button>

                <div className="mt-6 space-y-3.5">
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-zinc-500' : 'text-zinc-400 font-medium'}>گوینده</span>
                    <span className={`font-medium ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>{voice === 'female' ? 'زن ایرانی' : 'مرد ایرانی'}</span>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-zinc-500' : 'text-zinc-400 font-medium'}>سرعت پخش</span>
                    <span className={`font-medium ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>{playbackSpeed === 0.8 ? '۰.۸x' : playbackSpeed === 1.0 ? '۱.۰x' : '۱.۲x'}</span>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-zinc-500' : 'text-zinc-400 font-medium'}>لحن بازنویسی</span>
                    <span className={`font-medium ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      {rewriteTone === 'informal' ? 'عامیانه' : rewriteTone === 'formal' ? 'رسمی' : rewriteTone === 'promotional' ? 'تبلیغاتی' : 'دوستانه'}
                    </span>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-zinc-500' : 'text-zinc-400 font-medium'}>موتور هوش مصنوعی</span>
                    <span className={`font-mono text-[10px] ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} dir="ltr">Gemini 3.1 Flash</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
