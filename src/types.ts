import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'investor' | 'technician' | 'contractor' | 'lawyer' | 'accountant' | 'analyst';
export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  plan: SubscriptionPlan;
  createdAt: Timestamp;
}

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on-hold';

export interface Project {
  id: string;
  name: string;
  address?: string;
  ownerId: string;
  memberIds: string[];
  status: ProjectStatus;
  totalBudget?: number;
  totalSpent?: number;
  estimatedMargin?: number;
  createdAt: Timestamp;
}

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'elettricista' | 'idraulico' | 'muratore' | 'cartongessista' | 'pittore' | 'avvocato' | 'geometra' | 'commercialista' | 'altro';

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Timestamp;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  workDetail?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category?: TaskCategory;
  imageUrl?: string;
  quoteUrl?: string;
  billOfQuantitiesUrl?: string;
  paymentUrl?: string;
  agreements?: string;
  dueDate?: Timestamp;
  startDate?: Timestamp;
  endDate?: Timestamp;
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  attachments?: TaskAttachment[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type DocumentType = 'business_plan' | 'tax_planning' | 'contract' | 'permit' | 'quote' | 'photo' | 'other';

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  type: DocumentType;
  url: string;
  professionalId?: string; // ID of the professional (Membership or User)
  professionalEmail?: string; // Email of the professional for display
  uploadedBy: string;
  createdAt: Timestamp;
}

export interface Membership {
  id: string;
  projectId: string;
  userId: string;
  userEmail?: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Conversation {
  id: string;
  projectId: string;
  name?: string;
  participantIds: string[];
  isGroup: boolean;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  projectId?: string;
  taskId?: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: Timestamp;
}
