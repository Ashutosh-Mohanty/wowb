export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER'
}

export enum TransactionCategory {
  MEMBERSHIP = 'MEMBERSHIP',
  SUPPLEMENT = 'SUPPLEMENT'
}

export interface Gym {
  id: string; // This is GymID
  name: string;
  address: string;
  city: string;
  idProof: string; // Added ID Proof field
  password: string; // Manager's password
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string; // Join Date
  subscriptionPlanDays: number;
  subscriptionExpiry: string;
  termsAndConditions: string; // Added Terms and Conditions field
  pricing: {
    oneMonth: number;
    twoMonths: number;
    threeMonths: number;
    sixMonths: number;
    twelveMonths: number;
  };
  subscriptionDue: number;
  lastPaymentDate: string;
}

export interface TransformationPhotos {
  before?: string;
  after?: string;
}

export interface SupplementBill {
  id: string;
  itemName: string;
  qty: number;
  days: number;
  amount: number;
  date: string;
}

export interface Member {
  id: string; // Mobile number by default
  password: string;
  name: string;
  phone: string;
  joinDate: string;
  planDurationDays: number;
  expiryDate: string;
  age: number;
  weight: number;
  height: number;
  address: string;
  amountPaid: number;
  profilePhoto?: string;
  gymId: string;
  isActive: boolean;
  notes?: string;
  transformationPhotos: TransformationPhotos;
  supplementBills: SupplementBill[];
  paymentHistory: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'ONLINE' | 'OFFLINE';
  recordedBy: string;
  category: TransactionCategory;
  details?: string;
}

export interface Trainer {
  id: string;
  name: string;
  gymId: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: any;
  role: UserRole | null;
}

export interface GymSettings {
  autoNotifyWhatsApp: boolean;
  gymName: string;
}