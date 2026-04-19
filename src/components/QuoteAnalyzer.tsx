import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, X, Loader2, BarChart3, 
  ChevronRight, AlertCircle, CheckCircle2, 
  Trash2, Eye, ArrowLeft, Plus, Award,
  TrendingDown, TrendingUp, Scale, Star,
  HelpCircle, Clock, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// API URL - uses the backend URL from env or relative path
const API_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) 
  || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) 
  || '';

interface QuoteFile {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  status: 'pending' | 'extracting' | 'extracted' | 'error';
  extractedData: any | null;
  errorMessage?: string;
  supplierName: string;
}

interface SavedComparison {
  id: string;
  project_id: string;
  categoria: string;
  quotes: any[];
  quote_names: string[];
  report: string;
  summary: any;
  user_id: string;
  created_at: string;
}

interface QuoteAnalyzerProps {
  projectId: string;
  userId: string;
}

export const QuoteAnalyzer: React.FC<QuoteAnalyzerProps> = ({ projectId, userId }) => {
  const [quoteFiles, setQuoteFiles] = useState<QuoteFile[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState<any | null>(null);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);
  const [viewingComparison, setViewingComparison] = useState<SavedComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('infissi');
  const [view, setView] = useState<'upload' | 'result' | 'history'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved comparisons
  useEffect(() => {
    loadComparisons();
  }, [projectId]);

  const loadComparisons = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quotes/comparisons/${projectId}`);
      const data = await res.json();
      if (data.success) {
        setSavedComparisons(data.comparisons);
      }
    } catch (e) {
      console.error('Error loading comparisons:', e);
    }
  };

  const handleFileSelect = async (files: FileList | File[]) => {
    const remaining = 5 - quoteFiles.length;
    if (remaining <= 0) {
      setError('Massimo 5 preventivi per confronto');
      return;
    }

    const newFiles = Array.from(files).slice(0, remaining);
    const quoteFileObjs: QuoteFile[] = newFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      status: 'pending' as const,
      extractedData: null,
      supplierName: f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
    }));

    setQuoteFiles(prev => [...prev, ...quoteFileObjs]);
  };

  const extractQuote = async (quoteFile: QuoteFile) => {
    setQuoteFiles(prev => prev.map(q => 
      q.id === quoteFile.id ? { ...q, status: 'extracting' } : q
    ));

    try {
      // Convert file to base64
      const base64 = await fileToBase64(quoteFile.file);
      
      const res = await fetch(`${API_URL}/api/quotes/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_base64: base64,
          file_name: quoteFile.file.name,
          mime_type: quoteFile.file.type || 'image/jpeg'
        })
      });

      const data = await res.json();

      if (data.success) {
        setQuoteFiles(prev => prev.map(q => 
          q.id === quoteFile.id ? { 
            ...q, 
            status: 'extracted', 
            extractedData: data.data,
            supplierName: data.data.fornitore || q.supplierName
          } : q
        ));
      } else {
        setQuoteFiles(prev => prev.map(q => 
          q.id === quoteFile.id ? { ...q, status: 'error', errorMessage: data.error } : q
        ));
      }
    } catch (e: any) {
      setQuoteFiles(prev => prev.map(q => 
        q.id === quoteFile.id ? { ...q, status: 'error', errorMessage: e.message } : q
      ));
    }
  };

  const extractAll = async () => {
    const pending = quoteFiles.filter(q => q.status === 'pending');
    for (const q of pending) {
      await extractQuote(q);
    }
  };

  const compareQuotes = async () => {
    const extracted = quoteFiles.filter(q => q.status === 'extracted' && q.extractedData);
    if (extracted.length < 2) {
      setError('Servono almeno 2 preventivi estratti per il confronto');
      return;
    }

    setIsComparing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/quotes/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          quotes: extracted.map(q => q.extractedData),
          quote_names: extracted.map(q => q.supplierName),
          user_id: userId,
          categoria
        })
      });

      const data = await res.json();

      if (data.success) {
        setComparison(data.report);
        setView('result');
        loadComparisons();
      } else {
        setError(data.error || 'Errore nel confronto');
      }
    } catch (e: any) {
      setError(e.message || 'Errore di connessione');
    } finally {
      setIsComparing(false);
    }
  };

  const deleteComparison = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/quotes/comparison/${id}`, { method: 'DELETE' });
      loadComparisons();
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const removeFile = (id: string) => {
    setQuoteFiles(prev => {
      const f = prev.find(q => q.id === id);
      if (f) URL.revokeObjectURL(f.previewUrl);
      return prev.filter(q => q.id !== id);
    });
  };

  const resetAll = () => {
    quoteFiles.forEach(q => URL.revokeObjectURL(q.previewUrl));
    setQuoteFiles([]);
    setComparison(null);
    setError(null);
    setView('upload');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:mime;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractedCount = quoteFiles.filter(q => q.status === 'extracted').length;
  const pendingCount = quoteFiles.filter(q => q.status === 'pending').length;
  const extractingCount = quoteFiles.filter(q => q.status === 'extracting').length;

  return (
    <div className="space-y-6" data-testid="quote-analyzer">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'upload' && (
            <button
              data-testid="quote-back-btn"
              onClick={() => view === 'result' ? setView('upload') : setView('upload')}
              className="p-2 rounded-xl hover:bg-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h3 className="text-lg font-bold">Valutatore Preventivi</h3>
            <p className="text-xs text-zinc-400">Confronta fino a 5 preventivi con analisi AI</p>
          </div>
        </div>
        <div className="flex gap-2">
          {savedComparisons.length > 0 && (
            <button
              data-testid="quote-history-btn"
              onClick={() => setView(view === 'history' ? 'upload' : 'history')}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                view === 'history' 
                  ? "bg-zinc-900 text-white" 
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              Cronologia ({savedComparisons.length})
            </button>
          )}
          {view === 'upload' && quoteFiles.length > 0 && (
            <button
              data-testid="quote-reset-btn"
              onClick={resetAll}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History View */}
      {view === 'history' && (
        <HistoryView 
          comparisons={savedComparisons}
          onView={(c) => { setViewingComparison(c); setComparison(c.summary); setView('result'); }}
          onDelete={deleteComparison}
        />
      )}

      {/* Upload View */}
      {view === 'upload' && (
        <div className="space-y-6">
          {/* Category Selector */}
          <div className="flex flex-wrap gap-2">
            {['infissi', 'porte', 'persiane', 'pavimenti', 'impianto elettrico', 'impianto idraulico', 'altro'].map(cat => (
              <button
                key={cat}
                data-testid={`quote-category-${cat}`}
                onClick={() => setCategoria(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all capitalize border",
                  categoria === cat
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Upload Area */}
          <div
            data-testid="quote-upload-area"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
              quoteFiles.length >= 5 
                ? "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed" 
                : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
              disabled={quoteFiles.length >= 5}
            />
            <Upload className="mx-auto w-10 h-10 text-zinc-300 mb-3" />
            <p className="text-zinc-600 font-bold text-sm">Carica i preventivi da confrontare</p>
            <p className="text-xs text-zinc-400 mt-1">PDF, foto o scansioni - max 5 preventivi</p>
            <p className="text-xs text-zinc-300 mt-2">{quoteFiles.length}/5 caricati</p>
          </div>

          {/* File List */}
          {quoteFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-500">Preventivi Caricati</h4>
              {quoteFiles.map((q, idx) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-4"
                >
                  {/* Preview */}
                  <div className="w-14 h-14 rounded-xl bg-zinc-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-200">
                    {q.file.type.startsWith('image/') ? (
                      <img src={q.previewUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FileText className="w-6 h-6 text-rose-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <input
                      data-testid={`quote-supplier-name-${idx}`}
                      type="text"
                      value={q.supplierName}
                      onChange={(e) => setQuoteFiles(prev => prev.map(f => 
                        f.id === q.id ? { ...f, supplierName: e.target.value } : f
                      ))}
                      className="text-sm font-bold bg-transparent border-none outline-none w-full text-zinc-900 placeholder:text-zinc-300"
                      placeholder="Nome fornitore..."
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-400">{(q.file.size / 1024).toFixed(0)} KB</span>
                      {q.status === 'extracting' && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" /> Analisi AI...
                        </span>
                      )}
                      {q.status === 'extracted' && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Estratto
                        </span>
                      )}
                      {q.status === 'error' && (
                        <span className="flex items-center gap-1 text-[10px] text-rose-600 font-bold" title={q.errorMessage}>
                          <AlertCircle className="w-3 h-3" /> Errore
                        </span>
                      )}
                      {q.status === 'extracted' && q.extractedData?.totale_lordo && (
                        <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                          Totale: {formatCurrency(q.extractedData.totale_lordo)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {q.status === 'pending' && (
                      <button
                        data-testid={`quote-extract-btn-${idx}`}
                        onClick={() => extractQuote(q)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-800 transition-all"
                      >
                        Analizza
                      </button>
                    )}
                    {q.status === 'error' && (
                      <button
                        onClick={() => extractQuote(q)}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-all"
                      >
                        Riprova
                      </button>
                    )}
                    {q.status === 'extracted' && (
                      <button
                        data-testid={`quote-view-data-${idx}`}
                        onClick={() => {/* could show extracted data modal */}}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(q.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-300 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {quoteFiles.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              {pendingCount > 0 && (
                <button
                  data-testid="quote-extract-all-btn"
                  onClick={extractAll}
                  disabled={extractingCount > 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-900 font-bold text-sm hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  {extractingCount > 0 ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso...</>
                  ) : (
                    <><BarChart3 className="w-4 h-4" /> Analizza Tutti ({pendingCount})</>
                  )}
                </button>
              )}
              {extractedCount >= 2 && (
                <button
                  data-testid="quote-compare-btn"
                  onClick={compareQuotes}
                  disabled={isComparing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg"
                >
                  {isComparing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Confronto AI in corso...</>
                  ) : (
                    <><Scale className="w-4 h-4" /> Confronta {extractedCount} Preventivi</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Result View */}
      {view === 'result' && comparison && (
        <ComparisonReport 
          report={comparison} 
          onBack={() => { setView('upload'); setComparison(null); setViewingComparison(null); }}
        />
      )}
    </div>
  );
};

// --- Sub Components ---

function ComparisonReport({ report, onBack }: { report: any; onBack: () => void }) {
  const summary = report.riepilogo || report;
  const fornitori = report.analisi_fornitori || [];
  const confrontoVoci = report.confronto_voci || [];
  const raccomandazione = report.raccomandazione || {};
  const domande = report.domande_fornitori || [];
  const reportTesto = report.report_testo || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="comparison-report"
    >
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.miglior_qualita_prezzo && (
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Miglior Qualita/Prezzo</span>
              </div>
              <h4 className="text-lg font-bold text-emerald-900">{summary.miglior_qualita_prezzo.fornitore}</h4>
              <p className="text-xs text-emerald-700">{summary.miglior_qualita_prezzo.motivo}</p>
            </div>
          )}
          {summary.piu_economico && (
            <div className="bg-gradient-to-br from-sky-50 to-sky-100/50 border border-sky-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-sky-600" />
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Piu Economico</span>
              </div>
              <h4 className="text-lg font-bold text-sky-900">{summary.piu_economico.fornitore}</h4>
              {summary.piu_economico.prezzo > 0 && (
                <p className="text-sm font-bold text-sky-700">{formatCurrency(summary.piu_economico.prezzo)}</p>
              )}
              <p className="text-xs text-sky-700">{summary.piu_economico.sacrifici}</p>
            </div>
          )}
          {summary.premium && (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Premium</span>
              </div>
              <h4 className="text-lg font-bold text-amber-900">{summary.premium.fornitore}</h4>
              {summary.premium.prezzo > 0 && (
                <p className="text-sm font-bold text-amber-700">{formatCurrency(summary.premium.prezzo)}</p>
              )}
              <p className="text-xs text-amber-700">{summary.premium.vantaggi}</p>
            </div>
          )}
        </div>
      )}

      {/* Supplier Analysis */}
      {fornitori.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50">
            <h4 className="text-sm font-bold">Analisi per Fornitore</h4>
          </div>
          <div className="divide-y divide-zinc-100">
            {fornitori.map((f: any, idx: number) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold">{f.fornitore}</h5>
                  {f.score && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all",
                            f.score >= 80 ? "bg-emerald-500" : f.score >= 60 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${f.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-600">{f.score}/100</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Pro</span>
                    <ul className="space-y-1">
                      {(f.pro || []).map((p: string, i: number) => (
                        <li key={i} className="text-xs text-zinc-600 flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Contro</span>
                    <ul className="space-y-1">
                      {(f.contro || []).map((c: string, i: number) => (
                        <li key={i} className="text-xs text-zinc-600 flex items-start gap-1.5">
                          <AlertCircle className="w-3 h-3 text-rose-500 mt-0.5 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {f.adatto_a && (
                  <p className="text-xs text-zinc-500 bg-zinc-50 px-3 py-2 rounded-xl">
                    <span className="font-bold">Adatto a:</span> {f.adatto_a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Comparison */}
      {confrontoVoci.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50">
            <h4 className="text-sm font-bold">Confronto Voci</h4>
          </div>
          <div className="divide-y divide-zinc-100">
            {confrontoVoci.map((voce: any, idx: number) => (
              <div key={idx} className="p-4 space-y-2">
                <h5 className="text-xs font-bold text-zinc-900">{voce.voce}</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(voce.confronti || []).map((c: any, i: number) => (
                    <div key={i} className={cn(
                      "p-3 rounded-xl border text-xs space-y-1",
                      c.valutazione === 'buono' ? "bg-emerald-50 border-emerald-200" :
                      c.valutazione === 'scarso' ? "bg-rose-50 border-rose-200" :
                      "bg-zinc-50 border-zinc-200"
                    )}>
                      <span className="font-bold block">{c.fornitore}</span>
                      {c.prezzo > 0 && <span className="font-bold text-zinc-700">{formatCurrency(c.prezzo)}</span>}
                      <p className="text-zinc-500">{c.dettagli}</p>
                    </div>
                  ))}
                </div>
                {voce.nota && (
                  <p className="text-[10px] text-zinc-500 italic mt-1">{voce.nota}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {(raccomandazione.per_risparmio || raccomandazione.per_qualita || raccomandazione.per_equilibrio) && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Raccomandazioni
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {raccomandazione.per_risparmio && (
              <div className="bg-sky-50 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold text-sky-600 uppercase">Per Risparmiare</span>
                <p className="text-xs text-sky-800">{raccomandazione.per_risparmio}</p>
              </div>
            )}
            {raccomandazione.per_qualita && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Per Qualita</span>
                <p className="text-xs text-amber-800">{raccomandazione.per_qualita}</p>
              </div>
            )}
            {raccomandazione.per_equilibrio && (
              <div className="bg-emerald-50 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Miglior Equilibrio</span>
                <p className="text-xs text-emerald-800">{raccomandazione.per_equilibrio}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Questions for Suppliers */}
      {domande.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-violet-500" />
            Domande da fare ai Fornitori
          </h4>
          <ul className="space-y-2">
            {domande.map((d: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Text Report */}
      {reportTesto && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold">Report Completo</h4>
          <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">{reportTesto}</p>
        </div>
      )}
    </motion.div>
  );
}

function HistoryView({ 
  comparisons, 
  onView, 
  onDelete 
}: { 
  comparisons: SavedComparison[];
  onView: (c: SavedComparison) => void;
  onDelete: (id: string) => void;
}) {
  if (comparisons.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Nessun confronto salvato</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="quote-history">
      {comparisons.map(c => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold capitalize truncate">{c.categoria}</h4>
              <p className="text-[10px] text-zinc-400">
                {c.quote_names.join(' vs ')} - {new Date(c.created_at).toLocaleDateString('it-IT')}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              data-testid={`quote-view-comparison-${c.id}`}
              onClick={() => onView(c)}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 text-[10px] font-bold hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(c.id)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-300 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}
