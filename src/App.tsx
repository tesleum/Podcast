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
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] text-slate-200' : 'bg-slate-50 text-slate-800'} py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500/30`} dir="rtl">
      <div className="max-w-4xl mx-auto relative">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`absolute top-0 left-0 p-2 rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-500 hover:text-slate-900 shadow-sm border border-slate-200'}`}
          aria-label="تغییر پوسته"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className={`inline-flex items-center justify-center p-3 rounded-full mb-4 border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-100 border-indigo-200 text-indigo-600'}`}>
            <Volume2 className="w-8 h-8" />
          </div>
          <h1 className={`text-3xl font-medium tracking-tight mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            خوانشگر هوشمند Gold Voice
          </h1>
          <p className={`max-w-2xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            متن خود را وارد کنید، لحن آن را با هوش مصنوعی بازنویسی کنید و با گوینده دلخواه بشنوید.
          </p>
        </motion.div>

        <div className={`backdrop-blur-sm border rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/80 border-slate-200'}`}>
          <div className={`p-1 border-b ${isDarkMode ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
            <div className="flex space-x-2 space-x-reverse px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
          </div>
          
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>متن ارائه</span>
                <button
                  onClick={handleCopyText}
                  disabled={!text}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                className={`w-full h-[500px] border rounded-xl p-5 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans text-lg ${isDarkMode ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                placeholder="متن ارائه را اینجا وارد کنید..."
              />
            </div>
            
            <div className="md:w-64 flex flex-col gap-4">
              <div className={`rounded-xl p-5 border transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`text-sm font-medium uppercase tracking-wider mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>کنترل‌های پخش</h3>
                
                {error && (
                  <div className="mb-4 text-sm text-rose-500 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                    {error}
                  </div>
                )}
                
                {!isPlaying ? (
                  <button
                    onClick={handleGenerateAndPlay}
                    disabled={isLoading || !text.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed group mb-3"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                    <span>{isLoading ? 'در حال تولید...' : 'پخش صدا'}</span>
                  </button>
                ) : (
                  <button
                    onClick={stopAudio}
                    className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900 mb-3"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>توقف پخش</span>
                  </button>
                )}

                {audioBlob && (
                  <button
                    onClick={handleDownload}
                    className={`w-full flex items-center justify-center gap-2 text-white py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 mb-3 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 focus:ring-slate-500 focus:ring-offset-slate-900' : 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-400 focus:ring-offset-white'}`}
                  >
                    <Download className="w-5 h-5" />
                    <span>دانلود صدا</span>
                  </button>
                )}

                <div className="mt-3 mb-1">
                  <h4 className={`text-xs font-medium uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400/80' : 'text-slate-500'}`}>سرعت پخش</h4>
                  <div className={`grid grid-cols-3 gap-1 p-1 rounded-lg border ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    {[0.8, 1.0, 1.2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                          playbackSpeed === speed
                            ? isDarkMode
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-indigo-500 text-white shadow-sm'
                            : isDarkMode
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {speed === 0.8 ? '۰.۸x' : speed === 1.0 ? '۱.۰x' : '۱.۲x'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <hr className={`my-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                
                <h3 className={`text-sm font-medium uppercase tracking-wider mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>تنظیمات صدا</h3>
                
                <div className={`flex p-1 rounded-lg border mb-6 ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <button
                    onClick={() => setVoice('female')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      voice === 'female'
                        ? isDarkMode
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-indigo-500 text-white shadow-sm'
                        : isDarkMode
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    زن ایرانی
                  </button>
                  <button
                    onClick={() => setVoice('male')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      voice === 'male'
                        ? isDarkMode
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-indigo-500 text-white shadow-sm'
                        : isDarkMode
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    مرد ایرانی
                  </button>
                </div>

                <h3 className={`text-sm font-medium uppercase tracking-wider mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>عملیات متن</h3>
                
                <div className="mb-3">
                  <select
                    value={rewriteTone}
                    onChange={(e) => setRewriteTone(e.target.value as any)}
                    className={`w-full p-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
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
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRewriting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Wand2 className="w-5 h-5" />
                  )}
                  <span>{isRewriting ? 'در حال بازنویسی...' : 'بازنویسی با هوش مصنوعی'}</span>
                </button>

                <div className="mt-6 space-y-4">
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>گوینده</span>
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{voice === 'female' ? 'زن ایرانی' : 'مرد ایرانی'}</span>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>سرعت پخش</span>
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{playbackSpeed === 0.8 ? '۰.۸x' : playbackSpeed === 1.0 ? '۱.۰x' : '۱.۲x'}</span>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>لحن بازنویسی</span>
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      {rewriteTone === 'informal' ? 'عامیانه' : rewriteTone === 'formal' ? 'رسمی' : rewriteTone === 'promotional' ? 'تبلیغاتی' : 'دوستانه'}
                    </span>
                  </div>
                  <div className="text-xs flex items-center justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>موتور هوش مصنوعی</span>
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'} dir="ltr">Gemini 3.1 Flash</span>
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
