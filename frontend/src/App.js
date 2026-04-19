import React, { useState, useRef, useEffect } from "react";
import "@/App.css";
import {
  Upload, FileText, X, Loader2, BarChart3,
  AlertCircle, CheckCircle2, Trash2, Eye,
  ArrowLeft, Award, TrendingDown, TrendingUp,
  Scale, Star, HelpCircle, Clock, ChevronDown,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function formatCurrency(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

// ====== QUOTE ANALYZER COMPONENT ======
function QuoteAnalyzer({ projectId = "demo-project" }) {
  const [quoteFiles, setQuoteFiles] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState("infissi");
  const [view, setView] = useState("upload");
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadComparisons();
  }, [projectId]);

  const loadComparisons = async () => {
    try {
      const res = await fetch(`${API}/quotes/comparisons/${projectId}`);
      const data = await res.json();
      if (data.success) setSavedComparisons(data.comparisons);
    } catch (e) {
      console.error("Error loading comparisons:", e);
    }
  };

  const handleFileSelect = (files) => {
    const remaining = 5 - quoteFiles.length;
    if (remaining <= 0) { setError("Massimo 5 preventivi per confronto"); return; }
    const newFiles = Array.from(files).slice(0, remaining);
    const objs = newFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      status: "pending",
      extractedData: null,
      errorMessage: "",
      supplierName: f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
    }));
    setQuoteFiles(prev => [...prev, ...objs]);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = reader.result; resolve(r.split(",")[1] || r); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const extractQuote = async (qf) => {
    setQuoteFiles(prev => prev.map(q => q.id === qf.id ? { ...q, status: "extracting" } : q));
    try {
      const b64 = await fileToBase64(qf.file);
      const res = await fetch(`${API}/quotes/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_base64: b64, file_name: qf.file.name, mime_type: qf.file.type || "image/jpeg" })
      });
      const data = await res.json();
      if (data.success) {
        setQuoteFiles(prev => prev.map(q => q.id === qf.id ? { ...q, status: "extracted", extractedData: data.data, supplierName: data.data.fornitore || q.supplierName } : q));
      } else {
        setQuoteFiles(prev => prev.map(q => q.id === qf.id ? { ...q, status: "error", errorMessage: data.error } : q));
      }
    } catch (e) {
      setQuoteFiles(prev => prev.map(q => q.id === qf.id ? { ...q, status: "error", errorMessage: e.message } : q));
    }
  };

  const extractAll = async () => {
    for (const q of quoteFiles.filter(q => q.status === "pending")) {
      await extractQuote(q);
    }
  };

  const compareQuotes = async () => {
    const extracted = quoteFiles.filter(q => q.status === "extracted" && q.extractedData);
    if (extracted.length < 2) { setError("Servono almeno 2 preventivi estratti"); return; }
    setIsComparing(true); setError(null);
    try {
      const res = await fetch(`${API}/quotes/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          quotes: extracted.map(q => q.extractedData),
          quote_names: extracted.map(q => q.supplierName),
          user_id: "demo-user",
          categoria
        })
      });
      const data = await res.json();
      if (data.success) { setComparison(data.report); setView("result"); loadComparisons(); }
      else setError(data.error || "Errore nel confronto");
    } catch (e) {
      setError(e.message);
    } finally { setIsComparing(false); }
  };

  const deleteComparison = async (id) => {
    await fetch(`${API}/quotes/comparison/${id}`, { method: "DELETE" });
    loadComparisons();
  };

  const removeFile = (id) => {
    setQuoteFiles(prev => {
      const f = prev.find(q => q.id === id);
      if (f) URL.revokeObjectURL(f.previewUrl);
      return prev.filter(q => q.id !== id);
    });
  };

  const resetAll = () => {
    quoteFiles.forEach(q => URL.revokeObjectURL(q.previewUrl));
    setQuoteFiles([]); setComparison(null); setError(null); setView("upload");
  };

  const extractedCount = quoteFiles.filter(q => q.status === "extracted").length;
  const pendingCount = quoteFiles.filter(q => q.status === "pending").length;
  const extractingCount = quoteFiles.filter(q => q.status === "extracting").length;

  return (
    <div className="space-y-6" data-testid="quote-analyzer">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== "upload" && (
            <button data-testid="quote-back-btn" onClick={() => { setView("upload"); setComparison(null); }}
              className="p-2 rounded-xl hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Valutatore Preventivi</h3>
            <p className="text-xs text-zinc-400">Confronta fino a 5 preventivi con analisi AI</p>
          </div>
        </div>
        <div className="flex gap-2">
          {savedComparisons.length > 0 && (
            <button data-testid="quote-history-btn"
              onClick={() => setView(view === "history" ? "upload" : "history")}
              className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                view === "history" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}>
              <Clock className="w-3.5 h-3.5" /> Cronologia ({savedComparisons.length})
            </button>
          )}
          {view === "upload" && quoteFiles.length > 0 && (
            <button data-testid="quote-reset-btn" onClick={resetAll}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History View */}
      {view === "history" && (
        <HistoryView comparisons={savedComparisons}
          onView={(c) => { setComparison(c.summary); setView("result"); }}
          onDelete={deleteComparison} />
      )}

      {/* Upload View */}
      {view === "upload" && (
        <div className="space-y-6">
          {/* Category */}
          <div className="flex flex-wrap gap-2">
            {["infissi", "porte", "persiane", "pavimenti", "impianto elettrico", "impianto idraulico", "altro"].map(cat => (
              <button key={cat} data-testid={`quote-category-${cat}`}
                onClick={() => setCategoria(cat)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all capitalize border",
                  categoria === cat ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400")}>
                {cat}
              </button>
            ))}
          </div>

          {/* Upload Area */}
          <div data-testid="quote-upload-area"
            onClick={() => quoteFiles.length < 5 && fileInputRef.current?.click()}
            className={cn("border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
              quoteFiles.length >= 5 ? "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed" : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50")}>
            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)} disabled={quoteFiles.length >= 5} />
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
                <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-zinc-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-200">
                    {q.file.type?.startsWith("image/") ? (
                      <img src={q.previewUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FileText className="w-6 h-6 text-rose-400" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <input data-testid={`quote-supplier-name-${idx}`} type="text" value={q.supplierName}
                      onChange={(e) => setQuoteFiles(prev => prev.map(f => f.id === q.id ? { ...f, supplierName: e.target.value } : f))}
                      className="text-sm font-bold bg-transparent border-none outline-none w-full text-zinc-900 placeholder:text-zinc-300"
                      placeholder="Nome fornitore..." />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-400">{(q.file.size / 1024).toFixed(0)} KB</span>
                      {q.status === "extracting" && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" /> Analisi AI...
                        </span>
                      )}
                      {q.status === "extracted" && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Estratto
                        </span>
                      )}
                      {q.status === "error" && (
                        <span className="flex items-center gap-1 text-[10px] text-rose-600 font-bold" title={q.errorMessage}>
                          <AlertCircle className="w-3 h-3" /> Errore
                        </span>
                      )}
                      {q.status === "extracted" && q.extractedData?.totale_lordo > 0 && (
                        <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                          Totale: {formatCurrency(q.extractedData.totale_lordo)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {q.status === "pending" && (
                      <button data-testid={`quote-extract-btn-${idx}`} onClick={() => extractQuote(q)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-800 transition-all">
                        Analizza
                      </button>
                    )}
                    {q.status === "error" && (
                      <button onClick={() => extractQuote(q)}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-all">
                        Riprova
                      </button>
                    )}
                    <button onClick={() => removeFile(q.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-300 hover:text-rose-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Actions */}
          {quoteFiles.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              {pendingCount > 0 && (
                <button data-testid="quote-extract-all-btn" onClick={extractAll} disabled={extractingCount > 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-900 font-bold text-sm hover:bg-zinc-200 transition-all disabled:opacity-50">
                  {extractingCount > 0 ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso...</>
                    : <><BarChart3 className="w-4 h-4" /> Analizza Tutti ({pendingCount})</>}
                </button>
              )}
              {extractedCount >= 2 && (
                <button data-testid="quote-compare-btn" onClick={compareQuotes} disabled={isComparing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg">
                  {isComparing ? <><Loader2 className="w-4 h-4 animate-spin" /> Confronto AI in corso...</>
                    : <><Scale className="w-4 h-4" /> Confronta {extractedCount} Preventivi</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Result View */}
      {view === "result" && comparison && <ComparisonReport report={comparison} />}
    </div>
  );
}

// ====== COMPARISON REPORT ======
function ComparisonReport({ report }) {
  const summary = report.riepilogo || report;
  const fornitori = report.analisi_fornitori || [];
  const confrontoVoci = report.confronto_voci || [];
  const raccomandazione = report.raccomandazione || {};
  const domande = report.domande_fornitori || [];
  const reportTesto = report.report_testo || "";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="comparison-report">
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
              {summary.piu_economico.prezzo > 0 && <p className="text-sm font-bold text-sky-700">{formatCurrency(summary.piu_economico.prezzo)}</p>}
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
              {summary.premium.prezzo > 0 && <p className="text-sm font-bold text-amber-700">{formatCurrency(summary.premium.prezzo)}</p>}
              <p className="text-xs text-amber-700">{summary.premium.vantaggi}</p>
            </div>
          )}
        </div>
      )}

      {/* Supplier Analysis */}
      {fornitori.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50"><h4 className="text-sm font-bold">Analisi per Fornitore</h4></div>
          <div className="divide-y divide-zinc-100">
            {fornitori.map((f, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold">{f.fornitore}</h5>
                  {f.score && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", f.score >= 80 ? "bg-emerald-500" : f.score >= 60 ? "bg-amber-500" : "bg-rose-500")}
                          style={{ width: `${f.score}%` }} />
                      </div>
                      <span className="text-xs font-bold text-zinc-600">{f.score}/100</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Pro</span>
                    <ul className="space-y-1">
                      {(f.pro || []).map((p, i) => (
                        <li key={i} className="text-xs text-zinc-600 flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Contro</span>
                    <ul className="space-y-1">
                      {(f.contro || []).map((c, i) => (
                        <li key={i} className="text-xs text-zinc-600 flex items-start gap-1.5">
                          <AlertCircle className="w-3 h-3 text-rose-500 mt-0.5 shrink-0" />{c}
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
          <div className="p-4 border-b border-zinc-100 bg-zinc-50"><h4 className="text-sm font-bold">Confronto Voci</h4></div>
          <div className="divide-y divide-zinc-100">
            {confrontoVoci.map((voce, idx) => (
              <div key={idx} className="p-4 space-y-2">
                <h5 className="text-xs font-bold text-zinc-900">{voce.voce}</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(voce.confronti || []).map((c, i) => (
                    <div key={i} className={cn("p-3 rounded-xl border text-xs space-y-1",
                      c.valutazione === "buono" ? "bg-emerald-50 border-emerald-200" :
                      c.valutazione === "scarso" ? "bg-rose-50 border-rose-200" : "bg-zinc-50 border-zinc-200")}>
                      <span className="font-bold block">{c.fornitore}</span>
                      {c.prezzo > 0 && <span className="font-bold text-zinc-700">{formatCurrency(c.prezzo)}</span>}
                      <p className="text-zinc-500">{c.dettagli}</p>
                    </div>
                  ))}
                </div>
                {voce.nota && <p className="text-[10px] text-zinc-500 italic mt-1">{voce.nota}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {(raccomandazione.per_risparmio || raccomandazione.per_qualita || raccomandazione.per_equilibrio) && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Raccomandazioni</h4>
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

      {/* Questions */}
      {domande.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold flex items-center gap-2"><HelpCircle className="w-4 h-4 text-violet-500" /> Domande da fare ai Fornitori</h4>
          <ul className="space-y-2">
            {domande.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Report */}
      {reportTesto && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold">Report Completo</h4>
          <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">{reportTesto}</p>
        </div>
      )}
    </motion.div>
  );
}

// ====== HISTORY VIEW ======
function HistoryView({ comparisons, onView, onDelete }) {
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
        <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold capitalize truncate">{c.categoria}</h4>
              <p className="text-[10px] text-zinc-400">{c.quote_names?.join(" vs ")} - {new Date(c.created_at).toLocaleDateString("it-IT")}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onView(c)} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 text-[10px] font-bold hover:bg-zinc-200 transition-all">
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-300 hover:text-rose-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ====== MAIN APP ======
function App() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 md:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-900">EdilGest AI</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 bg-zinc-100 px-3 py-1 rounded-full font-medium">Demo Valutatore Preventivi</span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <QuoteAnalyzer projectId="demo-project" />
      </main>
    </div>
  );
}

export default App;
