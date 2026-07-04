import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  createTheme, 
  ThemeProvider, 
  CssBaseline, 
  Container, 
  Box, 
  Typography, 
  Card, 
  Button, 
  IconButton, 
  Chip, 
  Tooltip, 
  Divider, 
  CircularProgress,
  Paper,
  Alert,
  Fade,
  Slider,
  Drawer,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  TextField,
  Autocomplete
} from '@mui/material';
import {
  KeyboardVoice as KeyboardVoiceIcon,
  SettingsVoice as SettingsVoiceIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  CloudDownload as CloudDownloadIcon,
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Speed as SpeedIcon,
  Info as InfoIcon,
  Translate as TranslateIcon,
  GraphicEq as GraphicEqIcon,
  RestartAlt as RestartAltIcon,
  ContentCut as ContentCutIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
import { voices, audioTags } from './voices';

// Interface for sentence tracking
interface TextSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  charCount: number;
  isWhitespace: boolean;
  estimatedDuration: number;
  estimatedStart: number;
  estimatedEnd: number;
}

// Splits text into words and whitespaces for real-time highlighting
function parseWords(text: string, totalDuration: number): TextSegment[] {
  if (!text.trim()) return [];
  
  const matches = text.match(/\S+|\s+/g) || [];
  
  let currentIndex = 0;
  let totalChars = 0;
  
  const parsedSegments = matches.map((segment) => {
    const start = currentIndex;
    const end = start + segment.length;
    currentIndex = end;
    
    const isWhitespace = /^\s+$/.test(segment);
    const charCount = isWhitespace ? 0 : segment.length;
    totalChars += charCount;
    
    return {
      text: segment,
      startIndex: start,
      endIndex: end,
      charCount,
      isWhitespace
    };
  });
  
  if (totalChars === 0) return [];
  
  let accumulatedTime = 0;
  const result: TextSegment[] = parsedSegments.map((seg) => {
    const proportion = seg.charCount / totalChars;
    const estimatedDuration = proportion * totalDuration;
    const estimatedStart = accumulatedTime;
    const estimatedEnd = accumulatedTime + estimatedDuration;
    
    if (seg.charCount > 0) {
      accumulatedTime = estimatedEnd;
    }
    
    return {
      ...seg,
      estimatedDuration: seg.charCount > 0 ? estimatedDuration : 0,
      estimatedStart: seg.charCount > 0 ? estimatedStart : 0,
      estimatedEnd: seg.charCount > 0 ? estimatedEnd : 0,
    };
  });
  
  return result;
}

// Helper to format seconds to time string (m:ss.x)
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
}

// WAV File Creation Helper (Maintains audio download capability)
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

// Beautiful voice waveform reflecting active speaker playback in real-time using d3
function VoiceWaveformD3({ analyser, isPlaying }: { analyser: AnalyserNode | null; isPlaying: boolean }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    if (!isPlaying || !analyser) {
      // Draw static resting bars
      const staticData = [12, 18, 15, 24, 30, 20, 15, 10, 8, 12, 20, 28, 22, 14, 18, 10, 6, 4];
      const width = svgRef.current?.clientWidth || 180;
      const height = svgRef.current?.clientHeight || 24;
      const barWidth = (width / staticData.length) - 1.5;
      
      const bars = svg.selectAll<SVGRectElement, number>('rect')
        .data(staticData);
        
      bars.enter()
        .append('rect')
        .attr('fill', '#f59e0b')
        .attr('rx', 2)
        .attr('ry', 2)
        .merge(bars)
        .transition()
        .duration(300)
        .attr('x', (d, i) => i * (barWidth + 1.5))
        .attr('y', d => height - (d / 40) * height)
        .attr('width', Math.max(1.5, barWidth))
        .attr('height', d => Math.max(2, (d / 40) * height));
        
      bars.exit().remove();
      return;
    }
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationFrameId: number;
    
    const renderFrame = () => {
      animationFrameId = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);
      
      const width = svgRef.current?.clientWidth || 180;
      const height = svgRef.current?.clientHeight || 24;
      const barWidth = (width / bufferLength) - 1.5;
      
      const bars = svg.selectAll<SVGRectElement, number>('rect')
        .data(Array.from(dataArray));
      
      bars.enter()
        .append('rect')
        .attr('fill', '#f59e0b')
        .attr('rx', 2)
        .attr('ry', 2)
        .merge(bars)
        .attr('x', (d, i) => i * (barWidth + 1.5))
        .attr('y', d => height - (d / 255) * height)
        .attr('width', Math.max(1.5, barWidth))
        .attr('height', d => Math.max(2, (d / 255) * height));
        
      bars.exit().remove();
    };
    
    renderFrame();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, isPlaying]);
  
  return (
    <svg 
      ref={svgRef} 
      style={{ width: '180px', height: '24px', display: 'block' }}
    />
  );
}

// Interface for HistoryItem
interface HistoryItem {
  id?: number;
  text: string;
  voice: string;
  isMultiSpeaker?: boolean;
  speakers?: Array<{ speaker: string; voice: string }>;
  pcmData: Int16Array;
  duration: number;
  timestamp: number;
}

const DB_NAME = 'GoldVoiceHistoryDB_v3';
const DB_VERSION = 1;
const STORE_NAME = 'history';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
}

async function saveHistoryItem(item: Omit<HistoryItem, 'id'>): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // First, get all existing items to enforce a limit of 5
    await new Promise<void>((resolve, reject) => {
      const allItemsReq = store.getAll();
      allItemsReq.onsuccess = () => {
        const allItems = allItemsReq.result as HistoryItem[];
        // Sort by timestamp ascending (oldest first)
        allItems.sort((a, b) => a.timestamp - b.timestamp);
        
        // If we already have 5 or more, delete the oldest ones
        if (allItems.length >= 5) {
          const deleteCount = allItems.length - 5 + 1;
          for (let i = 0; i < deleteCount; i++) {
            if (allItems[i].id !== undefined) {
              store.delete(allItems[i].id!);
            }
          }
        }
        
        // Add the new item
        const addReq = store.add(item);
        addReq.onsuccess = () => resolve();
        addReq.onerror = () => reject(addReq.error);
      };
      allItemsReq.onerror = () => reject(allItemsReq.error);
    });
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
  }
}

async function getHistoryItems(): Promise<HistoryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result as HistoryItem[];
        // Sort descending (newest first)
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting history from IndexedDB:', error);
    return [];
  }
}

async function deleteHistoryItem(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error deleting from IndexedDB:', error);
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (secs < 60) return 'لحظاتی پیش';
  if (mins < 60) return `${mins} دقیقه پیش`;
  if (hours < 24) return `${hours} ساعت پیش`;
  return `${days} روز پیش`;
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
  const [voice, setVoice] = useState<string>('Aoede');
  const [isMultiSpeaker, setIsMultiSpeaker] = useState<boolean>(false);
  const [speakers, setSpeakers] = useState<Array<{speaker: string, voice: string}>>([{speaker: 'گوینده ۱', voice: 'Aoede'}, {speaker: 'گوینده ۲', voice: 'Puck'}]);
  
  const [rewriteTone, setRewriteTone] = useState<'informal' | 'formal' | 'promotional' | 'friendly'>('informal');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [copied, setCopied] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const isFirstSave = useRef(true);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const items = await getHistoryItems();
      setHistoryItems(items);
    };
    loadHistory();
  }, []);

  // Trimming & caching states
  const [rawPcmData, setRawPcmData] = useState<Int16Array | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const [generatedText, setGeneratedText] = useState<string>('');

  // Sentence and Audio tracking states
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  // Synchronization refs to avoid closure stale values in high-speed requestAnimationFrame loop
  const isPlayingRef = useRef(false);
  const segmentsRef = useRef<TextSegment[]>([]);
  const playbackSpeedRef = useRef(1.0);
  const activeWordIndexRef = useRef<number | null>(null);
  const playOffsetRef = useRef(0);
  const playbackStartTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const handleTrimChange = (event: Event | React.SyntheticEvent | any, newValue: number | number[]) => {
    setTrimRange(newValue as [number, number]);
    if (isPlaying) {
      stopAudio();
    }
  };
  
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }

    setSaveStatus('saving');

    const handler = setTimeout(() => {
      localStorage.setItem('solana-gold-script', text);
      setSaveStatus('saved');
    }, 5000);

    return () => {
      clearTimeout(handler);
    };
  }, [text]);

  // Regenerate segments when text or audio duration changes
  useEffect(() => {
    if (text && audioDuration > 0) {
      const parsed = parseWords(text, audioDuration);
      setSegments(parsed);
    } else {
      setSegments([]);
    }
    setActiveWordIndex(null);
    activeWordIndexRef.current = null;
  }, [text, audioDuration]);

  // Keep references synced
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // Smooth scroll overlay to the active word being spoken
  useEffect(() => {
    if (activeWordIndex !== null && isPlaying) {
      const span = document.getElementById(`word-span-${activeWordIndex}`);
      if (span && overlayRef.current) {
        const container = overlayRef.current;
        const targetScroll = span.offsetTop - container.clientHeight / 2 + span.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    }
  }, [activeWordIndex, isPlaying]);

  // RequestAnimationFrame loop for timing tracking
  const startProgressLoop = (offset: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    playOffsetRef.current = offset;
    playbackStartTimeRef.current = audioContextRef.current ? audioContextRef.current.currentTime : 0;
    
    const tick = () => {
      if (!isPlayingRef.current || !audioContextRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }
      
      const elapsed = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * playbackSpeedRef.current;
      const currentPosition = playOffsetRef.current + elapsed;
      
      const list = segmentsRef.current;
      if (list.length > 0) {
        const activeIndex = list.findIndex(
          s => currentPosition >= s.estimatedStart && currentPosition < s.estimatedEnd
        );
        
        if (activeIndex !== -1 && activeIndex !== activeWordIndexRef.current) {
          activeWordIndexRef.current = activeIndex;
          setActiveWordIndex(activeIndex);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

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

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopVoicePreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      previewSourceRef.current = null;
    }
    setPreviewingVoiceId(null);
  };

  const playVoicePreview = async (voiceId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (previewingVoiceId === voiceId) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();
    stopAudio(); // Stop main audio if playing

    setPreviewingVoiceId(voiceId);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'سلام! این صدای آزمایشی برای من است.',
          voice: voiceId,
          isMultiSpeaker: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }

      const data = await response.json();
      if (!data.audio) {
        throw new Error('No audio in preview response');
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const audioBuffer = audioContextRef.current.createBuffer(1, int16Array.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioContextRef.current.destination);

      sourceNode.onended = () => {
        setPreviewingVoiceId(null);
        previewSourceRef.current = null;
      };

      previewSourceRef.current = sourceNode;
      sourceNode.start(0);
    } catch (err) {
      console.error('Error playing preview:', err);
      setPreviewingVoiceId(null);
    }
  };

  const stopAudio = () => {
    stopVoicePreview();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    activeWordIndexRef.current = null;
    setActiveWordIndex(null);

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
    
    // Support instant local playback if text matches generatedText and we have the PCM data
    if (rawPcmData && text === generatedText) {
      stopAudio();
      setIsPlaying(true);
      setError(null);
      
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        const audioBuffer = audioContextRef.current.createBuffer(1, rawPcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < rawPcmData.length; i++) {
          channelData[i] = rawPcmData[i] / 32768.0;
        }

        const sourceNode = audioContextRef.current.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = playbackSpeed;
        
        // Create and connect AnalyserNode for real-time frequency visualization
        const analyserNode = audioContextRef.current.createAnalyser();
        analyserNode.fftSize = 64;
        setAnalyser(analyserNode);

        sourceNode.connect(analyserNode);
        analyserNode.connect(audioContextRef.current.destination);
        
        sourceNode.onended = () => {
          setIsPlaying(false);
          activeWordIndexRef.current = null;
          setActiveWordIndex(null);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };

        sourceNodeRef.current = sourceNode;
        
        // Respect the selected trim range on play!
        const playOffset = trimRange[0];
        const playDuration = trimRange[1] - trimRange[0];
        sourceNode.start(0, playOffset, playDuration);
        
        // Start tracking time to match spoken segments
        startProgressLoop(playOffset);
      } catch (err: any) {
        console.error(err);
        setError('خطایی در پخش محلی صدا رخ داد.');
        setIsPlaying(false);
      }
      return;
    }
    
    setIsLoading(true);
    setError(null);
    stopAudio();
    setAudioBlob(null);
    setRawPcmData(null);
    setAudioDuration(0);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, isMultiSpeaker, speakers })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'خطا در برقراری ارتباط با سرویس تولید صدا. مجدداً بررسی کنید.');
      }

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
      setRawPcmData(int16Array);
      setGeneratedText(text);
      
      const duration = int16Array.length / 24000;
      setAudioDuration(duration);
      setTrimRange([0, duration]);
      
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
      
      // Create and connect AnalyserNode for real-time frequency visualization
      const analyserNode = audioContextRef.current.createAnalyser();
      analyserNode.fftSize = 64;
      setAnalyser(analyserNode);

      sourceNode.connect(analyserNode);
      analyserNode.connect(audioContextRef.current.destination);
      
      sourceNode.onended = () => {
        setIsPlaying(false);
        activeWordIndexRef.current = null;
        setActiveWordIndex(null);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };

      sourceNodeRef.current = sourceNode;
      
      // Since it's a new generation, play the full audio range
      sourceNode.start(0, 0, duration);
      setIsPlaying(true);
      
      // Start tracking time to match spoken segments
      startProgressLoop(0);

      // Save to IndexedDB history
      try {
        await saveHistoryItem({
          text,
          voice,
          isMultiSpeaker,
          speakers,
          pcmData: int16Array,
          duration,
          timestamp: Date.now()
        });
        const items = await getHistoryItems();
        setHistoryItems(items);
      } catch (dbErr) {
        console.error('Failed to save to history database:', dbErr);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'خطایی در تولید یا پخش صدا رخ داد.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!rawPcmData) {
      if (!audioBlob) return;
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gold_voice_audio.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Slice raw PCM data based on selected trimRange
    const startSample = Math.floor(trimRange[0] * 24000);
    const endSample = Math.floor(trimRange[1] * 24000);
    const trimmedPcm = rawPcmData.slice(startSample, endSample);
    
    const trimmedWavBlob = createWAV(trimmedPcm, 24000);
    const url = URL.createObjectURL(trimmedWavBlob);
    const a = document.createElement('a');
    a.href = url;
    
    // Format descriptive file name with trimmed start and end
    const startStr = trimRange[0].toFixed(1).replace('.', '_');
    const endStr = trimRange[1].toFixed(1).replace('.', '_');
    a.download = `gold_voice_trimmed_${startStr}s_to_${endStr}s.wav`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetDefault = () => {
    setText(defaultText);
  };

  const handleLoadHistoryItem = (item: HistoryItem, autoPlay = false) => {
    stopAudio();
    setError(null);
    setText(item.text);
    setVoice(item.voice);
    setIsMultiSpeaker(item.isMultiSpeaker || false);
    if (item.speakers) {
      setSpeakers(item.speakers);
    }
    setRawPcmData(item.pcmData);
    setGeneratedText(item.text);
    setAudioDuration(item.duration);
    setTrimRange([0, item.duration]);
    
    try {
      const wavBlob = createWAV(item.pcmData, 24000);
      setAudioBlob(wavBlob);
    } catch (e) {
      console.error('Error creating wav blob from loaded history:', e);
    }

    if (autoPlay) {
      setIsPlaying(true);
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        const audioBuffer = audioContextRef.current.createBuffer(1, item.pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < item.pcmData.length; i++) {
          channelData[i] = item.pcmData[i] / 32768.0;
        }

        const sourceNode = audioContextRef.current.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = playbackSpeed;
        
        const analyserNode = audioContextRef.current.createAnalyser();
        analyserNode.fftSize = 64;
        setAnalyser(analyserNode);

        sourceNode.connect(analyserNode);
        analyserNode.connect(audioContextRef.current.destination);
        
        sourceNode.onended = () => {
          setIsPlaying(false);
          activeWordIndexRef.current = null;
          setActiveWordIndex(null);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };

        sourceNodeRef.current = sourceNode;
        sourceNode.start(0, 0, item.duration);
        
        const parsed = parseWords(item.text, item.duration);
        setSegments(parsed);
        segmentsRef.current = parsed;
        startProgressLoop(0);
      } catch (err: any) {
        console.error(err);
        setError('خطایی در پخش فایل تاریخچه رخ داد.');
        setIsPlaying(false);
      }
    }
  };

  const handleDeleteHistoryItem = async (id: number) => {
    try {
      await deleteHistoryItem(id);
      const items = await getHistoryItems();
      setHistoryItems(items);
    } catch (e) {
      console.error('Error deleting history item:', e);
    }
  };

  // Helper values for text statistics
  const wordCount = useMemo(() => text.trim() === '' ? 0 : text.trim().split(/\s+/).length, [text]);
  const charCount = text.length;
  const estimatedReadTime = Math.ceil(wordCount / 130); // ~130 Persian words per minute

  // Tone choices styled as material filter chips
  const toneOptions = [
    { value: 'informal', label: 'عامیانه' },
    { value: 'formal', label: 'رسمی' },
    { value: 'promotional', label: 'تبلیغاتی' },
    { value: 'friendly', label: 'دوستانه' }
  ] as const;

  // Custom MUI Theme Engine following Material 3 / Modern design guidelines
  const muiTheme = useMemo(() => {
    return createTheme({
      direction: 'rtl',
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: {
          main: '#f59e0b', // Amber / Gold
          light: '#fbbf24',
          dark: '#d97706',
          contrastText: isDarkMode ? '#0c0a09' : '#ffffff',
        },
        background: {
          default: isDarkMode ? '#09090b' : '#f8fafc',
          paper: isDarkMode ? '#18181b' : '#ffffff',
        },
        text: {
          primary: isDarkMode ? '#f4f4f5' : '#0f172a',
          secondary: isDarkMode ? '#a1a1aa' : '#475569',
        },
        divider: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      },
      typography: {
        fontFamily: 'Vazirmatn, sans-serif',
        allVariants: {
          letterSpacing: '-0.01em',
        },
        h5: {
          fontWeight: 800,
        },
        h6: {
          fontWeight: 700,
        },
        body1: {
          lineHeight: 1.75,
        },
        button: {
          fontWeight: 700,
          borderRadius: 24,
        }
      },
      shape: {
        borderRadius: 20,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: '9999px',
              padding: '10px 24px',
              boxShadow: 'none',
              textTransform: 'none',
              '&:hover': {
                boxShadow: 'none',
              },
            },
            contained: {
              backgroundColor: '#f59e0b',
              color: isDarkMode ? '#0c0a09' : '#ffffff',
              '&:hover': {
                backgroundColor: '#d97706',
              }
            },
            outlined: {
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
              color: isDarkMode ? '#f4f4f5' : '#0f172a',
              '&:hover': {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: '#f59e0b',
              }
            }
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 24,
              backgroundImage: 'none',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.05)',
              boxShadow: isDarkMode ? '0 4px 30px rgba(0, 0, 0, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.03)',
            }
          }
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.8rem',
            }
          }
        }
      }
    });
  }, [isDarkMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box 
        sx={{ 
          minHeight: '100vh', 
          pb: { xs: 16, sm: 8 }, 
          transition: 'background-color 0.3s ease',
          direction: 'rtl' 
        }}
      >
        {/* Modern Material App Bar Header */}
        <Paper
          elevation={0}
          square
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1100,
            backdropFilter: 'blur(12px)',
            backgroundColor: isDarkMode ? 'rgba(9, 9, 11, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            borderBottom: 1,
            borderColor: 'divider',
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}
        >
          <Container maxWidth="lg" sx={{ py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
              {/* Material Voice Icon (SettingsVoice / KeyboardVoice) inside a stylized golden container */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: 44, 
                  height: 44, 
                  borderRadius: '16px',
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7',
                  color: isDarkMode ? '#f59e0b' : '#b45309',
                  border: isDarkMode ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(245, 158, 11, 0.1)',
                  transition: 'all 0.3s'
                }}
              >
                <KeyboardVoiceIcon sx={{ fontSize: '1.6rem' }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" component="h1" sx={{ fontSize: '1.15rem', fontWeight: 900, color: 'text.primary' }}>
                    گلد ویس
                  </Typography>
                  <Chip 
                    label="هوشمند" 
                    size="small" 
                    sx={{ 
                      height: 18, 
                      fontSize: '0.65rem', 
                      fontWeight: 800,
                      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', 
                      color: isDarkMode ? '#fbbf24' : '#b45309',
                      borderRadius: '6px'
                    }} 
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
                  دستیار تبدیل متن به صوت با شبیه‌ساز واقعی صدای طبیعی
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="تاریخچه تولیدات صوتی">
                <IconButton 
                  onClick={() => setHistoryOpen(true)} 
                  color="inherit"
                  sx={{ 
                    border: 1, 
                    borderColor: 'divider', 
                    p: 1.2, 
                    borderRadius: '9999px',
                    color: '#f59e0b',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    }
                  }}
                >
                  <HistoryIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>
              </Tooltip>

              <Tooltip title={isDarkMode ? 'پوسته روشن' : 'پوسته تاریک'}>
                <IconButton 
                  onClick={() => setIsDarkMode(!isDarkMode)} 
                  color="inherit"
                  sx={{ 
                    border: 1, 
                    borderColor: 'divider', 
                    p: 1.2, 
                    borderRadius: '9999px',
                    color: isDarkMode ? '#fbbf24' : '#475569',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    }
                  }}
                >
                  {isDarkMode ? <LightModeIcon sx={{ fontSize: '1.2rem' }} /> : <DarkModeIcon sx={{ fontSize: '1.2rem' }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Container>
        </Paper>

        <Container maxWidth="lg" sx={{ mt: { xs: 3, sm: 4 } }}>
          {/* Top Banner and Waveform State Display */}
          <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
            <Box>
              <Box 
                sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 1, 
                  px: 2, 
                  py: 0.6, 
                  borderRadius: '9999px', 
                  mb: 1.5, 
                  border: 1, 
                  borderColor: 'divider',
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.03)' : 'rgba(245, 158, 11, 0.05)'
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: '0.9rem', color: '#f59e0b' }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                  موتور قدرتمند هوش مصنوعی گوینده فارسی
                </Typography>
              </Box>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 900, color: 'text.primary' }}>
                تبدیل متن به صدای روان و دکلمه‌وار
              </Typography>
            </Box>

            {/* Active Waveform Panel with Real-Time Frequency Bars */}
            <Fade in={isPlaying || !!analyser}>
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 3,
                  py: 1.2,
                  borderRadius: '9999px',
                  border: '1px solid',
                  borderColor: isPlaying ? 'primary.main' : 'divider',
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ position: 'relative', display: 'flex', height: 8, width: 8 }}>
                    {isPlaying && (
                      <Box className="animate-ping" sx={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: 'primary.light', opacity: 0.75 }} />
                    )}
                    <Box sx={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: 8, width: 8, backgroundColor: isPlaying ? 'primary.main' : 'text.disabled' }} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary' }}>
                    {isPlaying ? 'درحال پخش صدا...' : 'آماده پخش'}
                  </Typography>
                </Box>
                <VoiceWaveformD3 analyser={analyser} isPlaying={isPlaying} />
              </Paper>
            </Fade>
          </Box>

          {/* Global Alert Notification */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ marginBottom: '24px' }}
              >
                <Alert 
                  severity="error" 
                  onClose={() => setError(null)}
                  sx={{ 
                    borderRadius: 4, 
                    fontSize: '0.85rem', 
                    fontWeight: 600,
                    boxShadow: 'none',
                    direction: 'rtl'
                  }}
                >
                  {error}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Layout Grid */}
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' }, 
              gap: 3, 
              alignItems: 'start' 
            }}
          >
            
            {/* Left Side: Text Editor Input Card */}
            <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 8' } }}>
              <Card>
                {/* Header Actions for Text Editor */}
                <Box 
                  sx={{ 
                    px: 3, 
                    py: 2, 
                    borderBottom: '1px solid', 
                    borderColor: 'divider', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GraphicEqIcon sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                      ویرایشگر متن خوانشگر
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {text !== defaultText && (
                      <Tooltip title="بازنشانی متن نمونه">
                        <IconButton 
                          onClick={handleResetDefault}
                          size="small"
                          sx={{ 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: '9999px',
                            p: 0.8,
                            color: 'text.secondary'
                          }}
                        >
                          <RestartAltIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Button
                      onClick={handleCopyText}
                      disabled={!text}
                      variant="outlined"
                      size="small"
                      startIcon={copied ? <CheckIcon sx={{ fontSize: '0.9rem' }} /> : <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />}
                      sx={{ 
                        py: 0.6, 
                        px: 2, 
                        fontSize: '0.75rem', 
                        fontWeight: 700,
                        backgroundColor: copied ? (isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5') : 'transparent',
                        borderColor: copied ? 'emerald.500' : 'divider',
                        color: copied ? '#10b981' : 'text.primary',
                        '&:hover': {
                          borderColor: '#f59e0b'
                        }
                      }}
                    >
                      {copied ? 'کپی شد!' : 'کپی متن'}
                    </Button>
                  </Box>
                </Box>

                {/* Main Textarea Area */}
                <Box sx={{ px: 3, pt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {audioTags.map(tag => (
                    <Chip 
                      key={tag.tag}
                      label={tag.label}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (textareaRef.current) {
                          const start = textareaRef.current.selectionStart;
                          const end = textareaRef.current.selectionEnd;
                          const newText = text.substring(0, start) + tag.tag + text.substring(end);
                          setText(newText);
                          setTimeout(() => {
                            textareaRef.current?.focus();
                            textareaRef.current?.setSelectionRange(start + tag.tag.length, start + tag.tag.length);
                          }, 10);
                        } else {
                          setText(text + " " + tag.tag);
                        }
                      }}
                      sx={{ fontSize: '0.7rem', cursor: 'pointer', '&:hover': { backgroundColor: 'primary.main', color: 'white' } }}
                    />
                  ))}
                  <Tooltip title="نکاتی درباره ساختاربندی متن (استفاده از تگ‌ها و دیالوگ‌ها). کلیک کنید تا راهنمای کامل را ببینید.">
                    <Chip 
                      label="راهنمای ساختار متن"
                      size="small"
                      color="primary"
                      onClick={() => window.open('https://ai.google.dev/gemini-api/docs/speech-generation#prompt-structure', '_blank')}
                      sx={{ fontSize: '0.7rem', cursor: 'pointer', fontWeight: 800 }}
                    />
                  </Tooltip>
                </Box>
                <Box sx={{ p: 3, position: 'relative', minHeight: '360px' }}>
                  {!isPlaying ? (
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      dir="rtl"
                      placeholder="متن خود را اینجا بنویسید یا بچسبانید تا با صدای گوینده طبیعی شبیه‌سازی شود..."
                      style={{
                        width: '100%',
                        minHeight: '360px',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'Vazirmatn, sans-serif',
                        fontSize: '1rem',
                        lineHeight: 1.8,
                        backgroundColor: 'transparent',
                        color: isDarkMode ? '#f4f4f5' : '#0f172a',
                      }}
                    />
                  ) : (
                    <Box
                      ref={overlayRef}
                      sx={{
                        width: '100%',
                        height: '360px',
                        fontFamily: 'Vazirmatn, sans-serif',
                        fontSize: '1rem',
                        lineHeight: 1.8,
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                        whiteSpace: 'pre-wrap',
                        overflowY: 'auto'
                      }}
                    >
                      {segments.map((seg, idx) => (
                        <span
                          key={idx}
                          id={`word-span-${idx}`}
                          style={{
                            color: !seg.isWhitespace && activeWordIndex === idx 
                              ? (isDarkMode ? '#0c0a09' : '#ffffff') 
                              : (isDarkMode ? '#f4f4f5' : '#0f172a'),
                            backgroundColor: !seg.isWhitespace && activeWordIndex === idx 
                              ? '#f59e0b' 
                              : 'transparent',
                            borderRadius: '4px',
                            transition: 'all 0.1s ease',
                            display: 'inline'
                          }}
                        >
                          {seg.text}
                        </span>
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Footer Statistics */}
                <Box 
                  sx={{ 
                    px: 3, 
                    py: 2, 
                    borderTop: '1px solid', 
                    borderColor: 'divider', 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 3, 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      تعداد کاراکتر: <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{charCount}</Box>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      تعداد کلمات: <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{wordCount}</Box>
                    </Typography>
                    {saveStatus !== 'idle' && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: saveStatus === 'saving' ? '#f59e0b' : '#10b981', 
                          fontWeight: 700, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.6,
                          animation: saveStatus === 'saving' ? 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: .5 }
                          }
                        }}
                      >
                        <Box 
                          component="span" 
                          sx={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            backgroundColor: saveStatus === 'saving' ? '#f59e0b' : '#10b981',
                            display: 'inline-block'
                          }} 
                        />
                        {saveStatus === 'saving' ? 'در حال ذخیره‌سازی خودکار...' : 'پیش‌نویس ذخیره شد'}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <InfoIcon sx={{ fontSize: '0.95rem', color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      زمان حدودی خواندن: <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{estimatedReadTime} دقیقه</Box>
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Right Side: Options and Tuning Card */}
            <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Card sx={{ p: 3 }}>
                  
                  {/* Presets Section */}
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AutoAwesomeIcon sx={{ fontSize: '1.2rem', color: '#f59e0b' }} />
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        حالت‌های آماده
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label="دکلمه" 
                        onClick={() => {
                          setIsMultiSpeaker(false);
                          setVoice('Charon');
                          setPlaybackSpeed(0.8);
                          setRewriteTone('formal');
                        }} 
                        variant="outlined" 
                        sx={{ fontWeight: 700 }} 
                      />
                      <Chip 
                        label="اخبار" 
                        onClick={() => {
                          setIsMultiSpeaker(false);
                          setVoice('Orus');
                          setPlaybackSpeed(1.1);
                          setRewriteTone('formal');
                        }} 
                        variant="outlined" 
                        sx={{ fontWeight: 700 }} 
                      />
                      <Chip 
                        label="دوستانه" 
                        onClick={() => {
                          setIsMultiSpeaker(false);
                          setVoice('Aoede');
                          setPlaybackSpeed(1.0);
                          setRewriteTone('friendly');
                        }} 
                        variant="outlined" 
                        sx={{ fontWeight: 700 }} 
                      />
                    </Box>
                  </Box>
                  
                  <Divider sx={{ mb: 3 }} />

                  {/* Speaker (Voice) Selector Section */}
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsVoiceIcon sx={{ fontSize: '1.2rem', color: '#f59e0b' }} />
                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                          انتخاب صدای گوینده
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={<Switch size="small" checked={isMultiSpeaker} onChange={(e) => setIsMultiSpeaker(e.target.checked)} color="primary" />}
                        label={<Typography variant="caption" sx={{ fontWeight: 700 }}>چند گوینده</Typography>}
                      />
                    </Box>

                    {isMultiSpeaker ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: -1 }}>
                          در متن خود از فرمت <b>"نام گوینده: متن"</b> استفاده کنید (مثلا: <b>گوینده ۱: سلام</b>).
                        </Typography>
                        {speakers.map((spk, idx) => (
                          <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              size="small"
                              variant="outlined"
                              value={spk.speaker}
                              onChange={(e) => {
                                const newSpk = [...speakers];
                                newSpk[idx].speaker = e.target.value;
                                setSpeakers(newSpk);
                              }}
                              sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px' } }}
                            />
                            <FormControl size="small" sx={{ flex: 2 }}>
                              <Select
                                value={spk.voice}
                                onChange={(e) => {
                                  const newSpk = [...speakers];
                                  newSpk[idx].voice = e.target.value as string;
                                  setSpeakers(newSpk);
                                }}
                                sx={{ fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px' }}
                              >
                                {voices.map(v => (
                                  <MenuItem 
                                    key={v.id} 
                                    value={v.id} 
                                    sx={{ 
                                      fontSize: '0.8rem',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      width: '100%',
                                      gap: 1
                                    }}
                                  >
                                    <span>{v.name}</span>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => playVoicePreview(v.id, e)}
                                      sx={{
                                        p: 0.2,
                                        color: previewingVoiceId === v.id ? 'error.main' : 'primary.main',
                                        backgroundColor: previewingVoiceId === v.id ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        '&:hover': {
                                          backgroundColor: previewingVoiceId === v.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                        }
                                      }}
                                    >
                                      {previewingVoiceId === v.id ? <StopIcon sx={{ fontSize: '1rem' }} /> : <PlayArrowIcon sx={{ fontSize: '1rem' }} />}
                                    </IconButton>
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <IconButton 
                              size="small" 
                              onClick={() => setSpeakers(speakers.filter((_, i) => i !== idx))}
                              disabled={speakers.length <= 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                        <Button 
                          variant="outlined" 
                          size="small" 
                          onClick={() => setSpeakers([...speakers, { speaker: `گوینده ${speakers.length + 1}`, voice: 'Aoede' }])}
                          sx={{ borderRadius: '8px', py: 0.5, fontWeight: 700, fontSize: '0.75rem' }}
                        >
                          + افزودن گوینده
                        </Button>
                      </Box>
                    ) : (
                      <FormControl fullWidth size="small">
                        <Select
                          value={voice}
                          onChange={(e) => setVoice(e.target.value as string)}
                          sx={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                          }}
                        >
                          {voices.map(v => (
                            <MenuItem 
                              key={v.id} 
                              value={v.id} 
                              sx={{ 
                                fontSize: '0.85rem', 
                                fontWeight: 600, 
                                py: 0.5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                gap: 1
                              }}
                            >
                              <span>{v.name}</span>
                              <IconButton
                                size="small"
                                onClick={(e) => playVoicePreview(v.id, e)}
                                sx={{
                                  p: 0.3,
                                  color: previewingVoiceId === v.id ? 'error.main' : 'primary.main',
                                  backgroundColor: previewingVoiceId === v.id ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                  '&:hover': {
                                    backgroundColor: previewingVoiceId === v.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                  }
                                }}
                              >
                                {previewingVoiceId === v.id ? <StopIcon sx={{ fontSize: '1.1rem' }} /> : <PlayArrowIcon sx={{ fontSize: '1.1rem' }} />}
                              </IconButton>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Box>

                  {/* Playback Speed Setting Section */}
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <SpeedIcon sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        تنظیم سرعت خواندن متن
                      </Typography>
                    </Box>

                    {/* Styled Pill Segmented Switcher for Playback Speed */}
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        p: 0.6, 
                        borderRadius: '9999px', 
                        border: '1px solid', 
                        borderColor: 'divider',
                        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      {[0.8, 1.0, 1.2].map((speed) => (
                        <Button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          variant={playbackSpeed === speed ? 'contained' : 'text'}
                          fullWidth
                          sx={{
                            py: 1,
                            fontSize: '0.78rem',
                            borderRadius: '9999px',
                            color: playbackSpeed === speed ? (isDarkMode ? '#0c0a09' : '#ffffff') : 'text.secondary',
                            backgroundColor: playbackSpeed === speed ? 'text.primary' : 'transparent',
                            '&:hover': {
                              backgroundColor: playbackSpeed === speed ? 'text.secondary' : 'rgba(255, 255, 255, 0.05)',
                            },
                            fontWeight: 800
                          }}
                        >
                          {speed === 0.8 ? '۰.۸x' : speed === 1.0 ? '۱.۰x' : '۱.۲x'}
                        </Button>
                      ))}
                    </Box>
                  </Box>

                  {/* Audio Trimming Section */}
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <ContentCutIcon sx={{ fontSize: '1.25rem', color: '#f59e0b' }} />
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        برش و زمان‌بندی فایل صوتی
                      </Typography>
                    </Box>

                    {!rawPcmData ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          borderRadius: 3,
                          borderColor: 'divider',
                          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)',
                          borderStyle: 'dashed'
                        }}
                      >
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          تنظیمات برش پس از تولید فایل صوتی فعال می‌شود.
                        </Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ px: 1 }}>
                        <Slider
                          value={trimRange}
                          onChange={handleTrimChange}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(val) => `${val.toFixed(1)}s`}
                          min={0}
                          max={audioDuration}
                          step={0.1}
                          disableSwap
                          sx={{
                            color: '#f59e0b',
                            height: 6,
                            '& .MuiSlider-thumb': {
                              width: 16,
                              height: 16,
                              backgroundColor: '#fff',
                              border: '3px solid currentColor',
                              '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                                boxShadow: 'inherit',
                              },
                              '&:before': {
                                display: 'none',
                              },
                            },
                            '& .MuiSlider-valueLabel': {
                              lineHeight: 1.2,
                              fontSize: 12,
                              background: 'unset',
                              padding: 0,
                              width: 32,
                              height: 32,
                              borderRadius: '50% 50% 50% 0',
                              backgroundColor: '#f59e0b',
                              transformOrigin: 'bottom left',
                              transform: 'translate(50%, -100%) rotate(-45deg) scale(0)',
                              '&:before': { display: 'none' },
                              '&.MuiSlider-valueLabelOpen': {
                                transform: 'translate(50%, -100%) rotate(-45deg) scale(1)',
                              },
                              '& > *': {
                                transform: 'rotate(45deg)',
                              },
                            },
                            '& .MuiSlider-track': {
                              border: 'none',
                            },
                            '& .MuiSlider-rail': {
                              opacity: 0.28,
                              backgroundColor: isDarkMode ? '#bfdbfe' : '#94a3b8',
                            },
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, px: 0.5 }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                              شروع
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'monospace' }}>
                              {formatTime(trimRange[0])}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                              مدت کل برش
                            </Typography>
                            <Chip
                              label={`${(trimRange[1] - trimRange[0]).toFixed(1)} ثانیه`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                                color: isDarkMode ? '#fbbf24' : '#b45309',
                                mt: 0.2
                              }}
                            />
                          </Box>
                          <Box sx={{ textAlign: 'left' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                              پایان
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'monospace' }}>
                              {formatTime(trimRange[1])}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ my: 3 }} />

                  {/* AI Rewrite & Tone Modification Section */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TranslateIcon sx={{ fontSize: '1.15rem', color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        بازنویسی و اصلاح لحن با هوش مصنوعی
                      </Typography>
                    </Box>

                    {/* Choice Chips list */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                      {toneOptions.map((tone) => {
                        const isSelected = rewriteTone === tone.value;
                        return (
                          <Chip
                            key={tone.value}
                            label={tone.label}
                            onClick={() => setRewriteTone(tone.value)}
                            color={isSelected ? 'primary' : 'default'}
                            variant={isSelected ? 'filled' : 'outlined'}
                            sx={{
                              py: 1.8,
                              px: 0.6,
                              borderRadius: '9999px',
                              cursor: 'pointer',
                              fontWeight: isSelected ? 800 : 500,
                              borderColor: isSelected ? 'transparent' : 'divider',
                              backgroundColor: isSelected 
                                ? '#f59e0b' 
                                : isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                              color: isSelected 
                                ? (isDarkMode ? '#0c0a09' : '#ffffff') 
                                : 'text.primary',
                              '&:hover': {
                                backgroundColor: isSelected ? '#d97706' : 'rgba(255, 255, 255, 0.08)'
                              }
                            }}
                          />
                        );
                      })}
                    </Box>

                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={handleRewrite}
                      disabled={isRewriting || isLoading || !text.trim()}
                      startIcon={isRewriting ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon sx={{ color: '#f59e0b' }} />}
                      sx={{
                        py: 1.5,
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.03)' : 'rgba(245, 158, 11, 0.02)'
                      }}
                    >
                      {isRewriting ? 'در حال بازنویسی متن...' : 'بازنویسی با هوش مصنوعی'}
                    </Button>
                  </Box>

                  {/* Desktop Playback Actions */}
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    <Divider sx={{ my: 3 }} />
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {!isPlaying ? (
                        <Button
                          variant={rawPcmData && text === generatedText ? "outlined" : "contained"}
                          color="primary"
                          fullWidth
                          onClick={handleGenerateAndPlay}
                          disabled={isLoading || !text.trim()}
                          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                          sx={{
                            py: 1.8,
                            fontSize: '0.88rem',
                            fontWeight: 900,
                            boxShadow: rawPcmData && text === generatedText ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.3)',
                            ...(rawPcmData && text === generatedText && {
                              borderColor: 'primary.main',
                              color: 'primary.main',
                              '&:hover': {
                                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                                borderColor: 'primary.dark',
                              }
                            })
                          }}
                        >
                          {isLoading 
                            ? 'در حال ساخت فایل صوتی...' 
                            : (rawPcmData && text === generatedText) 
                              ? 'پخش مجدد (بخش برش‌خورده)' 
                              : 'تولید و پخش صدای طبیعی'}
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={stopAudio}
                          startIcon={<StopIcon />}
                          sx={{
                            py: 1.8,
                            fontSize: '0.88rem',
                            fontWeight: 900,
                            backgroundColor: '#e11d48',
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: '#be123c',
                            }
                          }}
                        >
                          توقف پخش صدا
                        </Button>
                      )}

                      {audioBlob && (
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={handleDownload}
                          startIcon={<CloudDownloadIcon />}
                          sx={{
                            py: 1.5,
                            fontSize: '0.8rem',
                            fontWeight: 800
                          }}
                        >
                          {rawPcmData && (trimRange[0] > 0 || trimRange[1] < audioDuration) 
                            ? 'دانلود بخش برش‌خورده (WAV)' 
                            : 'دانلود فایل صوتی کامل (WAV)'}
                        </Button>
                      )}
                    </Box>
                  </Box>

                </Card>

                {/* Model and processing metadata specs */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 5,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    موتور شبیه‌ساز صوتی:
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 800, fontFamily: 'monospace' }} dir="ltr">
                    Gemini 3.1 Flash (TTS)
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Box>
        </Container>

        {/* Floating Sticky Bottom Bar for Mobile Device viewports */}
        <Box 
          sx={{ 
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            p: 2,
            background: isDarkMode 
              ? 'linear-gradient(to top, rgba(9, 9, 11, 0.95) 60%, rgba(9, 9, 11, 0))' 
              : 'linear-gradient(to top, rgba(248, 250, 252, 0.95) 60%, rgba(248, 250, 252, 0))',
            display: { xs: 'block', sm: 'none' },
            pointerEvents: 'none'
          }}
        >
          <Paper
            elevation={8}
            sx={{
              maxWidth: 480,
              mx: 'auto',
              p: 1.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: 'divider',
              backdropFilter: 'blur(16px)',
              backgroundColor: isDarkMode ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              pointerEvents: 'auto'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box 
                sx={{ 
                  width: 38, 
                  height: 38, 
                  borderRadius: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  color: '#f59e0b'
                }}
              >
                {isLoading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : isPlaying ? (
                  <Box sx={{ display: 'flex', height: 6, width: 6, borderRadius: '50%', backgroundColor: 'primary.main', position: 'relative' }}>
                    <Box className="animate-ping" sx={{ position: 'absolute', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: 'primary.light' }} />
                  </Box>
                ) : (
                  <KeyboardVoiceIcon sx={{ fontSize: '1.25rem' }} />
                )}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.78rem', color: 'text.primary' }}>
                  {isLoading ? 'در حال تولید صوتی...' : isPlaying ? 'در حال پخش...' : 'آماده خواندن'}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
                  {isMultiSpeaker ? 'چند گوینده' : voices.find(v => v.id === voice)?.name || voice} • {playbackSpeed}x
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {audioBlob && (
                <IconButton
                  onClick={handleDownload}
                  size="small"
                  sx={{
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    borderRadius: '9999px'
                  }}
                  title="دانلود فایل صوتی"
                >
                  <CloudDownloadIcon sx={{ fontSize: '1.15rem' }} />
                </IconButton>
              )}

              {/* Main Play FAB on mobile */}
              {!isPlaying ? (
                <Button
                  variant="contained"
                  onClick={handleGenerateAndPlay}
                  disabled={isLoading || !text.trim()}
                  startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: '1.1rem' }} />}
                  sx={{
                    py: 0.8,
                    px: 2.2,
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)'
                  }}
                >
                  بشنو
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={stopAudio}
                  startIcon={<StopIcon sx={{ fontSize: '1.1rem' }} />}
                  sx={{
                    py: 0.8,
                    px: 2.2,
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    backgroundColor: '#e11d48',
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#be123c',
                    }
                  }}
                >
                  توقف
                </Button>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Beautiful RTL History Drawer */}
        <Drawer
          anchor="right"
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: { xs: '100%', sm: 400 },
                backgroundColor: isDarkMode ? '#121214' : '#ffffff',
                borderLeft: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
                p: 3,
              }
            }
          } as any}
        >
          {/* Drawer Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }} dir="rtl">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HistoryIcon sx={{ color: 'primary.main', fontSize: '1.6rem' }} />
              <Typography variant="h6" sx={{ fontWeight: 900, fontSize: '1.15rem' }}>
                تاریخچه تولیدات صوتی
              </Typography>
            </Box>
            <Button 
              onClick={() => setHistoryOpen(false)}
              variant="outlined" 
              size="small"
              sx={{ px: 2, py: 0.5, fontSize: '0.75rem', borderRadius: '12px' }}
            >
              بستن
            </Button>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Drawer Body / History List */}
          <Box 
            sx={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 2,
              mb: 2,
              pr: 0.5 
            }}
            dir="rtl"
          >
            {historyItems.length === 0 ? (
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexGrow: 1, 
                  gap: 2,
                  py: 6,
                  px: 3,
                  textAlign: 'center',
                  opacity: 0.8
                }}
              >
                <FolderOpenIcon sx={{ fontSize: '3rem', color: 'text.disabled' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  هنوز هیچ فایل صوتی تولید نکرده‌اید.
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', maxWidth: 260 }}>
                  با نوشتن متن در ادیتور و کلیک بر روی دکمه «بشنو»، صدای تولید شده به‌طور خودکار در تاریخچه ذخیره می‌شود.
                </Typography>
              </Box>
            ) : (
              historyItems.map((item) => (
                <Paper
                  key={item.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.03)' : 'rgba(245, 158, 11, 0.01)',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={item.isMultiSpeaker ? 'چند گوینده' : (voices.find(v => v.id === item.voice)?.name || item.voice)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          backgroundColor: item.isMultiSpeaker 
                            ? 'rgba(16, 185, 129, 0.1)' 
                            : voices.find(v => v.id === item.voice)?.gender === 'female' 
                              ? 'rgba(236, 72, 153, 0.1)' 
                              : 'rgba(59, 130, 246, 0.1)',
                          color: item.isMultiSpeaker 
                            ? '#10b981' 
                            : voices.find(v => v.id === item.voice)?.gender === 'female' 
                              ? '#ec4899' 
                              : '#3b82f6',
                          fontWeight: 800,
                        }}
                      />
                      <Chip
                        label={`${item.duration.toFixed(1)} ثانیه`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          color: 'text.secondary',
                          fontWeight: 700
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                      {formatRelativeTime(item.timestamp)}
                    </Typography>
                  </Box>

                  {/* Script summary preview */}
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.text}
                  </Typography>

                  <Divider sx={{ my: 1.5, opacity: 0.5 }} />

                  {/* Card Actions */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          handleLoadHistoryItem(item, false);
                          setHistoryOpen(false);
                        }}
                        sx={{
                          fontSize: '0.72rem',
                          py: 0.4,
                          px: 1.5,
                          borderRadius: '8px',
                          fontWeight: 800
                        }}
                      >
                        بارگذاری
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          handleLoadHistoryItem(item, true);
                          setHistoryOpen(false);
                        }}
                        startIcon={<PlayArrowIcon sx={{ fontSize: '0.9rem' }} />}
                        sx={{
                          fontSize: '0.72rem',
                          py: 0.4,
                          px: 1.5,
                          borderRadius: '8px',
                          fontWeight: 800
                        }}
                      >
                        پخش مستقیم
                      </Button>
                    </Box>

                    <Tooltip title="حذف از تاریخچه">
                      <IconButton
                        size="small"
                        onClick={() => item.id !== undefined && handleDeleteHistoryItem(item.id)}
                        sx={{
                          color: 'text.disabled',
                          '&:hover': {
                            color: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)'
                          }
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              ))
            )}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Drawer Footer with History size indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} dir="rtl">
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
              ذخیره محلی و فوق‌سریع در مرورگر
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800 }}>
              {historyItems.length} از ۵ مورد اخیر
            </Typography>
          </Box>
        </Drawer>
      </Box>
    </ThemeProvider>
  );
}
