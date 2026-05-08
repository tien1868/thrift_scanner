/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Camera, Layers, Search, X, ExternalLink, Info, Shirt, Cpu, ThumbsUp, ThumbsDown, History, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeImage, TriageItem } from './services/geminiService';

type Mode = 'SINGLE' | 'BIN' | 'RACK';

interface ScanHistoryItem {
  id: string;
  image: string;
  items: TriageItem[];
  timestamp: number;
  feedback?: 'good' | 'bad';
  validationImage?: string;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('BIN');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<TriageItem[]>([]);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TriageItem | null>(null);
  const [showApiInfo, setShowApiInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('thrift_scan_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('thrift_scan_history', JSON.stringify(history));
  }, [history]);

  const fileToData = (file: File): Promise<{ base64: string, mimeType: string, url: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultString = reader.result as string;
        const [meta, base64] = resultString.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        resolve({ base64, mimeType, url: resultString });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const scanId = Date.now().toString();
      setCurrentScanId(scanId);
      setResults([]);
      setSelectedItem(null);
      setRawResponse(null);
      setIsAnalyzing(true);

      try {
        setError(null);
        const { base64, mimeType, url } = await fileToData(file);
        setCapturedImage(url);
        const { data, raw } = await analyzeImage(base64, mode, mimeType);
        
        if (!data || !data.items || !Array.isArray(data.items)) {
          console.error("Malformed AI response:", data);
          throw new Error("The AI returned a malformed response. Please try again.");
        }

        const newResults = data.items;
        if (newResults.length === 0) {
          throw new Error("No items were identified in this scan. Try adjusting the angle or lighting.");
        }

        setResults(newResults);
        setRawResponse(raw);

        // Auto-save to history
        const newHistoryItem: ScanHistoryItem = {
          id: scanId,
          image: url,
          items: newResults,
          timestamp: Date.now(),
        };
        setHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
      } catch (err: any) {
        console.error("Analysis failed", err);
        setError(err.message || "The AI sourcing engine is currently unavailable. Please check your connection.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleValidationPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentScanId) {
      const { url } = await fileToData(file);
      setHistory(prev => prev.map(item => 
        item.id === currentScanId ? { ...item, validationImage: url } : item
      ));
    }
  };

  const setFeedback = (scanId: string, feedback: 'good' | 'bad') => {
    setHistory(prev => prev.map(item => 
      item.id === scanId ? { ...item, feedback } : item
    ));
    // If it's the current scan, we could show a toast or animation
  };

  const clearImage = () => {
    setCapturedImage(null);
    setResults([]);
    setSelectedItem(null);
    setCurrentScanId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerCamera = () => fileInputRef.current?.click();
  const triggerValidation = () => validationInputRef.current?.click();

  const getVerdictStyles = (verdict: TriageItem['verdict']) => {
    switch (verdict) {
      case 'GRAB':
        return { 
          dot: 'bg-[#22c55e] border-white shadow-[0_0_20px_rgba(34,197,94,0.8)]', 
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20', 
          icon: null 
        };
      case 'MAYBE':
        return { 
          dot: 'bg-[#f59e0b] border-white shadow-[0_0_15px_rgba(245,158,11,0.6)]', 
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/20', 
          icon: null 
        };
      case 'PASS':
        return { 
          dot: 'bg-red-500 border-white shadow-[0_0_15px_rgba(239,68,68,0.6)]', 
          badge: 'bg-red-500/20 text-red-400 border-red-500/20', 
          icon: <X size={14} className="text-white stroke-[4px]" /> 
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-slate-100 font-sans flex flex-col items-center">
      {/* Header */}
      <header className="w-full h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Camera size={20} className="text-black" />
          </div>
          <h1 className="text-lg font-black tracking-tight uppercase">
            Bin <span className="text-emerald-400">Scanner</span>
          </h1>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`p-2 rounded-xl transition-colors ${showHistory ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-400'}`}
        >
          <History size={20} />
        </button>
      </header>

      <main className="w-full max-w-md px-4 flex flex-col items-center">
        {showHistory ? (
          <div className="w-full mt-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">Recent Scans</h2>
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                No scans yet. Go grab some heat!
              </div>
            ) : (
              history.map((scan) => (
                <div key={scan.id} className="p-3 bg-white/5 rounded-2xl border border-white/10 flex gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-black flex-shrink-0">
                    <img src={scan.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 py-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">{new Date(scan.timestamp).toLocaleTimeString()}</span>
                      {scan.feedback && (
                        <span className={scan.feedback === 'good' ? 'text-emerald-400' : 'text-red-400'}>
                          {scan.feedback === 'good' ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-200 mt-1">
                      {scan.items[0]?.likely_brand || 'Unidentified'}
                    </p>
                    <div className="mt-2 flex gap-1">
                      {scan.items.slice(0, 3).map((item, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${
                          item.verdict === 'GRAB' ? 'bg-emerald-500' : 
                          item.verdict === 'MAYBE' ? 'bg-amber-500' : 'bg-slate-500'
                        }`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
            <button 
              onClick={() => setShowHistory(false)}
              className="w-full py-4 text-emerald-400 font-bold"
            >
              Back to Scanner
            </button>
          </div>
        ) : (
          <>
            {/* Toggle Component */}
            <div className="mt-6 w-full flex gap-2">
              <div className="flex-1 flex p-1 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                <button
                  onClick={() => { setMode('SINGLE'); clearImage(); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-[12px] font-black uppercase transition-all ${
                    mode === 'SINGLE' ? 'bg-emerald-500 text-black shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => { setMode('BIN'); clearImage(); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-[12px] font-black uppercase transition-all ${
                    mode === 'BIN' ? 'bg-emerald-500 text-black shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Bin
                </button>
                <button
                  onClick={() => { setMode('RACK'); clearImage(); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-[12px] font-black uppercase transition-all ${
                    mode === 'RACK' ? 'bg-emerald-500 text-black shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Rack
                </button>
              </div>
              <button
                onClick={() => setShowApiInfo(true)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors text-emerald-400"
              >
                <Cpu size={24} />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center flex flex-col gap-2">
                <p className="font-bold">ENGINE ERROR</p>
                <p className="opacity-80">{error}</p>
                <button onClick={() => setError(null)} className="text-[10px] underline font-black uppercase mt-1">Dismiss</button>
              </div>
            )}

            {/* Action Area */}
            <div className="flex-1 w-full flex flex-col items-center justify-center py-8">
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={validationInputRef} onChange={handleValidationPhoto} />

              {!capturedImage ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
                  <button
                    onClick={triggerCamera}
                    className="group relative w-36 h-36 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
                  >
                    <div className="absolute inset-2 border-2 border-dashed border-white/30 rounded-full animate-spin-slow" />
                    <Camera size={44} className="text-black" />
                  </button>
                  <p className="mt-8 text-slate-400 text-center font-medium">Ready to scan {mode.toLowerCase()}</p>
                </motion.div>
              ) : (
                <div className="w-full space-y-6">
                  <div className="relative rounded-[32px] border border-white/10 shadow-2xl bg-black aspect-[4/5] w-full">
                    <img src={capturedImage} className="w-full h-full object-cover rounded-[32px]" referrerPolicy="no-referrer" />
                    
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-30">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-emerald-400 font-black uppercase tracking-widest text-sm">Processing Scan...</p>
                      </div>
                    )}

                    {!isAnalyzing && results.map((item, idx) => {
                      const styles = getVerdictStyles(item.verdict);
                      return (
                        <motion.button
                          key={idx}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                          onClick={() => setSelectedItem(item)}
                          style={{ 
                            left: `${item.marker_point.x * 100}%`, 
                            top: `${item.marker_point.y * 100}%`, 
                            transform: 'translate(-50%, -50%)' 
                          }}
                          className={`absolute z-30 p-1 rounded-full border-2 shadow-2xl flex items-center justify-center transition-all hover:scale-125 active:scale-150 group pointer-events-auto ${styles.dot}`}
                        >
                          {/* Price Tag Overlay - High contrast and visibility */}
                          <div className={`absolute ${item.marker_point.y < 0.15 ? 'top-12' : '-top-12'} left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none drop-shadow-2xl z-40`}>
                             <div className="bg-[#0c0c0e]/95 backdrop-blur-2xl px-3 py-1.5 rounded-xl border border-white/40 whitespace-nowrap group-hover:scale-110 transition-transform shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                                <span className="text-[12px] font-black tracking-tighter text-emerald-400">
                                  {item.estimated_price_range && item.estimated_price_range !== '$--' ? item.estimated_price_range : 'Value Spec'}
                                </span>
                             </div>
                             {/* Connector point */}
                             <div className={`w-2 h-2 bg-white/40 rotate-45 ${item.marker_point.y < 0.15 ? '-mt-1' : '-mb-1'}`} />
                          </div>

                          <div className="w-6 h-6 flex items-center justify-center">
                            {item.verdict === 'PASS' ? (
                              <X size={20} className="text-white stroke-[4px]" strokeWidth={4} />
                            ) : item.verdict === 'GRAB' ? (
                              <Star size={16} className="text-white fill-current" />
                            ) : (
                              <Shirt size={16} className="text-white" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {!isAnalyzing && results.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setFeedback(currentScanId!, 'good')}
                        className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase text-xs"
                      >
                        <ThumbsUp size={16} /> Good Pick
                      </button>
                      <button 
                        onClick={() => setFeedback(currentScanId!, 'bad')}
                        className="flex items-center justify-center gap-2 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-xs"
                      >
                        <ThumbsDown size={16} /> Bad Pick
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={triggerCamera} 
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-xs text-slate-400"
                    >
                      <Camera size={16} /> Scan Next
                    </button>
                    <button 
                      onClick={triggerValidation} 
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl font-black uppercase text-xs text-cyan-400"
                    >
                      <Search size={16} /> Close-up
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {rawResponse && (
          <div className="mt-8 w-full border border-white/10 rounded-2xl overflow-hidden bg-black/20">
            <button 
              onClick={() => setShowDebug(!showDebug)} 
              className="w-full px-4 py-3 flex justify-between items-center text-xs font-mono text-slate-500 hover:bg-white/5"
            >
              <span>DEBUG: RAW RESPONSE</span>
              <span>{showDebug ? 'HIDE' : 'SHOW'}</span>
            </button>
            {showDebug && (
              <div className="p-4 bg-black/40 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-60">
                {rawResponse}
              </div>
            )}
          </div>
        )}

        {/* Bottom space */}
        <div className="h-12" />
      </main>

        {/* Wearables API Info Modal */}
        <AnimatePresence>
          {showApiInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-slate-900 rounded-[32px] border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
              >
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl">
                      <Cpu size={24} className="text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Wearables API Guide</h2>
                  </div>
                  <button
                    onClick={() => setShowApiInfo(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto space-y-8">
                  <section>
                    <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                      <ExternalLink size={16} />
                      Connection Details
                    </h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                        <p className="text-xs text-slate-500 uppercase font-black">Endpoint</p>
                        <code className="text-emerald-400 break-all font-mono">
                          POST {window.location.origin}/api/analyze
                        </code>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        To connect Google Glass or Meta Glasses, configure your app to capture low-res frames (640x480 is fine) and POST to this endpoint as a Base64 string.
                      </p>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-emerald-400 font-bold mb-4">Implementation Example (JS)</h3>
                    <pre className="p-6 bg-black/60 rounded-2xl border border-white/5 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto">
{`async function analyzeFrame(base64Image) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Image, // Encoded as Base64
      mode: 'BIN',        // 'SINGLE', 'BIN', or 'RACK'
      mimeType: 'image/jpeg'
    })
  });

  const { items } = await response.json();
  return items; // Returns triaged detections
}`}
                    </pre>
                  </section>

                  <section className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10">
                    <h3 className="text-emerald-400 font-bold mb-2">Edge Computing Tip</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      For Meta Glasses, use the <b>Ray-Ban Meta Llama API</b> to handle the voice-to-scan trigger, and pipe visual data to this Triage API for vintage-specific analysis.
                    </p>
                  </section>
                </div>

                <div className="p-6 border-t border-white/10 bg-white/5 flex justify-center">
                  <button
                    onClick={() => setShowApiInfo(false)}
                    className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all active:scale-95"
                  >
                    Got it, let's build
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#16161a] border-t border-white/10 rounded-t-[32px] z-[101] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Handle */}
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2" />
              
              <div className="p-8 pb-12 overflow-y-auto max-h-[80vh]">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getVerdictStyles(selectedItem.verdict).badge}`}>
                        {selectedItem.verdict}
                      </span>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-black">
                        <Star size={10} className="fill-current" />
                        {selectedItem.resale_score}/10
                      </div>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight mb-1">{selectedItem.likely_brand}</h2>
                    <p className="text-slate-400 font-medium text-sm">{selectedItem.garment_type} • {selectedItem.color_pattern}</p>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="p-2 bg-white/5 rounded-full text-slate-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Est. Resale Price</span>
                    <span className="text-2xl font-black text-emerald-400">{selectedItem.estimated_price_range}</span>
                  </div>

                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-3">AI Intelligence</h3>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      {selectedItem.tag_clues && (
                        <div className="mb-4">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Tag Clues</p>
                          <p className="text-sm text-slate-200">{selectedItem.tag_clues}</p>
                        </div>
                      )}
                      <p className="text-slate-200 text-sm leading-relaxed font-medium mb-3">
                        {selectedItem.verdict_reason}
                      </p>
                      <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                        <Info size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-emerald-300/80 leading-relaxed italic">{selectedItem.action_hint}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


