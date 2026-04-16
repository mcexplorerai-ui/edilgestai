import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, Timestamp, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, type StorageReference } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
// Initialize Storage — usa getStorage(app) per caricare automaticamente il bucket dal config
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isPermissionError = error instanceof Error && (
    error.message.includes('permission-denied') || 
    error.message.includes('Missing or insufficient permissions')
  );

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Always throw to ensure the calling function's catch block is triggered 
  // and execution stops.
  throw new Error(JSON.stringify(errInfo));
}

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

export function validateFile(file: File, allowedTypes: string[] = [
  'image/jpeg', 
  'image/png', 
  'image/webp', 
  'image/heic', 
  'image/heif', 
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'application/rtf',
  'video/mp4',
  'video/quicktime',
  'application/octet-stream'
]) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Il file è troppo grande. Il limite è di 1GB.`);
  }
  
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') || fileType === 'image/heic' || fileType === 'image/heif';

  if (allowedTypes.length > 0) {
    const isAllowed = allowedTypes.includes(fileType) || (isHeic && (allowedTypes.includes('image/heic') || allowedTypes.includes('image/heif')));
    
    if (!isAllowed && fileType !== "") {
      const extension = fileName.split('.').pop();
      const commonTechnicalExtensions = ['dwg', 'dxf', 'zip', 'rar', '7z', 'txt', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'pdf', 'mp4', 'mov'];
      if (!extension || !commonTechnicalExtensions.includes(extension)) {
        throw new Error(`Tipo di file non supportato.`);
      }
    }
  }
}

export async function uploadFileWithProgress(
  storageRef: StorageReference,
  file: File,
  onProgress: (progress: number) => void,
  timeoutMs = 120000 // 120 secondi di timeout per file più grandi
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Devi essere autenticato per caricare file.');
  }

  console.log(`[Storage] Tentativo di upload su: ${storageRef.fullPath} (Bucket: ${storageRef.bucket})`);
  console.log(`[Storage] File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}`);

  try {
    onProgress(5);
    
    // Verifica se lo storage bucket è configurato correttamente
    if (!storageRef.bucket || storageRef.bucket === 'undefined') {
      throw new Error('Firebase Storage non è configurato correttamente. Verifica il campo "storageBucket" nel file di configurazione Firebase.');
    }

    onProgress(10);
    
    // Implementiamo un timeout manuale per uploadBytes che a volte si blocca negli iframe
    const uploadPromise = uploadBytes(storageRef, file);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('STORAGE_TIMEOUT: Il caricamento ha impiegato troppo tempo. Possibili cause:\n1. Firebase Storage non è abilitato nella console Firebase\n2. Le regole di sicurezza Storage bloccano l\'accesso\n3. Connessione internet lenta o instabile\n\nVai su console.firebase.google.com > Storage per verificare.')), timeoutMs)
    );

    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
    
    console.log(`[Storage] Upload completato per: ${file.name}`);
    onProgress(80);
    
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`[Storage] URL ottenuto: ${downloadURL.substring(0, 50)}...`);
    onProgress(100);
    return downloadURL;
  } catch (error: any) {
    console.error('[Storage Error]', error);
    
    // Errore di autorizzazione
    if (error.code === 'storage/unauthorized') {
      throw new Error('PERMESSO NEGATO: Non hai i permessi per caricare file.\n\nSoluzioni:\n1. Vai su Firebase Console > Storage > Rules\n2. Assicurati che le regole permettano upload per utenti autenticati\n3. Pubblica le nuove regole');
    }
    
    // Storage non abilitato
    if (error.code === 'storage/unknown' || error.code === 'storage/bucket-not-found') {
      throw new Error('STORAGE NON ABILITATO: Firebase Storage non è attivo nel tuo progetto.\n\nPer abilitarlo:\n1. Vai su console.firebase.google.com\n2. Seleziona il tuo progetto\n3. Clicca su "Storage" nel menu laterale\n4. Clicca "Inizia" e segui la procedura guidata');
    }
    
    // Errore di rete/CORS
    if (error.message?.includes('network') || error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
      throw new Error('ERRORE DI RETE: Impossibile connettersi a Firebase Storage.\n\nVerifica:\n1. La connessione internet\n2. Che il dominio sia autorizzato in Firebase Console > Authentication > Authorized domains');
    }
    
    // Timeout personalizzato
    if (error.message?.includes('STORAGE_TIMEOUT')) {
      throw error;
    }
    
    throw new Error(`Errore Storage: ${error.message || 'Errore sconosciuto durante l\'upload'}`);
  }
}

/**
 * Tries to upload to Storage. Base64 fallback is REMOVED for large files
 * to ensure they don't break Firestore.
 */
export async function uploadFileWithFallback(
  storageRef: StorageReference,
  file: File,
  onProgress: (progress: number) => void
): Promise<string> {
  // Forziamo l'uso di Storage. Il fallback Base64 viene usato SOLO se il file è minuscolo (<50KB)
  // e Storage fallisce, giusto per non bloccare l'utente in casi estremi.
  try {
    return await uploadFileWithProgress(storageRef, file, onProgress);
  } catch (error: any) {
    if (file.size > 50 * 1024) {
      throw error; // Se è più grande di 50KB, deve andare su Storage o fallire.
    }
    
    console.warn(`[Storage Fallback] Utilizzo Base64 per file minuscolo: ${file.name}`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        onProgress(100);
        resolve(reader.result as string);
      };
      reader.onerror = () => reject(new Error('Errore durante la lettura del file.'));
      reader.readAsDataURL(file);
    });
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export type { User as FirebaseUser };

// Esporta ref e getDownloadURL per uso diretto in App.tsx
export { ref, getDownloadURL } from 'firebase/storage';
