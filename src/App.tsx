import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  query, 
  where, 
  or,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp, 
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Check,
  X,
  CreditCard,
  LayoutDashboard, 
  Plus, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Calendar, 
  DollarSign, 
  Bell,
  Send,
  MessageSquare,
  User as UserIcon, 
  ArrowLeft,
  MoreVertical,
  Trash2,
  Edit2,
  BrainCircuit,
  Filter,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Users,
  FileText,
  Image as ImageIcon,
  Camera,
  Briefcase,
  HardHat,
  Paperclip,
  Download,
  Upload,
  Eye,
  Smartphone,
  ShieldCheck,
  FolderOpen,
  Zap,
  Droplets,
  Hammer,
  Layers,
  Palette,
  ExternalLink,
  Scale,
  Ruler,
  Calculator
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import heic2any from 'heic2any';

import { auth, db, googleProvider, handleFirestoreError, OperationType, storage, ref, getDownloadURL, type FirebaseUser, uploadFileWithProgress, uploadFileWithFallback, validateFile } from './firebase';
// ref e getDownloadURL sono ora esportati da ./firebase — NON reimportare da firebase/storage
import { Project, Task, UserProfile, SubscriptionPlan, ProjectStatus, TaskStatus, TaskPriority, TaskCategory, ProjectDocument, DocumentType, Membership, ChatMessage, Conversation, Notification, TaskAttachment } from './types';
import { FileAttacher, type AttachedFile } from './components/FileAttacher';
import { QuoteAnalyzer } from './components/QuoteAnalyzer';

// --- Constants & Mappings ---
const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'In Pianificazione',
  active: 'Attivo',
  completed: 'Completato',
  'on-hold': 'In Sospeso',
};

const TASK_STATUS_LABELS: Record<TaskStatus | 'all', string> = {
  all: 'Tutti',
  todo: 'Da fare',
  'in-progress': 'In corso',
  blocked: 'Bloccato',
  done: 'Fatto',
};

const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
};

const USER_ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  investor: 'Investitore',
  technician: 'Tecnico',
  contractor: 'Impresa',
  lawyer: 'Avvocato',
  accountant: 'Commercialista',
  analyst: 'Analista Finanziario',
};

const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  elettricista: 'Elettricista',
  idraulico: 'Idraulico',
  muratore: 'Muratore',
  cartongessista: 'Cartongessista',
  pittore: 'Pittore',
  avvocato: 'Avvocato',
  geometra: 'Geometra',
  commercialista: 'Commercialista',
  altro: 'Altro',
};

const TASK_CATEGORY_ICONS: Record<TaskCategory, any> = {
  elettricista: Zap,
  idraulico: Droplets,
  muratore: Hammer,
  cartongessista: Layers,
  pittore: Palette,
  avvocato: Scale,
  geometra: Ruler,
  commercialista: Calculator,
  altro: HardHat,
};

const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  elettricista: "bg-amber-50 text-amber-500 border-amber-100",
  idraulico: "bg-sky-50 text-sky-500 border-sky-100",
  muratore: "bg-orange-50 text-orange-500 border-orange-100",
  cartongessista: "bg-zinc-50 text-zinc-500 border-zinc-100",
  pittore: "bg-rose-50 text-rose-500 border-rose-100",
  avvocato: "bg-indigo-50 text-indigo-500 border-indigo-100",
  geometra: "bg-emerald-50 text-emerald-500 border-emerald-100",
  commercialista: "bg-violet-50 text-violet-500 border-violet-100",
  altro: "bg-zinc-50 text-zinc-500 border-zinc-100",
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  business_plan: 'Business Plan',
  tax_planning: 'Pianificazione Fiscale',
  contract: 'Contratto',
  permit: 'Permesso/Pratica',
  quote: 'Preventivo',
  photo: 'Foto',
  other: 'Altro',
};

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

async function compressImage(file: File, maxSizeMB = 0.5): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < maxSizeMB * 1024 * 1024) return file;

  console.log(`[Compression] Compressing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Max dimension 1600px for fallback to keep it under 1MB even as Base64
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            console.log(`[Compression] Success: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.6); // Lower quality for faster upload
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') || fileType === 'image/heic' || fileType === 'image/heif';

  console.log(`[HEIC] Checking file: ${file.name}, type: ${file.type}, isHeic: ${isHeic}`);

  if (!isHeic) return file;

  try {
    console.log(`[HEIC] Converting ${file.name} to JPEG...`);
    // @ts-ignore - heic2any types can be tricky
    const blob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.8
    });
    
    const convertedBlob = Array.isArray(blob) ? blob[0] : blob;
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    console.log(`[HEIC] Conversion successful: ${newFileName}, size: ${convertedBlob.size}`);
    return new File([convertedBlob], newFileName, { type: 'image/jpeg' });
  } catch (error) {
    console.error('[HEIC] Conversion failed:', error);
    return file; // Fallback to original file
  }
}

// --- Contexts ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

// --- Components ---

const NotificationCenter = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedNotifications = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Notification))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setNotifications(sortedNotifications);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));
    return unsubscribe;
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notifications');
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-zinc-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-zinc-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-zinc-200 z-50 overflow-hidden"
            >
              <div className="p-4 border-bottom border-zinc-100 flex items-center justify-between">
                <h3 className="font-bold text-sm">Notifiche</h3>
                <Badge variant="info">{unreadCount} Nuove</Badge>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Nessuna notifica</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 border-b border-zinc-50 hover:bg-zinc-50 transition-colors cursor-pointer group",
                        !n.read && "bg-sky-50/30"
                      )}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                          <p className="text-xs font-bold">{n.title}</p>
                          <p className="text-xs text-zinc-500 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-zinc-400">
                            {format(n.createdAt?.toDate?.() || new Date(), 'dd MMM, HH:mm')}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectChat = ({ projectId }: { projectId: string }) => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [members, setMembers] = useState<Membership[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newChatName, setNewChatName] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Handle responsive view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedConvId && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [selectedConvId]);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'projects', projectId, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Conversation))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      setConversations(convs);
      
      // Auto-select first conversation if none selected AND on desktop
      if (convs.length > 0 && !selectedConvId && window.innerWidth >= 768) {
        setSelectedConvId(convs[0].id);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'conversations'));
    return unsubscribe;
  }, [projectId, user?.uid]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'projects', projectId, 'conversations', selectedConvId, 'messages')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedMessages = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as ChatMessage))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateA - dateB;
        });
      setMessages(sortedMessages);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));
    return unsubscribe;
  }, [projectId, selectedConvId]);

  // Fetch project members for new chat modal
  useEffect(() => {
    const q = query(collection(db, 'memberships'), where('projectId', '==', projectId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Membership)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'memberships'));
    return unsubscribe;
  }, [projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !profile || !selectedConvId) return;
    
    setLoading(true);
    try {
      const msgText = newMessage.trim();
      setNewMessage('');
      
      await addDoc(collection(db, 'projects', projectId, 'conversations', selectedConvId, 'messages'), {
        conversationId: selectedConvId,
        senderId: user.uid,
        senderName: profile.displayName || user.email,
        text: msgText,
        createdAt: serverTimestamp(),
      });

      // Update last message in conversation
      await updateDoc(doc(db, 'projects', projectId, 'conversations', selectedConvId), {
        lastMessage: msgText,
        lastMessageAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedMembers.length === 0) return;

    setLoading(true);
    try {
      const participantIds = Array.from(new Set([user.uid, ...selectedMembers]));
      const isGroup = participantIds.length > 2;
      
      const docRef = await addDoc(collection(db, 'projects', projectId, 'conversations'), {
        projectId,
        participantIds,
        isGroup,
        name: isGroup ? (newChatName || 'Nuovo Gruppo') : '',
        createdAt: serverTimestamp(),
      });

      setSelectedConvId(docRef.id);
      setIsCreating(false);
      setSelectedMembers([]);
      setNewChatName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'conversations');
    } finally {
      setLoading(false);
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  return (
    <div className="flex bg-white rounded-3xl border border-zinc-200 overflow-hidden h-[600px] shadow-sm relative">
      {/* Sidebar: Conversations */}
      <div className={cn(
        "w-full md:w-1/3 border-r border-zinc-100 flex flex-col bg-zinc-50/50 transition-all duration-300",
        !showSidebar && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white">
          <h3 className="text-sm font-bold">Messaggi</h3>
          <Button 
            variant="ghost" 
            className="p-1.5 rounded-lg hover:bg-zinc-100"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-zinc-400">Nessuna conversazione</p>
              <Button variant="secondary" className="w-full text-[10px] py-1" onClick={() => setIsCreating(true)}>Inizia Chat</Button>
            </div>
          ) : (
            conversations.map(c => {
              const otherParticipants = members.filter(m => c.participantIds.includes(m.userId) && m.userId !== user?.uid);
              const displayName = c.isGroup ? (c.name || 'Gruppo') : (otherParticipants[0]?.userEmail || 'Chat Privata');
              
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedConvId(c.id);
                    if (window.innerWidth < 768) setShowSidebar(false);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-2xl transition-all group",
                    selectedConvId === c.id ? "bg-zinc-900 text-white shadow-md" : "hover:bg-white hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      selectedConvId === c.id ? "bg-white/20" : "bg-zinc-200 text-zinc-600"
                    )}>
                      {c.isGroup ? <Users className="w-4 h-4" /> : displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{displayName}</p>
                      {c.lastMessage && (
                        <p className={cn(
                          "text-[10px] truncate opacity-60",
                          selectedConvId === c.id ? "text-white" : "text-zinc-500"
                        )}>
                          {c.lastMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main: Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-zinc-50/30 transition-all duration-300",
        showSidebar && "hidden md:flex"
      )}>
        {selectedConvId ? (
          <>
            <div className="p-4 bg-white border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Back button for mobile */}
                <Button 
                  variant="ghost" 
                  className="md:hidden p-2 -ml-2"
                  onClick={() => setShowSidebar(true)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {selectedConv?.isGroup ? (selectedConv.name || 'Gruppo') : (members.find(m => selectedConv?.participantIds.includes(m.userId) && m.userId !== user?.uid)?.userEmail || 'Chat')}
                  </h3>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                    {selectedConv?.participantIds.length} partecipanti
                  </p>
                </div>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
                  <MessageSquare className="w-12 h-12 opacity-10" />
                  <p className="text-sm">Inizia la conversazione...</p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.senderId === user?.uid;
                  const showName = i === 0 || messages[i-1].senderId !== m.senderId;
                  
                  return (
                    <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      {showName && !isMe && (
                        <span className="text-[10px] font-bold text-zinc-500 mb-1 ml-1 uppercase">{m.senderName}</span>
                      )}
                      <div className={cn(
                        "max-w-[85%] md:max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm",
                        isMe ? "bg-zinc-900 text-white rounded-tr-none" : "bg-white text-zinc-900 rounded-tl-none border border-zinc-100"
                      )}>
                        {m.text}
                        <p className={cn("text-[9px] mt-1 opacity-50", isMe ? "text-right" : "text-left")}>
                          {format(m.createdAt?.toDate?.() || new Date(), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-white border-t border-zinc-100 flex gap-2">
              <input 
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2 text-sm outline-none focus:border-zinc-900 transition-colors"
                placeholder="Scrivi un messaggio..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" disabled={!newMessage.trim() || loading} className="rounded-2xl px-4">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm">Seleziona una conversazione per iniziare</p>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold">Nuova Conversazione</h3>
              <Button variant="ghost" onClick={() => setIsCreating(false)} className="p-1 rounded-full"><Plus className="w-5 h-5 rotate-45" /></Button>
            </div>
            <form onSubmit={createConversation} className="p-6 space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Partecipanti</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {members.filter(m => m.userId !== user?.uid).map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-50 cursor-pointer transition-colors border border-transparent hover:border-zinc-100">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        checked={selectedMembers.includes(m.userId)}
                        onChange={e => {
                          if (e.target.checked) setSelectedMembers([...selectedMembers, m.userId]);
                          else setSelectedMembers(selectedMembers.filter(id => id !== m.userId));
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-bold">{m.userEmail}</p>
                        <p className="text-[10px] text-zinc-400 uppercase">{m.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {selectedMembers.length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nome Gruppo (Opzionale)</label>
                  <input 
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 outline-none focus:border-zinc-900 transition-all"
                    placeholder="Es. Team Progettazione"
                    value={newChatName}
                    onChange={e => setNewChatName(e.target.value)}
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full py-4 rounded-2xl text-lg"
                disabled={selectedMembers.length === 0 || loading}
              >
                {loading ? 'Creazione...' : 'Inizia Chat'}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'success' | 'warning' | 'error' | 'info' }) => {
  const variants = {
    default: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <motion.div 
    whileHover={onClick ? { y: -4, scale: 1.01 } : {}}
    onClick={onClick}
    className={cn(
      'bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 shadow-sm transition-all duration-200',
      onClick && 'cursor-pointer hover:shadow-md hover:border-zinc-300',
      className
    )}
  >
    {children}
  </motion.div>
);

// Helper component for images with fallback and no-referrer policy
function ImageWithFallback({ 
  src, 
  alt, 
  className, 
  fallbackIcon: FallbackIcon = ImageIcon 
}: { 
  src?: string; 
  alt?: string; 
  className?: string;
  fallbackIcon?: any;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [src]);

  if (!src || error) {
    return (
      <div className={cn("bg-zinc-100 flex items-center justify-center text-zinc-400", className)}>
        <FallbackIcon className="w-8 h-8 opacity-20" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 bg-zinc-100 animate-pulse flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loading ? "opacity-0" : "opacity-100"
        )}
        referrerPolicy="no-referrer"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
}

function ImageViewer({ 
  url, 
  title, 
  onClose 
}: { 
  url: string; 
  title: string; 
  onClose: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 sm:p-10"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a 
          href={url} 
          download={title}
          onClick={(e) => e.stopPropagation()}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          title="Scarica"
        >
          <Download className="w-6 h-6" />
        </a>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img 
          src={url} 
          alt={title} 
          className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
          referrerPolicy="no-referrer"
        />
      </div>
      
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
        <p className="text-white text-sm font-bold truncate max-w-[200px] sm:max-w-md">{title}</p>
      </div>
    </motion.div>
  );
}

const Button = ({ children, className, variant = 'primary', onClick, disabled, icon: Icon, loading, type = 'button' }: any) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm',
    secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200',
  };
  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant as keyof typeof variants],
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

// --- Error Boundary ---
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Si è verificato un errore imprevisto.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Errore Firestore: ${parsedError.error} (${parsedError.operationType} su ${parsedError.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full space-y-6">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900">Ops! Qualcosa è andato storto</h2>
            <p className="text-zinc-500 text-sm">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} className="w-full">Ricarica Applicazione</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Pricing View ---
const PricingView = ({ onBack }: { onBack: () => void }) => {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      monthlyPrice: 0,
      annualPrice: 0,
      description: "Per investitori alle prime armi.",
    },
    {
      name: "Pro",
      monthlyPrice: 49,
      annualPrice: 39,
      popular: true,
      description: "Per investitori attivi con più cantieri.",
    },
    {
      name: "Enterprise",
      monthlyPrice: 149,
      annualPrice: 119,
      description: "Per società e grandi team.",
    }
  ];

  const featureMatrix = [
    { name: "Progetti Attivi", starter: "1", pro: "10", enterprise: "Illimitati" },
    { name: "Stime AI / mese", starter: "5", pro: "Illimitate", enterprise: "Illimitate" },
    { name: "Cloud Storage", starter: "1 GB", pro: "50 GB", enterprise: "500 GB" },
    { name: "Membri Team", starter: "2", pro: "10", enterprise: "Illimitati" },
    { name: "Chat Generale", starter: true, pro: true, enterprise: true },
    { name: "Chat Multicanale", starter: false, pro: true, enterprise: true },
    { name: "Supporto Prioritario", starter: false, pro: true, enterprise: true },
    { name: "Export PDF Avanzato", starter: false, pro: true, enterprise: true },
    { name: "Branding Personalizzato", starter: false, pro: false, enterprise: true },
    { name: "API Access", starter: false, pro: false, enterprise: true },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto py-8 space-y-12"
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onBack} icon={ArrowLeft} className="mb-4">Torna alla Dashboard</Button>
        </div>
        <h2 className="text-4xl font-bold tracking-tight">Scegli il piano perfetto per te</h2>
        <p className="text-zinc-500 text-lg">Sblocca tutto il potenziale di EdilGest AI e scala i tuoi investimenti.</p>
        
        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <span className={cn("text-sm font-medium", !isAnnual ? "text-zinc-900" : "text-zinc-400")}>Mensile</span>
          <button 
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-12 h-6 bg-zinc-200 rounded-full relative transition-colors p-1"
          >
            <div className={cn(
              "w-4 h-4 bg-zinc-900 rounded-full transition-transform",
              isAnnual ? "translate-x-6" : "translate-x-0"
            )} />
          </button>
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", isAnnual ? "text-zinc-900" : "text-zinc-400")}>Annuale</span>
            <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Risparmia 20%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <Card key={plan.name} className={cn(
            "relative flex flex-col p-8 space-y-6 transition-all hover:shadow-xl",
            plan.popular ? "border-2 border-zinc-900 shadow-lg scale-105 z-10" : "border border-zinc-200"
          )}>
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest">
                Più Popolare
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-zinc-500">{plan.description}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">€{isAnnual ? plan.annualPrice : plan.monthlyPrice}</span>
              <span className="text-zinc-400 text-sm">/mese</span>
            </div>
            <Button className={cn("w-full py-4 rounded-2xl", plan.popular ? "bg-zinc-900" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200")}>
              {plan.monthlyPrice === 0 ? "Inizia Gratis" : "Scegli Piano"}
            </Button>
            <div className="space-y-3 pt-4">
              {featureMatrix.map(f => {
                const val = f[plan.name.toLowerCase() as keyof typeof f];
                if (typeof val === 'string') {
                  return (
                    <div key={f.name} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium">{f.name}:</span>
                      <span className="text-zinc-500">{val}</span>
                    </div>
                  );
                }
                return (
                  <div key={f.name} className="flex items-center gap-2 text-sm">
                    {val ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span className={cn("font-medium", !val && "text-zinc-400 line-through")}>{f.name}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
};

// --- Admin Dashboard ---
const AdminDashboard = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedUsers = snapshot.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      setUsers(sortedUsers);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    return unsubscribe;
  }, []);

  const updatePlan = async (uid: string, plan: SubscriptionPlan) => {
    try {
      await updateDoc(doc(db, 'users', uid), { plan });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-zinc-400" /></div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pannello Amministratore</h2>
          <p className="text-zinc-500">Monitora gli utenti e i loro piani di abbonamento.</p>
        </div>
        <div className="bg-violet-100 text-violet-700 px-4 py-2 rounded-2xl flex items-center gap-2 font-bold self-start">
          <ShieldCheck className="w-5 h-5" />
          Admin Mode
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {users.map(u => (
          <Card key={u.uid} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center font-bold shadow-md">
                {u.displayName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{u.displayName}</h3>
                <p className="text-sm text-zinc-500">{u.email}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <Badge variant="default" className="text-[10px] uppercase tracking-wider px-2 py-0.5">{USER_ROLE_LABELS[u.role] || u.role}</Badge>
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(u.createdAt?.toDate?.() || new Date(), 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-zinc-50 p-2 rounded-2xl border border-zinc-100">
              {(['starter', 'pro', 'enterprise'] as SubscriptionPlan[]).map(p => (
                <button
                  key={p}
                  onClick={() => updatePlan(u.uid, p)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-widest border",
                    u.plan === p 
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-lg scale-105" 
                      : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400 hover:text-zinc-600"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'project' | 'pricing' | 'admin'>('dashboard');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || 'Utente',
            role: 'investor',
            plan: 'starter',
            createdAt: Timestamp.now(),
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error('Login error', e);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setView('dashboard');
    setCurrentProject(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-xl">
              <LayoutDashboard className="text-white w-8 h-8" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">EdilGest AI</h1>
            <p className="text-zinc-500 text-lg">Gestionale cantieri per investitori immobiliari.</p>
          </div>
          <Button onClick={login} className="w-full py-4 text-lg rounded-2xl" icon={UserIcon}>
            Accedi con Google
          </Button>
          <p className="text-xs text-zinc-400">
            Accedendo accetti i termini di servizio per la gestione dei tuoi progetti immobiliari.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
        {/* Navigation */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-bottom border-zinc-200 px-4 md:px-6 py-3 md:py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => { setView('dashboard'); setCurrentProject(null); }}>
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="text-white w-4 h-4" />
              </div>
              <span className="font-bold text-lg md:text-xl tracking-tight">EdilGest AI</span>
            </div>

            <Button 
              onClick={() => setView('pricing')} 
              className="bg-violet-50 hover:bg-violet-100 text-violet-600 text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-2.5 md:px-3 py-0.5 md:py-1 rounded-full transition-all active:scale-95 border border-violet-100 shrink-0"
            >
              Upgrade
            </Button>

            <div className="flex items-center gap-4">
              {(profile?.role === 'admin' || user?.email === 'mecocci.mirko@gmail.com') && (
                <button 
                  onClick={() => setView('admin')}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    view === 'admin' ? "bg-violet-100 text-violet-600" : "text-zinc-400 hover:bg-zinc-100"
                  )}
                  title="Pannello Admin"
                >
                  <ShieldCheck className="w-5 h-5" />
                </button>
              )}
              <NotificationCenter />
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold">{profile?.displayName}</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">{profile?.role ? USER_ROLE_LABELS[profile.role] || profile.role : ''}</span>
              </div>
              <Button variant="ghost" onClick={logout} icon={LogOut} className="p-2 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-colors">
                <span className="hidden md:inline">Esci</span>
              </Button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <Dashboard 
                key="dashboard" 
                onProjectSelect={(p) => { setCurrentProject(p); setView('project'); }} 
                error={error}
                setError={setError}
              />
            ) : view === 'pricing' ? (
              <PricingView key="pricing" onBack={() => setView('dashboard')} />
            ) : view === 'admin' ? (
              <AdminDashboard key="admin" />
            ) : (
              <ProjectDetail 
                key="project" 
                project={currentProject!} 
                onBack={() => { setView('dashboard'); setCurrentProject(null); }} 
                error={error}
                setError={setError}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

// --- Dashboard View ---

function Dashboard({ 
  onProjectSelect, 
  error, 
  setError 
}: { 
  onProjectSelect: (p: Project) => void, 
  error: string | null, 
  setError: (e: string | null) => void 
}) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isMobileAccessOpen, setIsMobileAccessOpen] = useState(false);
  const [isImportingProject, setIsImportingProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    
    let projectsOwner: Project[] = [];
    let projectsMember: Project[] = [];

    const updateProjects = () => {
      const allProjects = [...projectsOwner];
      projectsMember.forEach(p => {
        if (!allProjects.find(ap => ap.id === p.id)) {
          allProjects.push(p);
        }
      });
      
      const sortedProjects = allProjects.sort((a, b) => {
        const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      setProjects(sortedProjects);
    };

    const qOwner = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsubscribeOwner = onSnapshot(qOwner, (snapshot) => {
      projectsOwner = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      updateProjects();
    }, (err) => {
      console.error("Error loading owned projects:", err);
      handleFirestoreError(err, OperationType.LIST, 'projects');
    });

    const qMember = query(collection(db, 'projects'), where('memberIds', 'array-contains', user.uid));
    const unsubscribeMember = onSnapshot(qMember, (snapshot) => {
      projectsMember = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      updateProjects();
    }, (err) => {
      console.error("Error loading member projects:", err);
      handleFirestoreError(err, OperationType.LIST, 'projects');
    });

    return () => {
      unsubscribeOwner();
      unsubscribeMember();
    };
  }, [user]);

  useEffect(() => {
    if (projects.length > 0 && error === "Errore nel caricamento dei progetti.") {
      setError(null);
    }
  }, [projects.length, error, setError]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !user) return;
    setError(null);
    setIsCreatingProject(true);
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name: newName,
        address: newAddress,
        ownerId: user.uid,
        memberIds: [user.uid],
        status: 'planning',
        createdAt: serverTimestamp(),
      });

      // Create default "General" conversation
      await addDoc(collection(db, 'projects', docRef.id, 'conversations'), {
        projectId: docRef.id,
        participantIds: [user.uid],
        isGroup: true,
        name: 'Generale',
        createdAt: serverTimestamp(),
      });
      const newProject: Project = {
        id: docRef.id,
        name: newName,
        address: newAddress,
        ownerId: user.uid,
        memberIds: [user.uid],
        status: 'planning',
        createdAt: Timestamp.now(), // Local fallback
      };
      setNewName('');
      setNewAddress('');
      setIsAddingProject(false);
      onProjectSelect(newProject);
    } catch (err) {
      setError("Errore nella creazione del progetto. Riprova.");
      handleFirestoreError(err, OperationType.CREATE, 'projects');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;
    setError(null);
    try {
      // In a real app, we should also delete subcollections (tasks, docs, etc.)
      // Firestore doesn't delete subcollections automatically when a doc is deleted.
      // For this demo, we'll just delete the project doc.
      await deleteDoc(doc(db, 'projects', projectId));
      setProjectToDelete(null);
    } catch (err) {
      setError("Errore durante l'eliminazione del progetto.");
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  const handleExportProject = async (project: Project) => {
    setError(null);
    try {
      // Helper to serialize Firestore data (handling Timestamps)
      const serialize = (data: any) => {
        if (!data) return data;
        const result = { ...data };
        Object.keys(result).forEach(key => {
          if (result[key] instanceof Timestamp) {
            result[key] = { _isTimestamp: true, seconds: result[key].seconds, nanoseconds: result[key].nanoseconds };
          } else if (Array.isArray(result[key])) {
            result[key] = result[key].map((item: any) => typeof item === 'object' ? serialize(item) : item);
          } else if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = serialize(result[key]);
          }
        });
        return result;
      };

      // Fetch all tasks for this project
      const tasksSnap = await getDocs(collection(db, 'projects', project.id, 'tasks'));
      const tasks = tasksSnap.docs.map(d => serialize(d.data()));

      // Fetch all documents for this project
      const docsSnap = await getDocs(collection(db, 'projects', project.id, 'documents'));
      const documents = docsSnap.docs.map(d => serialize(d.data()));

      // Fetch all conversations
      const convsSnap = await getDocs(collection(db, 'projects', project.id, 'conversations'));
      const conversations = [];
      
      for (const convDoc of convsSnap.docs) {
        const convData = convDoc.data();
        const messagesSnap = await getDocs(collection(db, 'projects', project.id, 'conversations', convDoc.id, 'messages'));
        const messages = messagesSnap.docs.map(d => serialize(d.data()));
        conversations.push({
          ...serialize(convData),
          messages
        });
      }

      const exportData = {
        project: serialize({ ...project, id: undefined }), // Remove ID to allow clean import
        tasks,
        documents,
        conversations,
        exportedAt: new Date().toISOString(),
        version: "1.2"
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EdilGest_Export_${project.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Errore durante l'esportazione del progetto. Controlla la console per i dettagli.");
      handleFirestoreError(err, OperationType.GET, `projects/${project.id}/export`);
    }
  };

  const handleImportProject = async (file: File) => {
    if (!user) return;
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.project || !data.project.name) {
        throw new Error("Formato file non valido.");
      }

      // Helper to deserialize Firestore data (handling Timestamps)
      const deserialize = (data: any) => {
        if (!data) return data;
        const result = { ...data };
        Object.keys(result).forEach(key => {
          if (result[key] && result[key]._isTimestamp) {
            result[key] = new Timestamp(result[key].seconds, result[key].nanoseconds);
          } else if (Array.isArray(result[key])) {
            result[key] = result[key].map((item: any) => typeof item === 'object' ? deserialize(item) : item);
          } else if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = deserialize(result[key]);
          }
        });
        return result;
      };

      // Create new project
      const projectData = {
        ...deserialize(data.project),
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const projectRef = await addDoc(collection(db, 'projects'), projectData);

      // Import tasks
      if (data.tasks && Array.isArray(data.tasks)) {
        for (const task of data.tasks) {
          await addDoc(collection(db, 'projects', projectRef.id, 'tasks'), {
            ...deserialize(task),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Import docs metadata
      if (data.documents && Array.isArray(data.documents)) {
        for (const docData of data.documents) {
          await addDoc(collection(db, 'projects', projectRef.id, 'documents'), {
            ...deserialize(docData),
            createdAt: serverTimestamp()
          });
        }
      }

      // Import conversations and messages
      if (data.conversations && Array.isArray(data.conversations)) {
        for (const convData of data.conversations) {
          const { messages, ...convMeta } = convData;
          const convRef = await addDoc(collection(db, 'projects', projectRef.id, 'conversations'), {
            ...deserialize(convMeta),
            createdAt: serverTimestamp()
          });

          if (messages && Array.isArray(messages)) {
            for (const msg of messages) {
              await addDoc(collection(db, 'projects', projectRef.id, 'conversations', convRef.id, 'messages'), {
                ...deserialize(msg),
                timestamp: serverTimestamp()
              });
            }
          }
        }
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError("Errore durante l'importazione del progetto. Assicurati che il file sia un export valido di EdilGest AI.");
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">I tuoi Progetti</h2>
          <p className="text-zinc-500">Gestisci le tue operazioni immobiliari e i cantieri attivi.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".json" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportProject(file);
            }} 
          />
          <Button variant="outline" onClick={() => setIsMobileAccessOpen(true)} icon={Smartphone}>Mobile</Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={Upload}>Importa</Button>
          <Button onClick={() => setIsAddingProject(true)} icon={Plus}>Nuovo Progetto</Button>
        </div>
      </div>

      {/* Mobile Access Modal */}
      <AnimatePresence>
        {isMobileAccessOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Accesso Mobile</h3>
                <p className="text-zinc-500 text-sm">Scansiona il QR Code per portare EdilGest AI in cantiere con te.</p>
              </div>
              
              <div className="bg-zinc-50 p-4 rounded-2xl inline-block border border-zinc-100">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href.replace('-dev-', '-pre-'))}`} 
                  alt="QR Code" 
                  className="w-48 h-48 mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-4">
                <div className="text-xs text-zinc-400 bg-zinc-50 p-3 rounded-xl text-left">
                  <p className="font-bold text-zinc-600 mb-1">Pro-tip:</p>
                  Una volta aperto sul cellulare, usa "Aggiungi alla schermata Home" per usarlo come un'app nativa.
                </div>
                <Button variant="secondary" className="w-full" onClick={() => setIsMobileAccessOpen(false)}>Chiudi</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full transition-colors">
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => (
          <Card key={project.id} onClick={() => onProjectSelect(project)} className="relative overflow-hidden group cursor-pointer">
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-1.5",
              project.status === 'active' ? "bg-emerald-500" : 
              project.status === 'planning' ? "bg-sky-500" : 
              project.status === 'completed' ? "bg-zinc-400" : "bg-amber-500"
            )} />
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <Badge variant={
                  project.status === 'active' ? 'success' : 
                  project.status === 'planning' ? 'info' : 
                  project.status === 'completed' ? 'default' : 'warning'
                }>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleExportProject(project); }}
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                    title="Esporta Progetto"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title="Elimina Progetto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-900 transition-colors ml-1" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold leading-tight">{project.name}</h3>
                <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  {format(project.createdAt?.toDate?.() || new Date(), 'dd MMM yyyy')}
                </p>
              </div>
              <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Attività in corso...</span>
                </div>
                <div className="flex -space-x-2">
                  {[1, 2].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full bg-zinc-200 border-2 border-white flex items-center justify-center text-[8px] font-bold">
                      OP
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isAddingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
           >
            <h3 className="text-2xl font-bold">Crea Nuovo Progetto</h3>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-400">Nome Progetto</label>
                <input 
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  placeholder="es: Via Garibaldi 118"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-400">Indirizzo</label>
                <input 
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  placeholder="es: Milano, MI"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsAddingProject(false)} className="flex-1" disabled={isCreatingProject}>Annulla</Button>
                <Button type="submit" className="flex-1" loading={isCreatingProject}>Crea</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
           >
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">Elimina Progetto?</h3>
              <p className="text-zinc-500 text-sm">
                Sei sicuro di voler eliminare <strong>{projectToDelete.name}</strong>? 
                Questa azione è irreversibile e perderai tutti i dati caricati (attività, chat).
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => setProjectToDelete(null)} className="flex-1">Annulla</Button>
              <Button variant="danger" onClick={() => handleDeleteProject(projectToDelete.id)} className="flex-1">Elimina Definitivamente</Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// --- Project Detail View ---

// --- Task Detail Modal ---

function TaskDetailModal({ 
  task, 
  onClose, 
  projectId,
  onViewImage
}: { 
  task: Task, 
  onClose: () => void, 
  projectId: string,
  onViewImage?: (url: string, title: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [loading, setLoading] = useState(false);
  const [newFiles, setNewFiles] = useState<AttachedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setUploadProgress({});
    setNewFiles([]);
    setIsEditing(false);
    setEditedTask(task);
  }, [task.id]);


  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setUploadProgress({});
    
    try {
      console.log('[handleSave] Starting save process...');
      
      let updatedAttachments = [...(editedTask.attachments || [])];

      // Handle New File Uploads
      if (newFiles.length > 0) {
        const uploadPromises = newFiles
          .filter(f => f.status === 'ready')
          .map(async (fileObj) => {
            const fileId = Math.random().toString(36).substring(7);
            const sanitizedFileName = fileObj.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `projects/${projectId}/tasks/${task.id}/${fileId}_${sanitizedFileName}`;
            const sRef = ref(storage, storagePath);
            
            try {
              const downloadUrl = await uploadFileWithFallback(
                sRef, 
                fileObj.file, 
                (progress) => {
                  setUploadProgress(prev => ({ ...prev, [fileObj.id]: progress }));
                }
              );
              
              return {
                id: fileId,
                name: fileObj.file.name,
                url: downloadUrl,
                type: fileObj.file.type,
                size: fileObj.file.size,
                uploadedAt: Timestamp.now()
              } as TaskAttachment;
            } catch (uploadErr) {
              console.error(`Failed to upload ${fileObj.file.name}:`, uploadErr);
              return null;
            }
          });

        const results = await Promise.all(uploadPromises);
        const newUploaded = results.filter((r): r is TaskAttachment => r !== null);
        updatedAttachments = [...updatedAttachments, ...newUploaded];
      }

      const { id, projectId: pId, ...updateData } = editedTask;
      
      // Clean undefined values to prevent Firestore errors
      const cleanUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
      
      const updatePayload: any = {
        ...cleanUpdateData,
        attachments: updatedAttachments,
        projectId, // Ensure projectId is present for rules
        updatedAt: serverTimestamp(),
      };

      console.log('[handleSave] Updating Firestore document...', { projectId, taskId: task.id, updatePayload });
      
      const taskPath = `projects/${projectId}/tasks/${task.id}`;
      try {
        await updateDoc(doc(db, 'projects', projectId, 'tasks', task.id), updatePayload);
        console.log('[handleSave] Firestore update successful.');
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.UPDATE, taskPath);
      }
      setIsEditing(false);
      setNewFiles([]);
      onClose();
    } catch (err: any) {
      console.error('Error in handleSave:', err);
      let message = 'Errore durante il salvataggio.';
      
      if (err.message?.toLowerCase().includes('too large') || err.message?.toLowerCase().includes('limit exceeded')) {
        message = "Il documento è troppo grande. Riduci il numero di allegati o la lunghezza dei testi.";
      } else if (err.message?.includes('STORAGE_TIMEOUT') || err.message?.includes('STORAGE NON ABILITATO') || err.message?.includes('PERMESSO NEGATO')) {
        // Mostra l'errore completo di Firebase Storage con le istruzioni
        message = err.message;
      } else if (err.message?.includes('storage/')) {
        message = "Errore Firebase Storage: Verifica che Storage sia abilitato nella console Firebase e che le regole di sicurezza siano corrette.";
      } else {
        try {
          const parsed = JSON.parse(err.message);
          message = `Errore: ${parsed.error}`;
        } catch {
          message = err.message || message;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const formatDateForInput = (ts?: any) => {
    if (!ts) return '';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (field: keyof Task, value: string) => {
    setEditedTask(prev => ({
      ...prev,
      [field]: value ? Timestamp.fromDate(new Date(value)) : null
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl p-0 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex justify-between items-start bg-zinc-50">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-2">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <select 
                    value={editedTask.priority}
                    onChange={e => setEditedTask({ ...editedTask, priority: e.target.value as TaskPriority })}
                    className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-zinc-200 bg-white outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  >
                    {Object.entries(TASK_PRIORITY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <div className="space-y-2 mt-4">
                    <label className="text-xs font-bold uppercase text-zinc-400">Categoria / Professionista</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Object.entries(TASK_CATEGORY_LABELS).map(([val, label]) => {
                        const Icon = TASK_CATEGORY_ICONS[val as TaskCategory];
                        const isSelected = editedTask.category === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setEditedTask({ ...editedTask, category: val as TaskCategory })}
                            className={cn(
                              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all gap-1",
                              isSelected 
                                ? cn("ring-2 ring-zinc-900 border-transparent", TASK_CATEGORY_COLORS[val as TaskCategory])
                                : "border-zinc-100 hover:border-zinc-200 bg-white text-zinc-500"
                            )}
                          >
                            <Icon className={cn("w-4 h-4", isSelected ? "" : "text-zinc-400")} />
                            <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Badge variant={
                    task.priority === 'high' ? 'error' : 
                    task.priority === 'medium' ? 'warning' : 'info'
                  }>
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                  <Badge className={cn(
                    "flex items-center gap-1",
                    TASK_CATEGORY_COLORS[task.category || 'altro']
                  )}>
                    {(() => {
                      const Icon = TASK_CATEGORY_ICONS[task.category || 'altro'];
                      return <Icon className="w-3 h-3" />;
                    })()}
                    {task.category ? TASK_CATEGORY_LABELS[task.category] : 'Altro'}
                  </Badge>
                </>
              )}
            </div>
            {isEditing ? (
              <input 
                autoFocus
                className="text-2xl font-bold w-full px-3 py-1 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all bg-white"
                value={editedTask.title}
                onChange={e => setEditedTask({ ...editedTask, title: e.target.value })}
              />
            ) : (
              <h3 className="text-2xl font-bold">{task.title}</h3>
            )}
          </div>
          <Button variant="ghost" onClick={onClose} className="p-2 rounded-full">
            <Plus className="w-6 h-6 rotate-45" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{error}</div>
            </motion.div>
          )}

          {/* Work Detail & Agreements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Dettaglio Lavoro</span>
              </div>
              {isEditing ? (
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 min-h-[120px] outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
                  placeholder="Descrivi in dettaglio il lavoro da svolgere..."
                  value={editedTask.workDetail || ''}
                  onChange={e => setEditedTask({ ...editedTask, workDetail: e.target.value })}
                />
              ) : (
                <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                  {task.workDetail || 'Nessun dettaglio specificato.'}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Accordi con Impresa</span>
              </div>
              {isEditing ? (
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 min-h-[120px] outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
                  placeholder="Specifica gli accordi presi, garanzie, ecc..."
                  value={editedTask.agreements || ''}
                  onChange={e => setEditedTask({ ...editedTask, agreements: e.target.value })}
                />
              ) : (
                <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                  {task.agreements || 'Nessun accordo specificato.'}
                </p>
              )}
            </div>
          </div>

          {/* Times & Costs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-100">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Tempi</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Inizio</label>
                  {isEditing ? (
                    <input 
                      type="date"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none"
                      value={formatDateForInput(editedTask.startDate)}
                      onChange={e => handleDateChange('startDate', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{task.startDate?.toDate?.() ? format(task.startDate.toDate(), 'dd/MM/yyyy') : '-'}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Fine</label>
                  {isEditing ? (
                    <input 
                      type="date"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none"
                      value={formatDateForInput(editedTask.endDate)}
                      onChange={e => handleDateChange('endDate', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{task.endDate?.toDate?.() ? format(task.endDate.toDate(), 'dd/MM/yyyy') : '-'}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2 text-zinc-400">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Costi</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Stimato (€)</label>
                  {isEditing ? (
                    <input 
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none"
                      value={editedTask.estimatedCost || ''}
                      onChange={e => setEditedTask({ ...editedTask, estimatedCost: Number(e.target.value) })}
                    />
                  ) : (
                    <p className="text-sm font-bold text-emerald-600">€{(task.estimatedCost || 0).toLocaleString()}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Effettivo (€)</label>
                  {isEditing ? (
                    <input 
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none"
                      value={editedTask.actualCost || ''}
                      onChange={e => setEditedTask({ ...editedTask, actualCost: Number(e.target.value) })}
                    />
                  ) : (
                    <p className="text-sm font-bold text-zinc-900">€{(task.actualCost || 0).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            <div className="flex items-center gap-2 text-zinc-400">
              <Paperclip className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Allegati</span>
            </div>
            
            {isEditing && (
              <div className="mb-4">
                <FileAttacher 
                  onFilesChange={setNewFiles} 
                  disabled={loading}
                />
              </div>
            )}

            {editedTask.attachments && editedTask.attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {editedTask.attachments.map((att) => (
                  <div 
                    key={att.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-white hover:border-zinc-200 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-50 flex items-center justify-center border border-zinc-100 shrink-0">
                      {att.type.startsWith('image/') ? (
                        <ImageIcon className="w-5 h-5 text-zinc-400" />
                      ) : att.type.includes('pdf') ? (
                        <FileText className="w-5 h-5 text-rose-500" />
                      ) : (
                        <Paperclip className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-zinc-900">{att.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {att.type.split('/').pop()?.toUpperCase()} • {(att.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={att.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-900"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {att.type.startsWith('image/') && onViewImage && (
                        <button 
                          onClick={() => onViewImage(att.url, att.name)}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-900"
                        >
                          <ImageIcon size={14} />
                        </button>
                      )}
                      {isEditing && (
                        <button 
                          onClick={() => setEditedTask({
                            ...editedTask,
                            attachments: editedTask.attachments?.filter(a => a.id !== att.id)
                          })}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-zinc-300 hover:text-rose-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3">
          {isEditing ? (
            <>
              <Button 
                variant="secondary" 
                onClick={() => { 
                  setIsEditing(false); 
                  setEditedTask(task);
                }}
                disabled={loading}
              >
                Annulla
              </Button>
              <Button 
                onClick={handleSave} 
                loading={loading}
              >
                {loading ? 'Salvataggio...' : 'Salva Modifiche'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} icon={Edit2}>Modifica Dettagli</Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ProjectDetail({ 
  project, 
  onBack,
  error,
  setError
}: { 
  project: Project, 
  onBack: () => void,
  error: string | null,
  setError: (e: string | null) => void
}) {
  const { user, profile } = useAuth();
  const [currentProjectData, setCurrentProjectData] = useState<Project>(project);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  
  const [activeTab, setActiveTab] = useState<'tasks' | 'team' | 'chat' | 'documents' | 'quotes'>('tasks');
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingDocument, setIsAddingDocument] = useState(false);
  const [selectedViewerImage, setSelectedViewerImage] = useState<{ url: string, title: string } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('altro');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [newFiles, setNewFiles] = useState<AttachedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [newDocumentType, setNewDocumentType] = useState<DocumentType>('other');
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);
  const [newDocumentProfessionalId, setNewDocumentProfessionalId] = useState('');
  
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'editor' | 'viewer'>('viewer');

  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState(project.name);
  const [editedProjectAddress, setEditedProjectAddress] = useState(project.address || '');
  const [editedProjectBudget, setEditedProjectBudget] = useState(project.totalBudget || 0);

  const isFilesReady = newFiles.every(f => f.status !== 'compressing');

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProject(true);
    setError(null);
    try {
      console.log('Updating project:', project.id, {
        name: editedProjectName,
        address: editedProjectAddress,
        totalBudget: editedProjectBudget,
      });
      
      await updateDoc(doc(db, 'projects', project.id), {
        name: editedProjectName,
        address: editedProjectAddress,
        totalBudget: isNaN(Number(editedProjectBudget)) ? 0 : Number(editedProjectBudget),
        updatedAt: serverTimestamp(),
      });
      setIsEditingProject(false);
    } catch (err) {
      setError("Errore durante l'aggiornamento del progetto. Verifica di avere i permessi necessari.");
      console.error('Project update error:', err);
      // We don't call handleFirestoreError here to avoid throwing and potentially breaking the UI further,
      // but we log it for debugging.
    } finally {
      setIsSavingProject(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'projects', project.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Project;
        setCurrentProjectData({ id: snapshot.id, ...data });
        setEditedProjectName(data.name);
        setEditedProjectAddress(data.address || '');
        setEditedProjectBudget(data.totalBudget || 0);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${project.id}`));
    return unsubscribe;
  }, [project.id]);

  useEffect(() => {
    const q = query(collection(db, 'projects', project.id, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedTasks = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Task))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      setTasks(sortedTasks);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `projects/${project.id}/tasks`));
    return unsubscribe;
  }, [project.id]);

  useEffect(() => {
    const q = query(collection(db, 'memberships'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Membership)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'memberships'));
    return unsubscribe;
  }, [project.id]);


  useEffect(() => {
    const q = query(collection(db, 'projects', project.id, 'documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectDocument)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `projects/${project.id}/documents`));
    return unsubscribe;
  }, [project.id]);

  useEffect(() => {
    if (isAddingTask) {
      setError(null);
      setNewTaskTitle('');
      setNewTaskPriority('medium');
      setNewTaskCategory('altro');
      setNewTaskAssignedTo('');
      setNewFiles([]);
      setUploadProgress({});
    }
  }, [isAddingTask]);

  useEffect(() => {
    if (isAddingDocument) {
      setError(null);
      setNewDocumentTitle('');
      setNewDocumentType('other');
      setNewDocumentFile(null);
      setNewDocumentProfessionalId('');
      setUploadProgress({});
    }
  }, [isAddingDocument]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    setIsUploading(true);
    setError(null);
    setUploadProgress({});
    
    try {
      console.log('[handleAddTask] Creating task in Firestore...', { projectId: project.id, title: newTaskTitle });
      const tasksPath = `projects/${project.id}/tasks`;
      let taskRef;
      try {
        const taskData: any = {
          projectId: project.id,
          title: newTaskTitle,
          status: 'todo',
          priority: newTaskPriority,
          category: newTaskCategory,
          workDetail: '',
          agreements: '',
          estimatedCost: 0,
          actualCost: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (newTaskAssignedTo) taskData.assignedTo = newTaskAssignedTo;

        taskRef = await addDoc(collection(db, 'projects', project.id, 'tasks'), taskData);
        console.log('[handleAddTask] Task created successfully:', taskRef.id);

        // Handle File Uploads
        if (newFiles.length > 0) {
          const uploadPromises = newFiles
            .filter(f => f.status === 'ready')
            .map(async (fileObj) => {
              const fileId = Math.random().toString(36).substring(7);
              const sanitizedFileName = fileObj.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              const storagePath = `projects/${project.id}/tasks/${taskRef.id}/${fileId}_${sanitizedFileName}`;
              const sRef = ref(storage, storagePath);
              
              try {
                const downloadUrl = await uploadFileWithFallback(
                  sRef, 
                  fileObj.file, 
                  (progress) => {
                    setUploadProgress(prev => ({ ...prev, [fileObj.id]: progress }));
                  }
                );
                
                return {
                  id: fileId,
                  name: fileObj.file.name,
                  url: downloadUrl,
                  type: fileObj.file.type,
                  size: fileObj.file.size,
                  uploadedAt: Timestamp.now()
                } as TaskAttachment;
              } catch (uploadErr) {
                console.error(`Failed to upload ${fileObj.file.name}:`, uploadErr);
                return null;
              }
            });

          const results = await Promise.all(uploadPromises);
          const uploadedAttachments = results.filter((r): r is TaskAttachment => r !== null);

          if (uploadedAttachments.length > 0) {
            await updateDoc(taskRef, { attachments: uploadedAttachments });
          }
        }
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.CREATE, tasksPath);
      }

      // Create notification for the assigned user
      if (newTaskAssignedTo) {
        await addDoc(collection(db, 'notifications'), {
          userId: newTaskAssignedTo,
          title: 'Nuova Attività Assegnata',
          message: `Ti è stata assegnata l'attività "${newTaskTitle}" nel progetto "${project.name}".`,
          projectId: project.id,
          taskId: taskRef.id,
          read: false,
          type: 'info',
          createdAt: serverTimestamp(),
        });
      }
      
      // Reset form and close modal
      setNewTaskTitle('');
      setNewFiles([]);
      setIsAddingTask(false);
    } catch (err: any) {
      console.error('Error in handleAddTask:', err);
      let message = 'Errore durante la creazione dell\'attività.';
      
      // Gestione specifica per errori di dimensione Firestore
      if (err.message?.toLowerCase().includes('too large') || err.message?.toLowerCase().includes('limit exceeded')) {
        message = "Il file è troppo grande per il database (limite 1MB). Riduci la qualità o il numero di allegati.";
      } else if (err.message?.includes('STORAGE_TIMEOUT') || err.message?.includes('STORAGE NON ABILITATO') || err.message?.includes('PERMESSO NEGATO')) {
        // Mostra l'errore completo di Firebase Storage con le istruzioni
        message = err.message;
      } else if (err.message?.includes('storage/')) {
        message = "Errore Firebase Storage: Verifica che Storage sia abilitato nella console Firebase e che le regole di sicurezza siano corrette.";
      } else {
        try {
          const parsed = JSON.parse(err.message);
          message = `Errore: ${parsed.error}`;
        } catch {
          message = err.message || message;
        }
      }
      setError(message);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newDocumentTitle || !newDocumentFile) return;
  
  setIsUploading(true);
  setError(null);
  setUploadProgress({});
  
  try {
    console.log('[handleAddDocument] Starting upload...', { title: newDocumentTitle, fileName: newDocumentFile.name });
    
    // ✅ Step 1: Valida il file
    validateFile(newDocumentFile);
    
    // ✅ Step 2: Upload del file
    const fileId = Math.random().toString(36).substring(7);
    const sanitizedName = newDocumentFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storagePath = `projects/${project.id}/documents/${Date.now()}_${fileId}_${sanitizedName}`;
    const sRef = ref(storage, storagePath);
    
    console.log('[handleAddDocument] Uploading file to Storage...');
    const downloadUrl = await uploadFileWithFallback(
      sRef, 
      newDocumentFile, 
      (progress) => {
        setUploadProgress(prev => ({ ...prev, doc: progress }));
      }
    );
    console.log('[handleAddDocument] File uploaded successfully:', downloadUrl);

    // ✅ Step 3: Prepara i dati del documento
    const professional = members.find(m => m.id === newDocumentProfessionalId);
    const docData = {
      projectId: project.id,
      title: newDocumentTitle,
      type: newDocumentType,
      url: downloadUrl,
      professionalId: newDocumentProfessionalId || null,
      professionalEmail: professional?.userEmail || null,
      uploadedBy: user?.email || 'unknown',
      createdAt: serverTimestamp(),
    };

    // ✅ Step 4: Salva in Firestore (IMPORTANTE: ATTENDERE)
    console.log('[handleAddDocument] Saving to Firestore...', docData);
    await addDoc(collection(db, 'projects', project.id, 'documents'), docData);
    console.log('[handleAddDocument] Document saved successfully!');
    
    // ✅ Step 5: Resetta il form SOLO dopo il successo
    setNewDocumentTitle('');
    setNewDocumentFile(null);
    setNewDocumentType('other');
    setNewDocumentProfessionalId('');
    setIsAddingDocument(false);
    setUploadProgress({});
    
  } catch (err: any) {
    console.error('Error in handleAddDocument:', err);
    let message = 'Errore durante il caricamento del documento.';
    
    if (err.message?.toLowerCase().includes('too large') || err.message?.toLowerCase().includes('limit exceeded')) {
      message = "Il file è troppo grande per il database (limite 1MB).";
    } else if (err.message?.includes('STORAGE_TIMEOUT') || err.message?.includes('STORAGE NON ABILITATO') || err.message?.includes('PERMESSO NEGATO')) {
      // Mostra l'errore completo di Firebase Storage con le istruzioni
      message = err.message;
    } else if (err.message?.includes('storage/')) {
      message = "Errore Firebase Storage: Verifica che Storage sia abilitato nella console Firebase e che le regole di sicurezza siano corrette.";
    } else {
      try {
        const parsed = JSON.parse(err.message);
        message = `Errore: ${parsed.error}`;
      } catch {
        message = err.message || message;
      }
    }
    setError(message);
  } finally {
    setIsUploading(false);
    setUploadProgress({});
  }
};


  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento?")) return;
    try {
      await deleteDoc(doc(db, 'projects', project.id, 'documents', docId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${project.id}/documents/${docId}`);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail) return;
    try {
      // Search for the user by email
      const userQuery = query(collection(db, 'users'), where('email', '==', newMemberEmail));
      const userSnapshot = await getDocs(userQuery);
      
      let targetUserId = '';
      if (!userSnapshot.empty) {
        targetUserId = userSnapshot.docs[0].id;
      } else {
        setError("Utente non trovato. Assicurati che l'utente si sia già registrato nell'app.");
        return;
      }

      // Update project memberIds
      const currentMemberIds = currentProjectData.memberIds || [project.ownerId];
      if (!currentMemberIds.includes(targetUserId)) {
        await updateDoc(doc(db, 'projects', project.id), {
          memberIds: [...currentMemberIds, targetUserId]
        });
      }

      // Use a consistent ID for memberships to match rules: userId + "_" + projectId
      const membershipId = `${targetUserId}_${project.id}`;
      await setDoc(doc(db, 'memberships', membershipId), {
        projectId: project.id,
        userId: targetUserId,
        userEmail: newMemberEmail,
        role: newMemberRole,
      });

      // Create notification for the new member
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        title: 'Nuovo Progetto',
        message: `Sei stato aggiunto al progetto "${project.name}" come ${newMemberRole === 'editor' ? 'Collaboratore' : 'Visualizzatore'}.`,
        projectId: project.id,
        read: false,
        type: 'info',
        createdAt: serverTimestamp(),
      });
      
      // Add to "Generale" conversation
      const convQuery = query(
        collection(db, 'projects', project.id, 'conversations'),
        where('name', '==', 'Generale'),
        limit(1)
      );
      const convSnapshot = await getDocs(convQuery);
      if (!convSnapshot.empty) {
        const convDoc = convSnapshot.docs[0];
        const currentParticipants = convDoc.data().participantIds || [];
        if (!currentParticipants.includes(targetUserId)) {
          await updateDoc(doc(db, 'projects', project.id, 'conversations', convDoc.id), {
            participantIds: [...currentParticipants, targetUserId]
          });
        }
      }

      setNewMemberEmail('');
      setIsAddingMember(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'memberships');
    }
  };

  const handleRemoveMember = async (membershipId: string, memberUserId: string) => {
    if (!window.confirm("Sei sicuro di voler rimuovere questo collaboratore?")) return;
    try {
      // Remove from memberships
      await deleteDoc(doc(db, 'memberships', membershipId));
      
      // Remove from project memberIds
      const newMemberIds = (currentProjectData.memberIds || []).filter(id => id !== memberUserId);
      await updateDoc(doc(db, 'projects', project.id), {
        memberIds: newMemberIds
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'memberships');
    }
  };

  const toggleTask = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await updateDoc(doc(db, 'projects', project.id, 'tasks', task.id), { status: newStatus });
      
      // Notify owner if task is completed by someone else
      if (newStatus === 'done' && user?.uid !== project.ownerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: project.ownerId,
          title: 'Attività Completata',
          message: `L'attività "${task.title}" è stata completata da ${profile?.displayName || user?.email}.`,
          projectId: project.id,
          taskId: task.id,
          read: false,
          type: 'success',
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'tasks');
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await updateDoc(doc(db, 'projects', project.id, 'tasks', taskId), { status });
      
      // Notify owner if task is completed by someone else
      if (status === 'done' && user?.uid !== project.ownerId) {
        // We need the task title, but we only have taskId.
        // For simplicity, we'll just say "Un'attività" or we could fetch it.
        // Let's try to find it in the local state if possible, but we don't have tasks here.
        // Actually, we can just fetch it quickly.
        const taskDoc = await getDoc(doc(db, 'projects', project.id, 'tasks', taskId));
        if (taskDoc.exists()) {
          const taskData = taskDoc.data();
          await addDoc(collection(db, 'notifications'), {
            userId: project.ownerId,
            title: 'Attività Completata',
            message: `L'attività "${taskData.title}" è stata completata da ${profile?.displayName || user?.email}.`,
            projectId: project.id,
            taskId: taskId,
            read: false,
            type: 'success',
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'tasks');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'projects', project.id, 'tasks', taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'tasks');
    }
  };

  const filteredTasks = tasks.filter(t => filter === 'all' || t.status === filter);
  const completionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0;

  const totalEstimatedCost = tasks.reduce((sum, t) => sum + (t.estimatedCost || 0), 0);
  const totalActualCost = tasks.reduce((sum, t) => sum + (t.actualCost || 0), 0);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </motion.div>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} icon={ArrowLeft} className="p-2 rounded-full" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{currentProjectData.name}</h2>
            <Button variant="ghost" onClick={() => setIsEditingProject(true)} className="p-1 h-auto"><Edit2 className="w-4 h-4 text-zinc-400" /></Button>
          </div>
          <p className="text-zinc-500 text-sm md:text-base truncate">{currentProjectData.address || 'Nessun indirizzo specificato'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setActiveTab('team')} icon={Users} className="hidden md:flex">Team</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 overflow-x-auto no-scrollbar -mx-6 px-6 scroll-smooth">
        {[
          { id: 'tasks', label: 'Attivita', icon: CheckSquare },
          { id: 'documents', label: 'Documenti', icon: FolderOpen },
          { id: 'quotes', label: 'Preventivi', icon: Scale },
          { id: 'team', label: 'Team', fullLabel: 'Team e Professionisti', icon: Users },
          { id: 'chat', label: 'Chat', icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold transition-all border-b-2 -mb-px whitespace-nowrap shrink-0",
              activeTab === tab.id 
                ? "border-zinc-900 text-zinc-900" 
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            <tab.icon className="w-3.5 h-3.5 md:w-4 h-4" />
            <span className="hidden sm:inline">{tab.fullLabel || tab.label}</span>
            <span className="sm:hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Stats & Info */}
        <div className="space-y-6">
          <Card className="bg-zinc-900 text-white border-none">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Avanzamento</span>
                <span className="text-2xl font-bold">{completionRate}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Costo Stimato</span>
                  <p className="text-lg font-bold">€{totalEstimatedCost.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Budget Progetto</span>
                  <p className="text-lg font-bold text-emerald-400">€{(currentProjectData.totalBudget || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Spesa Effettiva</span>
                  <p className="text-lg font-bold text-sky-400">€{totalActualCost.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Margine Residuo</span>
                  <p className={cn(
                    "text-lg font-bold",
                    ((currentProjectData.totalBudget || 0) - totalActualCost) >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    €{((currentProjectData.totalBudget || 0) - totalActualCost).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Attività</span>
                  <p className="text-lg font-bold">{tasks.length}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h4 className="font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              Team di Progetto
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[10px] font-bold">IO</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">Tu (Proprietario)</p>
                  <p className="text-[10px] text-zinc-400 uppercase">Investitore</p>
                </div>
              </div>
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-[10px] font-bold">
                    {m.userEmail?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{m.userEmail}</p>
                    <p className="text-[10px] text-zinc-400 uppercase">{m.role}</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setActiveTab('team')} className="w-full text-xs py-2">Gestisci Team</Button>
            </div>
          </Card>
        </div>

        {/* Right: Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'tasks' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  {(['all', 'todo', 'in-progress', 'blocked', 'done'] as const).map(s => (
                    <button 
                      key={s}
                      onClick={() => setFilter(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0",
                        filter === s ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      {TASK_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <Button onClick={() => setIsAddingTask(true)} icon={Plus} className="w-full sm:w-auto shrink-0 py-3 sm:py-2">
                  Nuova Attività
                </Button>
              </div>

              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
                    <CheckSquare className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-400">Nessuna attività trovata.</p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <Card 
                      key={task.id} 
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        "p-2 flex items-center gap-3 group overflow-hidden hover:bg-zinc-50 transition-colors",
                        task.status === 'done' && "opacity-60"
                      )}
                    >
                      {/* Compact Image/Icon */}
                      <div className="shrink-0">
                        {task.imageUrl ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-100">
                            <ImageWithFallback 
                              src={task.imageUrl} 
                              alt={task.title} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center border",
                            TASK_CATEGORY_COLORS[task.category || 'altro']
                          )}>
                            {(() => {
                              const Icon = TASK_CATEGORY_ICONS[task.category || 'altro'];
                              return <Icon className="w-5 h-5" />;
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Checkbox */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(task);
                        }} 
                        className="shrink-0"
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-md border-2 border-zinc-200 group-hover:border-zinc-400 transition-colors" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn("text-sm font-bold truncate", task.status === 'done' && "line-through")}>{task.title}</h4>
                          <Badge variant={
                            task.priority === 'high' ? 'error' : 
                            task.priority === 'medium' ? 'warning' : 'info'
                          } className="text-[9px] px-1.5 py-0 h-4">
                            {TASK_PRIORITY_LABELS[task.priority]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <select 
                            value={task.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task.id, e.target.value as TaskStatus);
                            }}
                            className="text-[9px] font-bold uppercase text-zinc-400 bg-transparent outline-none cursor-pointer hover:text-zinc-900"
                          >
                            <option value="todo">Da fare</option>
                            <option value="in-progress">In corso</option>
                            <option value="blocked">Bloccato</option>
                            <option value="done">Fatto</option>
                          </select>
                          <span className="text-[9px] text-zinc-300">|</span>
                          <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-1">
                            <HardHat className="w-2.5 h-2.5" />
                            {task.category ? TASK_CATEGORY_LABELS[task.category] : 'Generico'}
                          </span>
                          {task.assignedTo && (
                            <>
                              <span className="text-[9px] text-zinc-300">|</span>
                              <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-1 truncate max-w-[100px]">
                                <UserIcon className="w-2.5 h-2.5" />
                                {task.assignedTo}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }} 
                          className="p-1.5 h-auto text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Documenti di Progetto</h3>
              <button
                onClick={() => setIsAddingDocument(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Carica Documento
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                <FolderOpen className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">Nessun documento caricato per questo progetto.</p>
                <button
                  onClick={() => setIsAddingDocument(true)}
                  className="mt-4 text-zinc-900 font-medium hover:underline"
                >
                  Carica il primo documento
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => {
                  const Icon = (() => {
                    switch (doc.type) {
                      case 'photo': return ImageIcon;
                      case 'contract': return ShieldCheck;
                      case 'permit': return Scale;
                      case 'quote': return Calculator;
                      default: return FileText;
                    }
                  })();

                  return (
                    <motion.div
                      key={doc.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-4 rounded-2xl border border-zinc-200 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-zinc-50 rounded-xl">
                          <Icon className="w-6 h-6 text-zinc-600" />
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600"
                            title="Visualizza"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <a
                            href={doc.url}
                            download
                            className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600"
                            title="Scarica"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-medium text-zinc-900 mb-1 truncate" title={doc.title}>
                        {doc.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="px-2 py-0.5 bg-zinc-100 rounded-full">
                          {DOCUMENT_TYPE_LABELS[doc.type]}
                        </span>
                        <span>•</span>
                        <span>{format(doc.createdAt instanceof Timestamp ? doc.createdAt.toDate() : new Date(), 'dd MMM yyyy')}</span>
                      </div>
                      {doc.professionalEmail && (
                        <div className="mt-3 pt-3 border-t border-zinc-50 flex items-center gap-2 text-xs text-zinc-500">
                          <Users className="w-3 h-3" />
                          <span className="truncate">{doc.professionalEmail}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {activeTab === 'quotes' && (
          <QuoteAnalyzer projectId={project.id} userId={user?.uid || ''} />
        )}

        {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Team e Collaboratori</h3>
                {user?.uid === project.ownerId && (
                  <Button onClick={() => setIsAddingMember(true)} icon={Plus}>Invita Professionista</Button>
                )}
              </div>
              
              <div className="space-y-3">
                <Card className="flex items-center gap-4 p-4 border-l-4 border-l-zinc-900">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-white font-bold">IO</div>
                  <div className="flex-1">
                    <p className="font-bold">Tu (Proprietario)</p>
                    <p className="text-xs text-zinc-500">Investitore Immobiliare</p>
                  </div>
                  <Badge variant="success">Proprietario</Badge>
                </Card>
                
                {members.filter(m => m.userId !== project.ownerId).map(m => (
                  <Card key={m.id} className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{m.userEmail}</p>
                      <p className="text-xs text-zinc-500">{m.role === 'editor' ? 'Collaboratore' : 'Visualizzatore'}</p>
                    </div>
                    <Badge variant="info">{m.role}</Badge>
                    {user?.uid === project.ownerId && (
                      <Button 
                        variant="ghost" 
                        className="p-2 text-rose-500 hover:bg-rose-50"
                        onClick={() => handleRemoveMember(m.id, m.userId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="lg:col-span-2">
              <ProjectChat projectId={project.id} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddingDocument && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">Carica Documento</h3>
                <button
                  onClick={() => setIsAddingDocument(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handleAddDocument} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Titolo Documento
                  </label>
                  <input
                    type="text"
                    required
                    value={newDocumentTitle}
                    onChange={(e) => setNewDocumentTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                    placeholder="es: Contratto Preliminare"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Tipo Documento
                  </label>
                  <select
                    value={newDocumentType}
                    onChange={(e) => setNewDocumentType(e.target.value as DocumentType)}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                  >
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Professionista Associato (Opzionale)
                  </label>
                  <select
                    value={newDocumentProfessionalId}
                    onChange={(e) => setNewDocumentProfessionalId(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                  >
                    <option value="">Nessuno</option>
                    {members
                      .filter(m => m.role !== 'owner')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.userEmail}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    File
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 border-dashed rounded-2xl hover:border-zinc-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-zinc-400" />
                      <div className="flex text-sm text-zinc-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-zinc-900 hover:text-zinc-700 focus-within:outline-none">
                          <span>Carica un file</span>
                          <input
                            type="file"
                            className="sr-only"
                            required
                            onChange={(e) => setNewDocumentFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {newDocumentFile ? newDocumentFile.name : 'PDF, Immagini, Documenti fino a 1GB'}
                      </p>
                    </div>
                  </div>
                </div>

                {isUploading && uploadProgress.doc !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Caricamento...</span>
                      <span>{Math.round(uploadProgress.doc)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-zinc-900"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress.doc}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingDocument(false)}
                    className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !newDocumentTitle || !newDocumentFile}
                    className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Caricamento...
                      </>
                    ) : (
                      'Salva Documento'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} 
            onClose={() => setSelectedTask(null)} 
            projectId={project.id}
            onViewImage={(url, title) => setSelectedViewerImage({ url, title })}
          />
        )}
      </AnimatePresence>

      {isAddingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-bold">Nuova Attività</h3>
              <Button variant="ghost" onClick={() => setIsAddingTask(false)} className="p-2 rounded-full">
                <Plus className="w-5 h-5 rotate-45" />
              </Button>
            </div>
            
            <form onSubmit={handleAddTask} className="space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm font-medium">{error}</div>
                </motion.div>
              )}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Titolo Attività</label>
                  <div className="flex gap-2">
                    <input 
                      autoFocus
                      required
                      className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      placeholder="es: Rifacimento impianto elettrico"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">Categoria / Professionista</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {Object.entries(TASK_CATEGORY_LABELS).map(([val, label]) => {
                      const Icon = TASK_CATEGORY_ICONS[val as TaskCategory];
                      const isSelected = newTaskCategory === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setNewTaskCategory(val as TaskCategory)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-2",
                            isSelected 
                              ? cn("ring-2 ring-zinc-900 border-transparent", TASK_CATEGORY_COLORS[val as TaskCategory])
                              : "border-zinc-100 hover:border-zinc-200 bg-white text-zinc-500"
                          )}
                        >
                          <Icon className={cn("w-5 h-5", isSelected ? "" : "text-zinc-400")} />
                          <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">Priorità</label>
                    <select 
                      value={newTaskPriority}
                      onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none"
                    >
                      {Object.entries(TASK_PRIORITY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Assegnato a (Email)</label>
                  <select 
                    value={newTaskAssignedTo}
                    onChange={e => setNewTaskAssignedTo(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none"
                  >
                    <option value="">Non assegnato</option>
                    <option value={user?.email || ''}>Tu ({user?.email})</option>
                    {members.map(m => (
                      <option key={m.id} value={m.userEmail}>{m.userEmail} ({m.role})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-zinc-100">
                  <label className="text-xs font-bold uppercase text-zinc-400 mb-2 block">Allegati (Foto, Preventivi, Contratti)</label>
                  <FileAttacher 
                    onFilesChange={setNewFiles} 
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => {
                    setIsAddingTask(false);
                  }} 
                  className="flex-1"
                  disabled={isUploading}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  loading={isUploading}
                >
                  Aggiungi
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isAddingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-bold">Invita Professionista</h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-400">Email Professionista</label>
                <input 
                  autoFocus
                  type="email"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none"
                  placeholder="avvocato@esempio.it"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-400">Ruolo nel Progetto</label>
                <select 
                  value={newMemberRole}
                  onChange={e => setNewMemberRole(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none"
                >
                  <option value="editor">Collaboratore (può modificare)</option>
                  <option value="viewer">Visualizzatore (solo lettura)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsAddingMember(false)} className="flex-1">Annulla</Button>
                <Button type="submit" className="flex-1">Invia Invito</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Project Edit Modal */}
      {isEditingProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-6">Modifica Progetto</h3>
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">Nome Progetto</label>
                <input 
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={editedProjectName}
                  onChange={e => setEditedProjectName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">Indirizzo</label>
                <input 
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={editedProjectAddress}
                  onChange={e => setEditedProjectAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">Budget Totale (€)</label>
                <input 
                  type="number"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={editedProjectBudget}
                  onChange={e => setEditedProjectBudget(Number(e.target.value))}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsEditingProject(false)} className="flex-1" disabled={isSavingProject}>Annulla</Button>
                <Button type="submit" className="flex-1" loading={isSavingProject}>Salva</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {selectedViewerImage && (
          <ImageViewer 
            url={selectedViewerImage.url} 
            title={selectedViewerImage.title} 
            onClose={() => setSelectedViewerImage(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
