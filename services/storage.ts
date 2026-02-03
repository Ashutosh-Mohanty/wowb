
import { Member, PaymentRecord, Gym, TransactionCategory } from '../types';
import { supabase } from './supabase';

// Helper to calculate expiry dates
export const calculateExpiry = (startDate: string, days: number): string => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

// --- Gym Mapping Helpers ---
const mapGymFromDb = (g: any): Gym => ({
  id: g.id,
  name: g.name,
  address: g.address,
  city: g.city,
  idProof: g.id_proof,
  password: g.password,
  status: g.status,
  createdAt: g.created_at,
  subscriptionPlanDays: g.subscription_plan_days,
  subscriptionExpiry: g.subscription_expiry,
  termsAndConditions: g.terms_and_conditions,
  pricing: g.pricing || { oneMonth: 0, twoMonths: 0, threeMonths: 0, sixMonths: 0, twelveMonths: 0 },
  subscriptionDue: g.subscription_due || 0,
  lastPaymentDate: g.last_payment_date
});

const mapGymToDb = (gym: Gym) => ({
  id: gym.id,
  name: gym.name,
  address: gym.address,
  city: gym.city,
  id_proof: gym.idProof,
  password: gym.password,
  status: gym.status,
  created_at: gym.createdAt,
  subscription_plan_days: gym.subscriptionPlanDays,
  subscription_expiry: gym.subscriptionExpiry,
  terms_and_conditions: gym.termsAndConditions,
  pricing: gym.pricing,
  subscription_due: gym.subscriptionDue,
  last_payment_date: gym.lastPaymentDate
});

// --- Member Mapping Helpers ---
const mapMemberFromDb = (m: any): Member => ({
  id: m.id,
  password: m.password,
  name: m.name,
  phone: m.phone,
  joinDate: m.join_date,
  planDurationDays: m.plan_duration_days,
  expiryDate: m.expiry_date,
  age: m.age,
  weight: m.weight,
  height: m.height,
  address: m.address,
  amountPaid: m.amount_paid,
  profilePhoto: m.profile_photo,
  gymId: m.gym_id,
  isActive: m.is_active,
  transformationPhotos: m.transformation_photos || {},
  supplementBills: m.supplement_bills || [],
  paymentHistory: m.payment_history || []
});

const mapMemberToDb = (member: Member) => ({
  id: member.id,
  password: member.password,
  name: member.name,
  phone: member.phone,
  join_date: member.joinDate,
  plan_duration_days: member.planDurationDays,
  expiry_date: member.expiryDate,
  age: member.age,
  weight: member.weight,
  height: member.height,
  address: member.address,
  amount_paid: member.amountPaid,
  profile_photo: member.profilePhoto,
  gym_id: member.gymId,
  is_active: member.isActive,
  transformation_photos: member.transformationPhotos,
  supplement_bills: member.supplementBills,
  payment_history: member.paymentHistory
});

// --- API Methods ---

export const getGyms = async (): Promise<Gym[]> => {
  const { data, error } = await supabase.from('gyms').select('*');
  if (error) {
    console.error('Error fetching gyms:', error);
    return [];
  }
  return (data || []).map(mapGymFromDb);
};

export const addGym = async (gym: Gym) => {
  const { error } = await supabase.from('gyms').insert([mapGymToDb(gym)]);
  if (error) throw error;
};

export const updateGym = async (updatedGym: Gym) => {
  const { error } = await supabase
    .from('gyms')
    .update(mapGymToDb(updatedGym))
    .eq('id', updatedGym.id);
  if (error) throw error;
};

export const deleteGym = async (id: string) => {
  const { error } = await supabase.from('gyms').delete().eq('id', id);
  if (error) throw error;
};

export const getMembers = async (gymId?: string): Promise<Member[]> => {
  let query = supabase.from('members').select('*');
  if (gymId) {
    query = query.eq('gym_id', gymId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching members:', error);
    return [];
  }
  return (data || []).map(mapMemberFromDb);
};

export const addMember = async (member: Member) => {
  const { error: memberError } = await supabase.from('members').insert([mapMemberToDb(member)]);
  if (memberError) throw memberError;

  await recordTransaction(member.gymId, {
    id: `TX-${Date.now()}`,
    date: member.joinDate,
    amount: member.amountPaid,
    method: 'OFFLINE',
    recordedBy: 'Manager',
    category: TransactionCategory.MEMBERSHIP,
    details: `Initial joining for ${member.name}`
  });
};

export const updateMember = async (updatedMember: Member) => {
  const { error } = await supabase
    .from('members')
    .update(mapMemberToDb(updatedMember))
    .eq('id', updatedMember.id);
  if (error) throw error;
};

export const deleteMember = async (id: string) => {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
};

export const getTransactions = async (gymId: string): Promise<PaymentRecord[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('gym_id', gymId);
  
  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return (data || []).map(t => ({
    ...t,
    recordedBy: t.recorded_by
  })) as PaymentRecord[];
};

export const recordTransaction = async (gymId: string, transaction: PaymentRecord) => {
  const transactionData = {
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    method: transaction.method,
    recorded_by: transaction.recordedBy,
    category: transaction.category,
    details: transaction.details,
    gym_id: gymId
  };

  const { error } = await supabase.from('transactions').insert([transactionData]);
  if (error) throw error;
};

export const getMemberStatus = (expiryDate: string): 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 5) return 'EXPIRING_SOON';
  return 'ACTIVE';
};
