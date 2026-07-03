import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Loader2, Volume2, Download, Wand2, Sun, Moon, Copy, Check, Sparkles, Languages, Sliders, Activity, Headphones, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

// Waveform visualizer component representing live audio playback
function VoiceWaveform({ isPlaying }: { isPlaying: boolean }) {
  const bars = Array.from({ length: 15 }, (_, i) => i);
  return (
    <div className="flex items-center gap-[3px] h-6 px-2 justify-center" dir="ltr">
      {bars.map((bar) => {
        const heightMultiplier = [0.4, 0.9, 0.6, 0.8, 0.5, 0.95, 0.7, 0.5, 0.85, 0.6, 0.9, 0.4, 0.75, 0.5, 0.3][bar];
        return (
          <motion.div
            key={bar}
            className="w-[3px] rounded-full bg-current"
            initial={{ height: 4 }}
            animate={{
              height: isPlaying ? [4, heightMultiplier * 24, 4] : 4
            }}
            transition={{
              duration: isPlaying ? 0.8 + (bar % 3) * 0.15 : 0.2,
              repeat: isPlaying ? Infinity : 0,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </div>
  );
}

const defaultText = `سلام! به خوانشگر هوشمند گلد ویس خوش آمدید. با این ابزار ساده و زیبا می‌توانید متن‌های خود را بنویسید، آن‌ها را با هوش مصنوعی بازنویسی و اصلاح کنید و سپس با صدای گویندگان طبیعی فارسی بشنوید. این برنامه برای تولید محتوای صوتی، دکلمه و پادکست‌های شما طراحی شده است.`;

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
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Already stopped or finished
      }
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
        throw new Error('خطا در بازنویسی متن. لطفاً دوباره تلاش کنید.');
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error('متن خروجی خالی بود.');
      }

      setText(data.text);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'خطایی در ارتباط با سرور رخ داد.');
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
        throw new Error('خطا در برقراری ارتباط با سرویس تولید صدا. مجدداً بررسی کنید.');
      }

      const data = await response.json();
      if (!data.audio) {
        throw new Error('فایل صوتی یافت نشد.');
      }

      // Initialize AudioContext if needed
      if (!audioContextRef.current) {
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
      setError(err.message || 'خطایی در تولید یا پخش صدا رخ داد.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gold_voice_audio.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper values for text statistics
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const charCount = text.length;
  const estimatedReadTime = Math.ceil(wordCount / 130); // ~130 Persian words per minute

  // Tone choices styled as material filter chips
  const toneOptions = [
    { value: 'informal', label: 'عامیانه' },
    { value: 'formal', label: 'رسمی' },
    { value: 'promotional', label: 'تبلیغاتی' },
    { value: 'friendly', label: 'دوستانه' }
  ] as const;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} font-sans selection:bg-zinc-500/20 pb-32 sm:pb-12`} dir="rtl">
      {/* Material Top App Bar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-200 ${isDarkMode ? 'bg-zinc-950/80 border-zinc-900' : 'bg-white/80 border-zinc-200'} px-4 py-3 sm:px-6 lg:px-8`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isDarkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-100 text-zinc-900'}`}>
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">گلد ویس</h1>
              <p className={`text-[10px] font-medium tracking-wide ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>خوانشگر هوشمند متن</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-full transition-all border cursor-pointer ${isDarkMode ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border-zinc-800' : 'bg-white text-zinc-500 hover:text-zinc-900 border-zinc-200 shadow-xs'}`}
            aria-label="تغییر پوسته"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Intro Section - Compact for M3 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-2 border ${isDarkMode ? 'bg-zinc-900/60 text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                <Sparkles className="w-3 h-3 text-amber-500" />
                هوش مصنوعی فارسی
              </span>
              <h2 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-zinc-50' : 'text-zinc-950'}`}>
                تبدیل آنلاین متن به صدای طبیعی
              </h2>
            </div>
            {isPlaying && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDarkMode ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'}`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium">درحال پخش</span>
                <VoiceWaveform isPlaying={isPlaying} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Global Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="text-xs text-rose-500 bg-rose-500/5 p-4 rounded-2xl border border-rose-500/20 leading-relaxed flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 font-bold px-2 cursor-pointer">×</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Material 3 App Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Text Input Area - M3 Card */}
          <div className={`lg:col-span-8 border rounded-3xl overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-zinc-900/30 border-zinc-900' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
            <div className={`px-5 py-4 border-b flex justify-between items-center ${isDarkMode ? 'border-zinc-900 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/50'}`}>
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`} />
                <span className={`text-xs font-semibold tracking-wider font-mono ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  ویرایشگر متن
                </span>
              </div>
              
              <button
                onClick={handleCopyText}
                disabled={!text}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                  copied
                    ? isDarkMode
                      ? 'bg-zinc-900 border-zinc-800 text-emerald-400'
                      : 'bg-zinc-100 border-zinc-200 text-emerald-700'
                    : isDarkMode
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                    : 'bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200 shadow-xs'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'کپی شد!' : 'کپی متن'}</span>
              </button>
            </div>
            
            <div className="p-5">
              <label htmlFor="script" className="sr-only">متن خوانش</label>
              <textarea
                id="script"
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir="rtl"
                className={`w-full min-h-[320px] lg:min-h-[400px] border-0 rounded-2xl p-2 leading-relaxed resize-none focus:outline-none focus:ring-0 transition-all font-sans text-base ${isDarkMode ? 'bg-transparent text-zinc-100 placeholder:text-zinc-700' : 'bg-transparent text-zinc-900 placeholder:text-zinc-400'}`}
                placeholder="متن خود را اینجا بنویسید یا بچسبانید..."
              />
            </div>

            {/* Editor Bottom Stats */}
            <div className={`px-5 py-3 border-t flex flex-wrap gap-x-4 gap-y-2 justify-between text-xs font-medium ${isDarkMode ? 'border-zinc-900 text-zinc-500' : 'border-zinc-100 text-zinc-400'}`}>
              <div className="flex gap-4">
                <span>کاراکتر: <strong className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>{charCount}</strong></span>
                <span>کلمات: <strong className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>{wordCount}</strong></span>
              </div>
              <div>
                <span>زمان حدودی خواندن: <strong className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>{estimatedReadTime} دقیقه</strong></span>
              </div>
            </div>
          </div>

          {/* Sidebar Settings Panel - M3 Card */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className={`rounded-3xl p-6 border transition-all duration-200 ${isDarkMode ? 'bg-zinc-900/30 border-zinc-900' : 'bg-white border-zinc-200 shadow-xs'}`}>
              
              {/* Voice Segmented Control M3 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className={`w-4 h-4 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} />
                  <h3 className={`text-xs font-semibold uppercase font-mono tracking-wider ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    انتخاب گوینده (صدا)
                  </h3>
                </div>
                
                <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-full border ${isDarkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                  <button
                    onClick={() => setVoice('female')}
                    className={`py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      voice === 'female'
                        ? isDarkMode
                          ? 'bg-zinc-100 text-zinc-950 shadow-sm font-bold'
                          : 'bg-zinc-950 text-zinc-50 shadow-sm font-bold'
                        : isDarkMode
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                        : 'text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/50'
                    }`}
                  >
                    زن ایرانی
                  </button>
                  <button
                    onClick={() => setVoice('male')}
                    className={`py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      voice === 'male'
                        ? isDarkMode
                          ? 'bg-zinc-100 text-zinc-950 shadow-sm font-bold'
                          : 'bg-zinc-950 text-zinc-50 shadow-sm font-bold'
                        : isDarkMode
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                        : 'text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/50'
                    }`}
                  >
                    مرد ایرانی
                  </button>
                </div>
              </div>

              {/* Speed Segmented Control M3 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sliders className={`w-4 h-4 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} />
                  <h4 className={`text-xs font-semibold font-mono uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    سرعت پخش گویش
                  </h4>
                </div>
                
                <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-full border ${isDarkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                  {[0.8, 1.0, 1.2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                        playbackSpeed === speed
                          ? isDarkMode
                            ? 'bg-zinc-100 text-zinc-950 shadow-sm font-bold'
                            : 'bg-zinc-950 text-zinc-50 shadow-sm font-bold'
                          : isDarkMode
                          ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                          : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
                      }`}
                    >
                      {speed === 0.8 ? '۰.۸x (آرام)' : speed === 1.0 ? '۱.۰x (عادی)' : '۱.۲x (تند)'}
                    </button>
                  ))}
                </div>
              </div>

              <hr className={`my-5 ${isDarkMode ? 'border-zinc-900' : 'border-zinc-100'}`} />

              {/* Rewrite Engine (M3 Chips selection) */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Languages className={`w-4 h-4 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} />
                  <h3 className={`text-xs font-semibold font-mono uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    اصلاح و تغییر لحن هوشمند
                  </h3>
                </div>

                {/* Horizontal / wrap chips list */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {toneOptions.map((tone) => {
                    const isSelected = rewriteTone === tone.value;
                    return (
                      <button
                        key={tone.value}
                        onClick={() => setRewriteTone(tone.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-zinc-100 text-zinc-950 border-transparent font-bold'
                              : 'bg-zinc-950 text-zinc-50 border-transparent font-bold'
                            : isDarkMode
                            ? 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200/60 hover:bg-zinc-200/60 hover:text-zinc-800'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                        {tone.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleRewrite}
                  disabled={isRewriting || isLoading || !text.trim()}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-xs transition-all border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    isDarkMode
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border-zinc-800'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-transparent'
                  }`}
                >
                  {isRewriting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{isRewriting ? 'در حال بازنویسی متن...' : 'بازنویسی با هوش مصنوعی'}</span>
                </button>
              </div>

              {/* PC / Large Screen Play Actions */}
              <div className="hidden sm:block">
                <hr className={`my-5 ${isDarkMode ? 'border-zinc-900' : 'border-zinc-100'}`} />
                
                <div className="flex flex-col gap-3">
                  {!isPlaying ? (
                    <button
                      onClick={handleGenerateAndPlay}
                      disabled={isLoading || !text.trim()}
                      className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-full font-bold text-sm transition-all border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                        isDarkMode
                          ? 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-transparent shadow-lg'
                          : 'bg-zinc-950 text-zinc-100 hover:bg-zinc-800 border-transparent shadow-md'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <Play className="w-4.5 h-4.5 fill-current" />
                      )}
                      <span>{isLoading ? 'در حال ساخت فایل صوتی...' : 'تولید و پخش صدای طبیعی'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopAudio}
                      className="w-full flex items-center justify-center gap-2.5 bg-rose-600 hover:bg-rose-500 text-white py-3.5 px-5 rounded-full font-bold text-sm transition-all cursor-pointer shadow-md"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>توقف پخش</span>
                    </button>
                  )}

                  {audioBlob && (
                    <button
                      onClick={handleDownload}
                      className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full font-semibold text-xs transition-all border cursor-pointer ${
                        isDarkMode 
                          ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800' 
                          : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200 shadow-xs'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      <span>دانلود فایل با فرمت WAV</span>
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* AI Engine specifications footer */}
            <div className={`p-4 rounded-3xl border text-center ${isDarkMode ? 'bg-zinc-900/10 border-zinc-900/60' : 'bg-zinc-100/50 border-zinc-200/50'}`}>
              <div className="text-[11px] font-medium flex items-center justify-center gap-1.5">
                <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>موتور پردازش صدا:</span>
                <span className={`font-semibold font-mono ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} dir="ltr">Gemini 3.1 Flash (TTS)</span>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Floating Sticky Bottom Bar for Mobile & Tablet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:hidden bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className={`rounded-2xl p-3 border shadow-2xl flex items-center justify-between gap-3 ${
            isDarkMode 
              ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100 backdrop-blur-md' 
              : 'bg-white/95 border-zinc-200 text-zinc-900 backdrop-blur-md'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                ) : isPlaying ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                ) : (
                  <Headphones className={`w-4 h-4 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">
                  {isLoading ? 'در حال تبدیل...' : isPlaying ? 'در حال پخش...' : 'آماده پخش'}
                </span>
                <span className="text-[9px] text-zinc-500 font-medium">
                  {voice === 'female' ? 'زن ایرانی' : 'مرد ایرانی'} • {playbackSpeed}x
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {audioBlob && (
                <button
                  onClick={handleDownload}
                  className={`p-2.5 rounded-full border cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200'
                  }`}
                  title="دانلود فایل صوتی"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}

              {/* Main Play/Stop Button FAB on mobile */}
              {!isPlaying ? (
                <button
                  onClick={handleGenerateAndPlay}
                  disabled={isLoading || !text.trim()}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-full font-bold text-xs cursor-pointer shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDarkMode ? 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-950 text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>بشنو</span>
                </button>
              ) : (
                <button
                  onClick={stopAudio}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 px-4 rounded-full font-bold text-xs cursor-pointer shadow-lg transition-all"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>توقف</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

