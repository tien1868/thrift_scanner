/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent } from 'react';
import { Camera, Layers, Search, X, ExternalLink, Info, Shirt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeImage, TriageItem } from './services/geminiService';

type Mode = 'SINGLE' | 'BIN' | 'RACK';

export default function App() {
  const [mode, setMode] = useState<Mode>('BIN');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<TriageItem[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TriageItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToData = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultString = reader.result as string;
        const [meta, base64] = resultString.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        resolve({ base64, mimeType });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCapturedImage(url);
      setResults([]);
      setSelectedItem(null);
      setRawResponse(null);
      setIsAnalyzing(true);

      try {
        const { base64, mimeType } = await fileToData(file);
        const { data, raw } = await analyzeImage(base64, mode, mimeType);
        setResults(data.items);
        setRawResponse(raw);
      } catch (error) {
        console.error("Analysis failed", error);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const clearImage = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
      setCapturedImage(null);
    }
    setResults([]);
    setSelectedItem(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const getVerdictStyles = (verdict: TriageItem['verdict']) => {
    switch (verdict) {
      case 'GRAB':
        return { dot: 'bg-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.6)]', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20', icon: null };
      case 'CHECK':
        return { dot: 'bg-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.5)]', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/20', icon: null };
      case 'UNCLEAR':
        return { dot: 'bg-[#9ca3af] shadow-[0_0_10px_rgba(156,163,175,0.4)]', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/20', icon: null };
      case 'SKIP':
        return { dot: 'bg-[#ef4444] shadow-[0_0_10px_rgba(239,68,68,0.4)]', badge: 'bg-red-500/20 text-red-100 border-red-500/20', icon: <X size={10} className="text-white" /> };
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-slate-100 font-sans flex flex-col items-center">
      {/* Header */}
      <header className="w-full h-16 flex items-center justify-center border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Thrift Triage
        </h1>
      </header>

      <main className="w-full max-w-md px-4 flex flex-col items-center">
        {/* Toggle Component */}
        <div className="mt-6 w-full">
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-xl">
            <button
              onClick={() => { setMode('SINGLE'); clearImage(); }}
              className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                mode === 'SINGLE'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search size={16} />
              Single
            </button>
            <button
              onClick={() => { setMode('BIN'); clearImage(); }}
              className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                mode === 'BIN'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={16} />
              Bin
            </button>
            <button
              onClick={() => { setMode('RACK'); clearImage(); }}
              className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                mode === 'RACK'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shirt size={16} />
              Rack
            </button>
          </div>
        </div>

        {/* Action Area */}
        <div className="flex-1 w-full flex flex-col items-center justify-center py-8 min-h-[50vh]">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {!capturedImage ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              <button
                id="scan-button"
                onClick={triggerCamera}
                className="group relative w-32 h-32 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)] hover:scale-105 active:scale-95 transition-transform"
              >
                <div className="absolute inset-2 border-2 border-dashed border-white/30 rounded-full animate-[spin_10s_linear_infinite]" />
                <Camera size={40} className="text-white group-hover:scale-110 transition-transform" />
              </button>
              <p className="mt-8 text-slate-400 text-center text-lg px-4 leading-relaxed max-w-[280px]">
                Tap <span className="text-emerald-400 font-medium">Scan</span> to analyze a {mode === 'BIN' ? 'pile' : mode === 'RACK' ? 'rack' : 'single item'}
              </p>
            </motion.div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <div className="w-full relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 aspect-[3/4]">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                
                {/* Analyzing Overlay */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <p className="text-emerald-400 font-medium text-lg animate-pulse">Analyzing...</p>
                  </div>
                )}

                {/* Markers */}
                {!isAnalyzing && results.map((item, idx) => {
                  const styles = getVerdictStyles(item.verdict);
                  const size = item.verdict === 'GRAB' ? 24 : item.verdict === 'CHECK' ? 20 : 18;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      style={{
                        position: 'absolute',
                        left: `${item.marker_point.x * 100}%`,
                        top: `${item.marker_point.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="z-10 flex flex-col items-center gap-1.5 pointer-events-none"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        style={{
                          width: `${size}px`,
                          height: `${size}px`,
                        }}
                        className={`${styles.dot} rounded-full border-2 border-white/50 cursor-pointer pointer-events-auto active:scale-125 transition-transform flex items-center justify-center`}
                      >
                        {styles.icon}
                      </button>
                      {item.estimated_price_range && (
                        <span className="px-1.5 py-0.5 bg-black/80 backdrop-blur-md rounded-md text-[10px] font-black text-white border border-white/20 whitespace-nowrap shadow-xl">
                          {item.estimated_price_range}
                        </span>
                      )}
                    </motion.div>
                  );
                })}

                <button
                  id="clear-button"
                  onClick={clearImage}
                  className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white border border-white/20 z-20"
                >
                  <X size={20} />
                </button>
              </div>

      {!isAnalyzing && results.length === 0 && capturedImage && (
        <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10 text-center w-full">
          <p className="text-slate-400 text-sm">No items identified. {rawResponse ? 'Check debug logs below.' : 'Try a clearer photo.'}</p>
        </div>
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

      <button
                id="retake-button"
                onClick={triggerCamera}
                className="mt-6 flex items-center gap-2 py-4 px-8 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-sm font-medium transition-colors"
                disabled={isAnalyzing}
              >
                <Camera size={20} />
                {isAnalyzing ? 'Analyzing...' : 'Retake Photo'}
              </button>
            </div>
          )}
        </div>

        {/* Bottom space */}
        <div className="h-12" />
      </main>

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
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold">{selectedItem.likely_brand}</h2>
                      <span className={`text-xl font-black ${selectedItem.verdict === 'SKIP' ? 'text-red-400 line-through opacity-50' : 'text-emerald-400'}`}>
                        {selectedItem.estimated_price_range}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getVerdictStyles(selectedItem.verdict).badge}`}>
                      {selectedItem.verdict}
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="p-2 bg-white/5 rounded-full text-slate-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <section>
                    <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
                      <Search size={14} /> Visible Evidence
                    </h3>
                    <ul className="grid grid-cols-1 gap-2">
                      {selectedItem.visible_evidence.map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                          <span className="text-emerald-500 mt-1">•</span>
                          {ev}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
                      <Info size={14} /> To Confirm
                    </h3>
                    <ul className="grid grid-cols-1 gap-2">
                      {selectedItem.missing_evidence.map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                          <span className="text-amber-500 mt-1">•</span>
                          {ev}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-slate-300 text-sm leading-relaxed italic">
                      "{selectedItem.verdict_reason}"
                    </p>
                  </section>

                  <div className={`p-4 rounded-2xl border ${
                    selectedItem.verdict === 'GRAB' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    selectedItem.verdict === 'CHECK' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    'bg-slate-500/10 border-slate-500/20 text-slate-400'
                  }`}>
                    <p className="text-sm font-bold flex items-center gap-2">
                       {selectedItem.action_hint}
                    </p>
                  </div>

                  <a
                    href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(selectedItem.ebay_sold_query)}&LH_Sold=1&LH_Complete=1&_sop=13`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-slate-100 text-slate-900 rounded-2xl font-bold text-lg hover:bg-white active:scale-95 transition-all shadow-xl"
                  >
                    <ExternalLink size={20} />
                    Verify on eBay
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


