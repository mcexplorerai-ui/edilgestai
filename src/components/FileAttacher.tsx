import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Camera, ExternalLink, Loader2, Video } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility per le classi Tailwind
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AttachedFile {
  id: string;
  file: File;
  previewUrl?: string;
  status: 'compressing' | 'ready' | 'error';
  originalSize: number;
  compressedSize?: number;
  type: string;
  hasError?: boolean;
}

interface FileAttacherProps {
  onFilesChange: (files: AttachedFile[]) => void;
  disabled?: boolean;
}

export const FileAttacher: React.FC<FileAttacherProps> = ({ onFilesChange, disabled }) => {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent of changes
  useEffect(() => {
    onFilesChange(files);
  }, [files, onFilesChange]);

  const handleFileProcessing = async (selectedFiles: FileList | File[]) => {
    if (disabled) return;
    
    const newFiles: AttachedFile[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: file.type.startsWith('image/') ? 'compressing' : 'ready',
      originalSize: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file)
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (const fileObj of newFiles) {
      if (fileObj.type.startsWith('image/')) {
        try {
          const options = {
            maxSizeMB: 2, // Aumentato a 2MB per alta risoluzione (Storage lo permette)
            maxWidthOrHeight: 3840, // Supporto fino a 4K
            useWebWorker: true,
          };
          
          const compressedFile = await imageCompression(fileObj.file, options);
          if (fileObj.previewUrl) URL.revokeObjectURL(fileObj.previewUrl);
          const newPreviewUrl = URL.createObjectURL(compressedFile);
          
          setFiles(prev => prev.map(f => 
            f.id === fileObj.id 
              ? { ...f, file: compressedFile, compressedSize: compressedFile.size, status: 'ready', previewUrl: newPreviewUrl } 
              : f
          ));
        } catch (error) {
          console.error("Compression error:", error);
          setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error' } : f));
        }
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  return (
    <div className="w-full space-y-4">
      {/* Area di Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!disabled) handleFileProcessing(e.dataTransfer.files); }}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
          isDragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => e.target.files && handleFileProcessing(e.target.files)} 
          disabled={disabled}
        />
        <Upload className="mx-auto w-8 h-8 text-zinc-300 mb-2" />
        <p className="text-zinc-600 font-medium text-sm">Trascina i file o clicca per allegare</p>
        <p className="text-xs text-zinc-400 mt-1">Foto di cantiere, PDF, Documenti</p>
      </div>

      {/* Lista File */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        <AnimatePresence>
          {files.map((f) => (
            <motion.div 
              key={f.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, x: -20 }} 
              className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-50 flex-shrink-0 overflow-hidden flex items-center justify-center border border-zinc-100">
                {f.status === 'compressing' ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : f.type.startsWith('image/') && f.previewUrl && !f.hasError ? (
                  <img 
                    src={f.previewUrl} 
                    className="w-full h-full object-cover" 
                    onError={() => setFiles(prev => prev.map(item => item.id === f.id ? { ...item, hasError: true } : item))} 
                  />
                ) : f.type.includes('pdf') ? (
                  <FileText className="w-5 h-5 text-rose-500" />
                ) : f.type.startsWith('video/') ? (
                  <Video className="w-5 h-5 text-indigo-500" />
                ) : (
                  <Camera className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-xs font-bold truncate text-zinc-900">{f.file.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-medium text-zinc-400">
                    {formatSize(f.originalSize)}
                    {f.compressedSize && f.compressedSize !== f.originalSize && (
                      <span className="text-emerald-600 ml-1">
                        → {formatSize(f.compressedSize)}
                      </span>
                    )}
                  </p>
                  {f.status === 'compressing' && (
                    <span className="text-[10px] font-bold text-zinc-400 animate-pulse italic">Compressione...</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {f.status === 'ready' && f.previewUrl && (
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(f.previewUrl, '_blank'); }} 
                    className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} 
                  className="p-1.5 hover:bg-rose-50 rounded-lg text-zinc-300 hover:text-rose-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
