import React, { useState, useRef } from 'react';
import { Play, Square, Loader2, Volume2, Download, Wand2 } from 'lucide-react';
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

const defaultText = `سَلام و دُرود خدمت شما.

این ویدئو با هدفِ معرفی و توضیحِ پروژهٔ «Solana Gold» تهیه شده است تا شما با نحوهٔ عملکرد، امکانات و روشهای کسب درآمد در این پروژه آشنا شوید.

پروژهٔ «Solana Gold» یک پروژهٔ مبتنی بر قرارداد هوشمند یا «Smart Contract» است که بر روی شبکهٔ اصلیِ بلاکچینِ سولانا طراحی و اجرا شده است.

امّا قرارداد هوشمند چیست؟

قرارداد هوشمند، برنامهای است که روی شبکهٔ بلاکچین اجرا میشود و پس از فراهم شدن شرایطِ از پیش تعیینشده، بهصورت کاملاً خودکار عملیاتِ مورد نظر را انجام میدهد. در این نوع قراردادها، دیگر نیازی به واسطههایی مانند بانک، دفترخانه یا شخصِ ثالث وجود ندارد و تمام فرآیندها بهصورت شفاف و خودکار انجام میشوند.
برای مثال، اگر قرار باشد پس از پرداختِ مبلغ، مالکیتِ یک داراییِ دیجیتال به شخصِ دیگری منتقل شود، قرارداد هوشمند این کار را بدون دخالتِ هیچ فردی انجام میدهد.

مهمترین مزایای قراردادهای هوشمند عبارتاند از:

• اجرای کاملاً خودکار، بدون نیاز به دخالت انسان.
• شفافیتِ کامل و قابلِ بررسی بودنِ قوانینِ قرارداد روی بلاکچین.
• امنیتِ بسیار بالا و غیرقابلِ تغییر بودنِ اطلاعاتِ ثبتشده.
• کاهشِ هزینهها و افزایشِ سرعتِ انجام تراکنشها با حذف واسطهها.

در پروژهٔ «Solana Gold»، شما میتوانید تنها با ۱۰ تا ۱۰۰ دلار فعالیتِ خود را آغاز کنید و علاوه بر دریافتِ آموزشهای تخصصی، از چندین روشِ مختلف برای کسب درآمد دلاری استفاده کنید.
بخشِ اوّل؛ آموزش.

در ابتدای ورود به پروژه، مجموعهای از آموزشهای کاربردی در اختیار شما قرار میگیرد که شامل موارد زیر است:

* آموزشِ مقدماتیِ بلاکچین و ارزهای دیجیتال.
* آموزشِ اصولِ شبکهسازی، تیمسازی و کارِ تیمی.
* آموزشِ روشهای کسب درآمد دلاری از بازار ارزهای دیجیتال و فعالیت در پروژهٔ «Solana Gold».

هدفِ این آموزشها آن است که کاربران، علاوه بر استفاده از امکاناتِ پروژه، دانشِ لازم برای فعالیتِ حرفهای در این حوزه را نیز کسب کنند.
بخشِ دوم؛ پلنِ درآمدزاییِ «Solana Gold».

اوّلین روشِ کسب درآمد در این پروژه، پاداشِ «Unilevel Bonus» یا یونیلول است.

تمامِ واریزها، برداشتها و پرداختِ پورسانتها در این پروژه با ارزِ دیجیتالِ سولانا، یعنی «SOL»، انجام میشود.

پس از ثبتنام و شروعِ فعالیت، یک کدِ معرفیِ اختصاصی در اختیارِ شما قرار میگیرد. با استفاده از این کد میتوانید افرادِ دیگر را به پروژه دعوت کنید.

هر شخصی که مستقیماً با کدِ معرفیِ شما وارد پروژه شود، در لایهٔ اوّلِ شما قرار میگیرد و شما بیست درصد از مبلغِ ورودِ او را بهصورت آنی دریافت خواهید کرد.
تعدادِ افرادِ لایهٔ اوّل محدودیتی ندارد و شما میتوانید هر تعداد که بخواهید بهصورت مستقیم معرفی کنید.

اگر همان افراد نیز افرادِ جدیدی را به پروژه دعوت کنند، آنها در لایهٔ دومِ شما قرار میگیرند و شما ده درصد از مبلغِ ورودِ آنها را دریافت میکنید.

برای مثال، اگر حسین با کدِ معرفیِ شما وارد پروژه شود و فعالیتِ خود را با ده دلار آغاز کند، شما همان لحظه دو دلار پورسانت دریافت خواهید کرد.

این سیستم تا ده لایه ادامه دارد و درصدِ پورسانتِ هر لایه به شرح زیر است:

لایهٔ یک: ۲۰ درصد
لایهٔ دو: ۱۰ درصد
لایهٔ سه: ۸ درصد
لایهٔ چهار: ۶ درصد
لایهٔ پنج: ۵ درصد
لایهٔ شش: ۴ درصد.
لایهٔ هفت: ۳ درصد.
لایهٔ هشت: ۲ درصد.
لایهٔ نه: ۱ درصد.
لایهٔ ده: ۱ درصد.

نکتهٔ مهم این است که تمامیِ این پورسانتها بهصورت لحظهای و مستقیماً توسط قراردادِ هوشمند به کیفِ پولِ متصلِ شما واریز میشوند و هیچ واسطهای در پرداختِ آنها وجود ندارد.

پاداشِ استخرها، دومین روشِ درآمدزایی در پروژه است.
بیست درصد از کلِ ورودیهای پروژه به چهار استخرِ مجزا تقسیم میشود و در پایانِ هر ماه بین افرادی که شرایطِ لازم را داشته باشند توزیع خواهد شد.

استخرِ اوّل، هشت درصد:

هشت درصد از کلِ ورودیهای پروژه وارد این استخر میشود و بین افرادی تقسیم خواهد شد که حداقل یک کانالِ فعال با حجمِ سه هزار دلار داشته باشند.

برای مثال، اگر موجودیِ این استخر در پایانِ ماه هزار دلار باشد و تنها چهار نفر واجدِ شرایط باشند، سهمِ هر نفر دویست و پنجاه دلار خواهد بود.
استخرِ دوم، شش درصد:

شش درصد از ورودیهای پروژه وارد این استخر میشود.

برای دریافتِ پاداشِ این استخر، باید دو کانالِ فعال داشته باشید که حجمِ هر کدام حداقل پنج هزار دلار باشد.

برای مثال، اگر علی دو نفر به نامهای حسین و شنتیا را معرفی کرده باشد و هر کدام از این دو تیم به حجمِ پنج هزار دلار برسند، علی شرایطِ دریافتِ پاداشِ استخرِ دوم را خواهد داشت.

استخرِ سوم، چهار درصد:

چهار درصد از ورودیهای پروژه به این استخر اختصاص پیدا میکند و میان افرادی تقسیم میشود که دارای سه کانالِ فعال با حجمِ حداقل ده هزار دلار برای هر کانال باشند.
استخرِ چهارم، دو درصد:

دو درصد از کلِ ورودیِ پروژه به این استخر اختصاص دارد و بین افرادی توزیع میشود که چهار کانالِ فعال با حجمِ حداقل سی هزار دلار برای هر کانال داشته باشند.

نکتهٔ مهم این است که اگر در یک ماه شرایطِ ورود به استخرها را نداشته باشید، حجمِ تیمِ شما و موجودیِ استخرها از بین نمیرود و ذخیره میشود تا در ماههای بعد، همراه با حجمِ جدید محاسبه شود.
بخشِ سوم؛ سودِ استیکینگ.

یکی دیگر از امکاناتِ پروژهٔ «Solana Gold»، استفاده از سودِ استیکینگ است.

تمامِ افرادی که در این پروژه فعالیت میکنند، میتوانند ارزِ «SOL» یا سایر ارزهای موردِ تأییدِ شبکهٔ سولانا را در کیفِ پولِ شخصیِ خود نگهداری کرده و بهصورت ماهیانه بین دو تا چهار درصد سودِ مشارکت یا «Staking» دریافت کنند.

برای دریافتِ این سود، دارایی باید حداقل یک ماهِ کاملِ میلادی داخلِ کیفِ پول باقی بماند.
هر کاربر میتواند تا سقفِ ده برابرِ مبلغی که با آن وارد پروژه شده است، داراییِ خود را برای استیکینگ نگهداری کند.

برای مثال، اگر حسین فعالیتِ خود را با ده دلار آغاز کرده باشد، میتواند تا سقفِ صد دلار را در کیفِ پولِ خود نگهداری کرده و از سودِ استیکینگ بهرهمند شود.

در هر زمان، کاربر میتواند داراییِ خود را برداشت کرده یا آن را به ارزِ دیگری تبدیل کند؛ امّا اگر پیش از پایانِ یک ماهِ کامل این کار انجام شود، سودِ آن دوره به وی تعلق نخواهد گرفت.
سودِ این بخش از محلِ مشارکت در فرآیندِ تأییدِ تراکنشها و کارمزدهای شبکهٔ سولانا تأمین شده و از طریقِ قراردادِ هوشمند به کاربران پرداخت میشود.

در پایان، امیدواریم پروژهٔ «Solana Gold» بتواند فرصتی مناسب برای کسب درآمد دلاری، افزایشِ دانش در حوزهٔ بلاکچین و ایجادِ یک فعالیتِ تیمیِ موفق برای شما و اطرافیانتان فراهم کند.

از اینکه تا پایانِ این معرفی همراهِ ما بودید، صمیمانه سپاسگزاریم.

با ما همراه باشید.`;

export default function App() {
  const [text, setText] = useState(defaultText);
  const [isLoading, setIsLoading] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
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
        body: JSON.stringify({ text })
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
        body: JSON.stringify({ text })
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
    <div className="min-h-screen bg-[#0f172a] text-slate-200 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-full mb-4 border border-indigo-500/20 text-indigo-400">
            <Volume2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-white mb-3">
            Solana Gold Presentation
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Review the presentation script below and listen to the AI presenter.
          </p>
        </motion.div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-1 border-b border-slate-700/50 bg-slate-800/80">
            <div className="flex space-x-2 px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
          </div>
          
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <label htmlFor="script" className="sr-only">Presentation Script</label>
              <textarea
                id="script"
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir="rtl"
                className="w-full h-[500px] bg-slate-900/50 border border-slate-700 rounded-xl p-5 text-slate-300 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans text-lg"
                placeholder="Enter presentation script here..."
              />
            </div>
            
            <div className="md:w-64 flex flex-col gap-4">
              <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Playback Controls</h3>
                
                {error && (
                  <div className="mb-4 text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
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
                    <span>{isLoading ? 'Generating...' : 'Listen to Script'}</span>
                  </button>
                ) : (
                  <button
                    onClick={stopAudio}
                    className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900 mb-3"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>Stop Playback</span>
                  </button>
                )}

                {audioBlob && (
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 mb-3"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Audio</span>
                  </button>
                )}
                
                <hr className="border-slate-700 my-4" />
                
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Text Actions</h3>
                
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
                  <span>{isRewriting ? 'Rewriting...' : 'Make Informal (AI)'}</span>
                </button>

                <div className="mt-6 space-y-4">
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>Presenter</span>
                    <span className="text-slate-300">Iranian Female</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>Tone</span>
                    <span className="text-slate-300">Normal</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>Engine</span>
                    <span className="text-slate-300">Gemini 3.1 Flash</span>
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
