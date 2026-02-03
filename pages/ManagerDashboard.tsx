import React, { useState, useEffect, useMemo } from 'react';
import { Member, Gym, TransactionCategory, PaymentRecord, SupplementBill } from '../types';
import { getMembers, addMember, getMemberStatus, updateMember, getTransactions, recordTransaction, updateGym, deleteMember } from '../services/storage';
import { Button, Input, Card, Modal, Select, Badge } from '../components/UI';
import { useAuth } from '../App';
import { generateWhatsAppMessage } from '../services/geminiService';

const ManagerDashboard: React.FC = () => {
  const { authState } = useAuth();
  const gym = authState.user as Gym;
  
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'FINANCIALS' | 'SETTINGS'>('MEMBERS');
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON'>('ALL');
  const [filterDuration, setFilterDuration] = useState<number | 'ALL'>('ALL');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [manualExtendDays, setManualExtendDays] = useState<string>('');
  const [manualExtendAmount, setManualExtendAmount] = useState<string>('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Gym Settings state
  const [gymTerms, setGymTerms] = useState(gym?.termsAndConditions || '');

  // Financial Range Filter
  const [finRange, setFinRange] = useState<'TODAY' | 'MONTH' | 'RANGE' | 'SPECIFIC'>('MONTH');
  const [finStartDate, setFinStartDate] = useState('');
  const [finEndDate, setFinEndDate] = useState('');

  const initialFormState = {
    id: '', name: '', phone: '', age: '', weight: '', height: '', address: '', password: '1234', planDurationDays: 30, amountPaid: '', joinDate: new Date().toISOString().split('T')[0], profilePhoto: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Supplement Form state
  const [suppForm, setSuppForm] = useState({ itemName: '', qty: 1, days: 0, amount: 0 });

  const refreshData = async () => {
    if (!gym?.id) return;
    setLoading(true);
    try {
      const [fetchedMembers, fetchedTransactions] = await Promise.all([
        getMembers(gym.id),
        getTransactions(gym.id)
      ]);
      setMembers(fetchedMembers);
      setTransactions(fetchedTransactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [gym?.id]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const status = getMemberStatus(m.expiryDate);
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.id.includes(searchTerm);
      const matchesStatus = filterStatus === 'ALL' || (filterStatus === 'ACTIVE' && (status === 'ACTIVE' || status === 'EXPIRING_SOON')) || status === filterStatus;
      const matchesDuration = filterDuration === 'ALL' || m.planDurationDays === Number(filterDuration);
      return matchesSearch && matchesStatus && matchesDuration;
    });
  }, [members, searchTerm, filterStatus, filterDuration]);

  const handleDeleteMember = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      setProcessing(true);
      try {
        await deleteMember(id);
        await refreshData();
        alert('Member deleted successfully');
      } catch (err) {
        alert('Failed to delete member');
      } finally {
        setProcessing(processing => false);
      }
    }
  };

  const handleUpdateGymTerms = async () => {
    setProcessing(true);
    try {
      const updated = { ...gym, termsAndConditions: gymTerms };
      await updateGym(updated);
      alert('Gym Terms Updated Successfully');
    } catch (err) {
      alert('Failed to update terms');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const joinDate = new Date(formData.joinDate);
      const expiryDate = new Date(joinDate);
      expiryDate.setDate(joinDate.getDate() + Number(formData.planDurationDays));

      const newMember: Member = {
        id: formData.id || formData.phone, 
        name: formData.name,
        phone: formData.phone,
        password: formData.password,
        joinDate: joinDate.toISOString(),
        planDurationDays: Number(formData.planDurationDays),
        expiryDate: expiryDate.toISOString(),
        age: Number(formData.age),
        weight: Number(formData.weight),
        height: Number(formData.height),
        address: formData.address,
        amountPaid: Number(formData.amountPaid),
        profilePhoto: formData.profilePhoto,
        gymId: gym.id,
        isActive: true,
        transformationPhotos: {},
        supplementBills: [],
        paymentHistory: []
      };

      await addMember(newMember);
      await refreshData();
      setIsAddModalOpen(false);
      setFormData(initialFormState);
    } catch (err) {
      alert('Error adding member');
    } finally {
      setProcessing(false);
    }
  };

  const updateMemberProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setProcessing(true);
    try {
      const updated = { 
          ...selectedMember, 
          name: formData.name,
          age: Number(formData.age),
          weight: Number(formData.weight),
          height: Number(formData.height),
          address: formData.address,
          password: formData.password,
          profilePhoto: formData.profilePhoto 
      };
      await updateMember(updated);
      await refreshData();
      setSelectedMember(updated);
      alert("Member Profile Updated");
    } catch (err) {
      alert("Failed to update profile");
    } finally {
      setProcessing(false);
    }
  };

  const extendPlan = async (days: number, customAmount?: number) => {
    if (!selectedMember) return;
    setProcessing(true);
    try {
      const currentExpiry = new Date(selectedMember.expiryDate);
      const now = new Date();
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000));
      
      let amount = customAmount ?? 0;
      
      if (customAmount === undefined) {
        if (days === 30) amount = gym.pricing.oneMonth;
        else if (days === 60) amount = gym.pricing.twoMonths;
        else if (days === 90) amount = gym.pricing.threeMonths;
        else if (days === 180) amount = gym.pricing.sixMonths;
        else if (days === 365) amount = gym.pricing.twelveMonths;
        else {
          amount = Math.round((gym.pricing.oneMonth / 30) * days);
        }
      }

      const updated = { 
          ...selectedMember, 
          expiryDate: newExpiry.toISOString(),
          planDurationDays: days
      };
      
      await recordTransaction(gym.id, {
          id: `TX-${Date.now()}`,
          date: new Date().toISOString(),
          amount: amount,
          method: 'OFFLINE',
          recordedBy: 'Manager',
          category: TransactionCategory.MEMBERSHIP,
          details: `Extension: ${days} days for ${selectedMember.name}`
      });

      await updateMember(updated);
      await refreshData();
      setSelectedMember(updated);
      setManualExtendDays('');
      setManualExtendAmount('');
      alert(`Plan Extended. Payment of ₹${amount} recorded.`);
    } catch (err) {
      alert("Error extending plan");
    } finally {
      setProcessing(false);
    }
  };

  const addSupplementBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setProcessing(true);
    try {
      const newSupp: SupplementBill = {
          id: `SUP-${Date.now()}`,
          itemName: suppForm.itemName,
          qty: suppForm.qty,
          days: suppForm.days,
          amount: suppForm.amount,
          date: new Date().toISOString()
      };
      
      const updated = {
          ...selectedMember,
          supplementBills: [...selectedMember.supplementBills, newSupp]
      };

      await recordTransaction(gym.id, {
          id: `TX-${Date.now()}`,
          date: new Date().toISOString(),
          amount: suppForm.amount,
          method: 'OFFLINE',
          recordedBy: 'Manager',
          category: TransactionCategory.SUPPLEMENT,
          details: `Supplement: ${suppForm.itemName} for ${selectedMember.name}`
      });

      await updateMember(updated);
      await refreshData();
      setSelectedMember(updated);
      setSuppForm({ itemName: '', qty: 1, days: 0, amount: 0 });
    } catch (err) {
      alert("Error adding bill");
    } finally {
      setProcessing(false);
    }
  };

  const handleWhatsAppClick = async (member: Member) => {
    setIsSendingWhatsApp(member.id);
    try {
        const status = getMemberStatus(member.expiryDate);
        let type: 'REMINDER' | 'WELCOME' | 'OFFER' = 'WELCOME';
        
        if (status === 'EXPIRED' || status === 'EXPIRING_SOON') {
            type = 'REMINDER';
        } else if (new Date().getTime() - new Date(member.joinDate).getTime() < 7 * 24 * 60 * 60 * 1000) {
            type = 'WELCOME';
        } else {
            type = 'OFFER';
        }

        const message = await generateWhatsAppMessage(member.name, member.expiryDate, type);
        const encodedMessage = encodeURIComponent(message);
        const waUrl = `https://wa.me/${member.phone}?text=${encodedMessage}`;
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error("WhatsApp Error:", err);
    } finally {
        setIsSendingWhatsApp(null);
    }
  };

  const finStats = useMemo(() => {
    const now = new Date();
    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        if (finRange === 'TODAY') return tDate.toDateString() === now.toDateString();
        if (finRange === 'MONTH') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        if (finRange === 'SPECIFIC') return tDate.toISOString().split('T')[0] === finStartDate;
        if (finRange === 'RANGE') {
            const start = new Date(finStartDate);
            const end = new Date(finEndDate);
            return tDate >= start && tDate <= end;
        }
        return true;
    });

    const total = filtered.reduce((acc, t) => acc + t.amount, 0);
    const membership = filtered.filter(t => t.category === TransactionCategory.MEMBERSHIP).reduce((acc, t) => acc + t.amount, 0);
    const supplements = filtered.filter(t => t.category === TransactionCategory.SUPPLEMENT).reduce((acc, t) => acc + t.amount, 0);

    return { total, membership, supplements, filtered };
  }, [transactions, finRange, finStartDate, finEndDate]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after' | 'profile') => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            if (type === 'profile') {
                setFormData(prev => ({ ...prev, profilePhoto: base64 }));
            } else if (selectedMember) {
                const updated = {
                    ...selectedMember,
                    transformationPhotos: { ...selectedMember.transformationPhotos, [type]: base64 }
                };
                try {
                  await updateMember(updated);
                  await refreshData();
                  setSelectedMember(updated);
                } catch (err) {
                  alert("Upload failed");
                }
            }
        };
        reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-gym-accent rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-gym-accent/30">
              <i className="fas fa-chart-line"></i>
           </div>
           <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{gym?.name}</h1>
              <p className="text-slate-500 font-medium">Branch Dashboard • {gym?.city}</p>
           </div>
        </div>
        <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl glass border-slate-800">
           {(['MEMBERS', 'FINANCIALS', 'SETTINGS'] as const).map(tab => (
             <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === tab ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               {tab}
             </button>
           ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-32">
          <div className="inline-block w-12 h-12 border-4 border-gym-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium tracking-wide">Synchronizing secure data...</p>
        </div>
      )}

      {!loading && activeTab === 'SETTINGS' && (
        <Card title="Gym Policy Configuration" icon="fa-cog" className="max-w-2xl mx-auto">
           <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Public Terms & Conditions</label>
                <textarea 
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gym-accent/50 focus:border-gym-accent transition-all min-h-[250px] text-sm leading-relaxed"
                  placeholder="Enter your gym policies, rules, and liability waivers here..."
                  value={gymTerms}
                  onChange={(e) => setGymTerms(e.target.value)}
                  disabled={processing}
                />
                <div className="mt-3 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 flex items-start gap-3">
                   <i className="fas fa-info-circle text-blue-400 mt-0.5"></i>
                   <p className="text-[11px] text-blue-400/80 leading-snug">These terms will be prominently displayed on every member's personal dashboard for compliance and clarity.</p>
                </div>
              </div>
              <Button onClick={handleUpdateGymTerms} isLoading={processing} className="w-full">Update Policies</Button>
           </div>
        </Card>
      )}

      {!loading && activeTab === 'MEMBERS' && (
        <>
          <div className="glass p-5 rounded-3xl space-y-5 border-slate-800/50">
             <div className="flex flex-col lg:flex-row gap-4 items-center">
                <Input 
                  placeholder="Search members..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="flex-1" 
                  icon="fa-search"
                />
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                   {(['ALL', 'ACTIVE', 'EXPIRED', 'EXPIRING_SOON'] as const).map(s => (
                     <button 
                       key={s} 
                       onClick={() => setFilterStatus(s)}
                       className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border ${filterStatus === s ? 'bg-gym-accent border-gym-accent text-white shadow-lg shadow-gym-accent/20' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                     >
                       {s.replace('_', ' ')}
                     </button>
                   ))}
                </div>
                <Button className="w-full lg:w-auto px-6" onClick={() => setIsAddModalOpen(true)}>
                   <i className="fas fa-plus-circle mr-2"></i> Register Member
                </Button>
             </div>
             
             <div className="flex flex-wrap gap-2 items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-1 border-t border-slate-800 pt-4">
                <span className="mr-2">Plan Type:</span>
                {[
                  { label: 'All', value: 'ALL' },
                  { label: '1M', value: 30 },
                  { label: '2M', value: 60 },
                  { label: '3M', value: 90 },
                  { label: '6M', value: 180 },
                  { label: '12M', value: 365 },
                ].map(p => (
                   <button
                    key={p.label}
                    onClick={() => setFilterDuration(p.value as any)}
                    className={`px-3 py-1.5 rounded-lg border transition-all ${filterDuration === p.value ? 'bg-blue-600/10 border-blue-600/30 text-blue-400' : 'bg-transparent border-slate-800 hover:border-slate-700'}`}
                   >
                     {p.label}
                   </button>
                ))}
             </div>
          </div>

          {filteredMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredMembers.map(member => (
                <div key={member.id} className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-gym-accent to-blue-500 rounded-[2.5rem] blur opacity-0 group-hover:opacity-10 transition duration-500"></div>
                  <Card className="relative glass p-5 rounded-[2rem] h-full flex flex-col glass-hover">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                        {member.profilePhoto ? (
                          <img src={member.profilePhoto} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-2xl text-slate-600 font-bold bg-gradient-to-br from-slate-800 to-slate-900">
                            {member.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge status={getMemberStatus(member.expiryDate)} />
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleWhatsAppClick(member)}
                                className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white flex items-center justify-center transition-all"
                            >
                                <i className="fab fa-whatsapp text-sm"></i>
                            </button>
                            <button 
                                onClick={() => handleDeleteMember(member.id, member.name)}
                                className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            >
                                <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6 flex-grow">
                      <h3 className="font-extrabold text-white text-lg tracking-tight truncate mb-0.5">{member.name}</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">ID: {member.id}</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                            <span className="block text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Plan</span>
                            <span className="block text-xs font-bold text-slate-300">{member.planDurationDays} Days</span>
                         </div>
                         <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                            <span className="block text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Expires</span>
                            <span className="block text-xs font-bold text-gym-accent">{new Date(member.expiryDate).toLocaleDateString()}</span>
                         </div>
                      </div>
                    </div>

                    <Button variant="secondary" size="sm" className="w-full rounded-xl py-2.5" onClick={() => { 
                        setSelectedMember(member); 
                        setFormData({
                            id: member.id, name: member.name, phone: member.phone, age: String(member.age),
                            weight: String(member.weight), height: String(member.height), address: member.address,
                            password: member.password, planDurationDays: member.planDurationDays, amountPaid: '', joinDate: member.joinDate.split('T')[0], profilePhoto: member.profilePhoto || ''
                        });
                        setIsEditModalOpen(true); 
                    }}>Manage Account</Button>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 glass border-dashed border-slate-800 rounded-[2.5rem]">
               <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-700">
                  <i className="fas fa-users-slash text-3xl"></i>
               </div>
               <h3 className="text-xl font-bold text-white mb-2">No Members Found</h3>
               <p className="text-slate-500 max-w-xs mx-auto mb-8">Try adjusting your filters or search terms to find what you're looking for.</p>
               <Button variant="outline" size="sm" onClick={() => {setFilterStatus('ALL'); setFilterDuration('ALL'); setSearchTerm('');}}>
                  Reset All Filters
               </Button>
            </div>
          )}
        </>
      )}

      {!loading && activeTab === 'FINANCIALS' && (
        <div className="space-y-8 max-w-6xl mx-auto">
           <Card title="Revenue Distribution" icon="fa-wallet">
              <div className="flex flex-wrap gap-4 mb-10 items-end">
                 <Select 
                    label="Time Range" 
                    className="w-48"
                    options={[
                        { label: 'Today Only', value: 'TODAY' },
                        { label: 'Full Month', value: 'MONTH' },
                        { label: 'Specific Day', value: 'SPECIFIC' },
                        { label: 'Range Filter', value: 'RANGE' },
                    ]} 
                    value={finRange}
                    onChange={e => setFinRange(e.target.value as any)}
                 />
                 {(finRange === 'SPECIFIC' || finRange === 'RANGE') && (
                    <Input label="Start Date" type="date" value={finStartDate} onChange={e => setFinStartDate(e.target.value)} />
                 )}
                 {finRange === 'RANGE' && (
                    <Input label="End Date" type="date" value={finEndDate} onChange={e => setFinEndDate(e.target.value)} />
                 )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="glass p-6 rounded-[2rem] border-slate-800 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-3">Net Revenue</div>
                    <div className="text-5xl font-black text-white leading-none">₹{finStats.total.toLocaleString()}</div>
                    <div className="mt-4 flex items-center gap-2 text-gym-accent font-bold text-sm">
                       <i className="fas fa-arrow-trend-up"></i>
                       Cloud Sync Active
                    </div>
                 </div>
                 
                 <div className="space-y-6 md:col-span-2">
                    <div className="glass p-6 rounded-[2rem] border-slate-800">
                       <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                <i className="fas fa-user-check text-sm"></i>
                             </div>
                             <span className="text-sm font-bold text-slate-300">Membership Collections</span>
                          </div>
                          <span className="text-xl font-black text-white">₹{finStats.membership.toLocaleString()}</span>
                       </div>
                       <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000" style={{ width: `${(finStats.membership/finStats.total)*100 || 0}%` }}></div>
                       </div>
                    </div>

                    <div className="glass p-6 rounded-[2rem] border-slate-800">
                       <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                                <i className="fas fa-capsules text-sm"></i>
                             </div>
                             <span className="text-sm font-bold text-slate-300">Supplement Sales</span>
                          </div>
                          <span className="text-xl font-black text-white">₹{finStats.supplements.toLocaleString()}</span>
                       </div>
                       <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-orange-600 to-orange-400 h-full rounded-full transition-all duration-1000" style={{ width: `${(finStats.supplements/finStats.total)*100 || 0}%` }}></div>
                       </div>
                    </div>
                 </div>
              </div>
           </Card>

           <Card title="Transactional Registry" icon="fa-list-ul">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-800 font-black tracking-widest">
                      <th className="pb-4 px-4">Timestamp</th>
                      <th className="pb-4 px-4">Transaction Details</th>
                      <th className="pb-4 px-4">Type</th>
                      <th className="pb-4 px-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {finStats.filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                      <tr key={t.id} className="text-sm hover:bg-white/5 transition-colors group">
                        <td className="py-5 px-4 text-slate-500 font-medium">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="py-5 px-4 font-bold text-white group-hover:text-gym-accent transition-colors">{t.details}</td>
                        <td className="py-5 px-4">
                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${t.category === TransactionCategory.MEMBERSHIP ? 'bg-blue-500/5 text-blue-400 border-blue-500/20' : 'bg-orange-500/5 text-orange-400 border-orange-500/20'}`}>
                              {t.category}
                            </span>
                        </td>
                        <td className="py-5 px-4 text-right font-black text-white text-base">₹{t.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </Card>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Member Registration">
        <form onSubmit={handleAddMember} className="space-y-6">
           <div className="flex justify-center mb-2">
              <label className="cursor-pointer group relative">
                <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-slate-800 group-hover:border-gym-accent transition-all shadow-xl">
                    {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" /> : <i className="fas fa-camera text-3xl text-slate-700"></i>}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gym-accent rounded-full flex items-center justify-center text-white text-xs border-4 border-gym-card">
                   <i className="fas fa-pencil-alt"></i>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'profile')} disabled={processing} />
              </label>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Mobile / Unique ID" icon="fa-mobile-screen" required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={processing} />
              <Input label="Full Name" icon="fa-user-tag" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={processing} />
           </div>
           
           <div className="grid grid-cols-3 gap-3">
              <Input label="Age" type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} disabled={processing} />
              <Input label="Weight (kg)" type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} disabled={processing} />
              <Input label="Height (cm)" type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} disabled={processing} />
           </div>

           <Input label="Home Address" icon="fa-map-location-dot" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={processing} />
           
           <div className="grid grid-cols-2 gap-4">
              <Input label="Password" icon="fa-shield-halved" type="text" placeholder="Default: 1234" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} disabled={processing} />
              <Input label="Join Date" type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} disabled={processing} />
           </div>

           <div className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-5 shadow-inner">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Subscription Setup</h4>
              <Select 
                label="Selected Membership Plan"
                options={[
                    { label: `1 Month • ₹${gym?.pricing.oneMonth}`, value: 30 },
                    { label: `2 Months • ₹${gym?.pricing.twoMonths}`, value: 60 },
                    { label: `3 Months • ₹${gym?.pricing.threeMonths}`, value: 90 },
                    { label: `6 Months • ₹${gym?.pricing.sixMonths}`, value: 180 },
                    { label: `1 Year • ₹${gym?.pricing.twelveMonths}`, value: 365 },
                ]}
                value={formData.planDurationDays}
                onChange={e => {
                    const days = Number(e.target.value);
                    let amt = 0;
                    if (days === 30) amt = gym?.pricing.oneMonth;
                    else if (days === 60) amt = gym?.pricing.twoMonths;
                    else if (days === 90) amt = gym?.pricing.threeMonths;
                    else if (days === 180) amt = gym?.pricing.sixMonths;
                    else if (days === 365) amt = gym?.pricing.twelveMonths;
                    setFormData({...formData, planDurationDays: days, amountPaid: String(amt)});
                }}
                disabled={processing}
              />
              <Input label="Payment Collected (₹)" icon="fa-indian-rupee-sign" type="number" value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: e.target.value})} disabled={processing} />
           </div>

           <Button type="submit" className="w-full py-4 rounded-2xl shadow-xl shadow-gym-accent/20" isLoading={processing}>
              Complete Enrollment
           </Button>
        </form>
      </Modal>

      {/* Member Management Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Advanced Member Management">
        {selectedMember && (
          <div className="space-y-10 pb-12">
            {/* Section 1: Profile & Extensions */}
            <div className="space-y-6">
               <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 pl-2">1. Profile Intelligence</h3>
                   <Button 
                    variant="success" 
                    size="sm" 
                    onClick={() => handleWhatsAppClick(selectedMember)}
                    className="gap-2 rounded-xl"
                   >
                     {isSendingWhatsApp === selectedMember.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fab fa-whatsapp"></i>}
                     Send Reminder
                   </Button>
               </div>
               
               <div className="flex justify-center">
                 <div className="relative group">
                    <div className="w-28 h-28 bg-slate-900 rounded-[2rem] flex items-center justify-center overflow-hidden border-4 border-slate-800 shadow-2xl group-hover:border-gym-accent transition-all duration-500">
                        {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" /> : <i className="fas fa-user-circle text-5xl text-slate-800"></i>}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-gym-accent text-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg border-4 border-gym-card">
                       <i className="fas fa-camera text-xs"></i>
                       <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'profile')} disabled={processing} />
                    </label>
                 </div>
               </div>

               <form onSubmit={updateMemberProfile} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                     <Input label="Display Name" icon="fa-signature" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={processing} />
                     <Input label="Auth Secret" icon="fa-key" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} disabled={processing} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                     <Input label="Age" type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} disabled={processing} />
                     <Input label="Weight" type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} disabled={processing} />
                     <Input label="Height" type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} disabled={processing} />
                  </div>
                  <Input label="Physical Address" icon="fa-location-dot" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={processing} />
                  <Button type="submit" size="md" className="w-full rounded-2xl" variant="outline" isLoading={processing}>Sync Profile Changes</Button>
               </form>

               <div className="pt-8 border-t border-slate-800">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Extend Subscription Engine</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
                     <Button size="sm" variant="secondary" className="rounded-xl py-2" onClick={() => extendPlan(30)} disabled={processing}>30D</Button>
                     <Button size="sm" variant="secondary" className="rounded-xl py-2" onClick={() => extendPlan(60)} disabled={processing}>60D</Button>
                     <Button size="sm" variant="secondary" className="rounded-xl py-2" onClick={() => extendPlan(90)} disabled={processing}>90D</Button>
                     <Button size="sm" variant="secondary" className="rounded-xl py-2" onClick={() => extendPlan(180)} disabled={processing}>6M</Button>
                     <Button size="sm" variant="secondary" className="rounded-xl py-2" onClick={() => extendPlan(365)} disabled={processing}>1Y</Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <Input label="Custom Days" type="number" placeholder="Days" value={manualExtendDays} onChange={e => setManualExtendDays(e.target.value)} disabled={processing} />
                    </div>
                    <div className="flex-1 w-full">
                      <Input label="Fee (₹)" icon="fa-indian-rupee-sign" type="number" placeholder="Value" value={manualExtendAmount} onChange={e => setManualExtendAmount(e.target.value)} disabled={processing} />
                    </div>
                    <Button 
                      className="w-full sm:w-auto px-10 py-3 rounded-xl"
                      isLoading={processing}
                      onClick={() => {
                        const d = Number(manualExtendDays);
                        const a = manualExtendAmount ? Number(manualExtendAmount) : undefined;
                        if (d > 0) extendPlan(d, a);
                        else alert('Enter valid duration');
                      }}
                    >
                      Update
                    </Button>
                  </div>
               </div>
            </div>

            {/* Section 2: Transformation Photos */}
            <div className="space-y-6 pt-10 border-t border-slate-800">
               <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 pl-2">2. Visual Transformation</h3>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest text-center">Inception Photo</p>
                     <label className="block w-full h-64 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[2rem] overflow-hidden cursor-pointer relative hover:border-gym-accent/50 transition-all shadow-inner">
                        {selectedMember.transformationPhotos.before ? (
                            <img src={selectedMember.transformationPhotos.before} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3">
                               <i className="fas fa-image text-3xl"></i>
                               <span className="text-[9px] font-black uppercase tracking-widest">Upload Phase 1</span>
                            </div>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'before')} disabled={processing} />
                     </label>
                  </div>
                  <div className="space-y-3">
                     <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest text-center">Current Progress</p>
                     <label className="block w-full h-64 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[2rem] overflow-hidden cursor-pointer relative hover:border-gym-accent/50 transition-all shadow-inner">
                        {selectedMember.transformationPhotos.after ? (
                            <img src={selectedMember.transformationPhotos.after} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3">
                               <i className="fas fa-image text-3xl"></i>
                               <span className="text-[9px] font-black uppercase tracking-widest">Upload Current</span>
                            </div>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'after')} disabled={processing} />
                     </label>
                  </div>
               </div>
            </div>

            {/* Section 3: Supplement Billing */}
            <div className="space-y-6 pt-10 border-t border-slate-800">
               <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 pl-2">3. Supplement Registry</h3>
               </div>
               <form onSubmit={addSupplementBill} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div className="col-span-1 md:col-span-1"><Input label="Product" icon="fa-tag" required value={suppForm.itemName} onChange={e => setSuppForm({...suppForm, itemName: e.target.value})} disabled={processing} /></div>
                  <div className="col-span-1 md:col-span-1"><Input label="Qty" type="number" value={suppForm.qty} onChange={e => setSuppForm({...suppForm, qty: Number(e.target.value)})} disabled={processing} /></div>
                  <div className="col-span-1 md:col-span-1"><Input label="Fee (₹)" type="number" required value={suppForm.amount} onChange={e => setSuppForm({...suppForm, amount: Number(e.target.value)})} disabled={processing} /></div>
                  <div className="col-span-1 md:col-span-1"><Button type="submit" size="md" className="w-full rounded-xl py-3" isLoading={processing}>Record</Button></div>
               </form>
               <div className="mt-4">
                  <p className="text-[9px] font-black text-slate-600 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                     <i className="fas fa-history"></i> Sales Log
                  </p>
                  {selectedMember.supplementBills.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                       {selectedMember.supplementBills.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(b => (
                          <div key={b.id} className="text-xs flex justify-between items-center p-4 glass rounded-2xl border-slate-800 group hover:border-gym-accent/30 transition-all">
                             <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                   <i className="fas fa-cart-shopping"></i>
                                </div>
                                <div>
                                   <span className="text-white font-extrabold block text-sm">{b.itemName} <span className="text-slate-500 text-[10px] ml-1">x{b.qty}</span></span>
                                   <span className="text-slate-500 font-bold block mt-0.5 text-[9px] uppercase tracking-tighter">{new Date(b.date).toLocaleDateString()} • Recorded via Cloud</span>
                                </div>
                             </div>
                             <span className="text-white font-black text-lg">₹{b.amount.toLocaleString()}</span>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 glass rounded-3xl border-dashed border-slate-800 flex flex-col gap-2">
                       <i className="fas fa-box-open text-slate-800 text-2xl"></i>
                       <span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">No commercial records</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Danger Zone: Delete Member */}
            <div className="pt-10 border-t border-red-500/20">
               <div className="bg-red-500/5 p-6 rounded-[2rem] border border-red-500/20">
                  <h3 className="text-red-400 font-black uppercase tracking-widest text-xs mb-2">Danger Territory</h3>
                  <p className="text-red-400/60 text-[11px] mb-4 leading-relaxed">Deleting this account will permanently erase all profile data, payment history, and transformation records from the secure cloud infrastructure. This action is irreversible.</p>
                  <Button 
                    variant="danger" 
                    className="w-full py-4 rounded-2xl" 
                    onClick={() => {
                        handleDeleteMember(selectedMember.id, selectedMember.name);
                        setIsEditModalOpen(false);
                    }}
                    isLoading={processing}
                  >
                    <i className="fas fa-trash-alt mr-2"></i> Delete Account Permanently
                  </Button>
               </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ManagerDashboard;