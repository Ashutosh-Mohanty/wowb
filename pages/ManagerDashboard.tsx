import React, { useState, useEffect, useMemo } from 'react';
import { Member, Gym, TransactionCategory, PaymentRecord, SupplementBill } from '../types';
import { getMembers, addMember, getMemberStatus, updateMember, getTransactions, recordTransaction, updateGym } from '../services/storage';
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
      alert(`Plan Extended by ${days} days. Payment of ₹${amount} recorded.`);
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
          details: `Supplement: ${suppForm.itemName} x ${suppForm.qty} for ${selectedMember.name}`
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
                  alert("Failed to upload photo to cloud");
                }
            }
        };
        reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{gym?.name} Manager</h1>
          <p className="text-slate-400">Gym ID: {gym?.id} | Branch: {gym?.city}</p>
        </div>
        <div className="flex gap-2">
           <Button variant={activeTab === 'MEMBERS' ? 'primary' : 'outline'} onClick={() => setActiveTab('MEMBERS')}>Members</Button>
           <Button variant={activeTab === 'FINANCIALS' ? 'primary' : 'outline'} onClick={() => setActiveTab('FINANCIALS')}>Financials</Button>
           <Button variant={activeTab === 'SETTINGS' ? 'primary' : 'outline'} onClick={() => setActiveTab('SETTINGS')}>Settings</Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20">
          <i className="fas fa-circle-notch fa-spin text-4xl text-gym-accent mb-4"></i>
          <p className="text-slate-400">Syncing with cloud...</p>
        </div>
      )}

      {!loading && activeTab === 'SETTINGS' && (
        <Card title="Gym Configuration">
           <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Terms and Conditions</label>
                <textarea 
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gym-accent transition-all min-h-[200px]"
                  placeholder="Enter the terms and conditions for your gym members..."
                  value={gymTerms}
                  onChange={(e) => setGymTerms(e.target.value)}
                  disabled={processing}
                />
                <p className="text-[10px] text-slate-500 mt-1">These will be visible to all members in their dashboard.</p>
              </div>
              <Button onClick={handleUpdateGymTerms} isLoading={processing}>Save Settings</Button>
           </div>
        </Card>
      )}

      {!loading && activeTab === 'MEMBERS' && (
        <>
          <div className="flex flex-col gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
             <div className="flex flex-col md:flex-row gap-4 items-center">
                <Input placeholder="Search by ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-xs" />
                <div className="flex flex-wrap gap-2">
                   {(['ALL', 'ACTIVE', 'EXPIRED', 'EXPIRING_SOON'] as const).map(s => (
                     <button 
                       key={s} 
                       onClick={() => setFilterStatus(s)}
                       className={`px-3 py-1 text-xs rounded-md border border-slate-700 transition-all ${filterStatus === s ? 'bg-gym-accent text-white border-gym-accent' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                     >
                       {s.replace('_', ' ')}
                     </button>
                   ))}
                </div>
                <Button className="md:ml-auto" onClick={() => setIsAddModalOpen(true)}><i className="fas fa-plus mr-2"></i> Add Member</Button>
             </div>
             
             <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className="text-slate-500 font-bold uppercase">Plan Duration:</span>
                {[
                  { label: 'All Plans', value: 'ALL' },
                  { label: '1 Month', value: 30 },
                  { label: '2 Months', value: 60 },
                  { label: '3 Months', value: 90 },
                  { label: '6 Months', value: 180 },
                  { label: '12 Months', value: 365 },
                ].map(p => (
                   <button
                    key={p.label}
                    onClick={() => setFilterDuration(p.value as any)}
                    className={`px-3 py-1 rounded-md border border-slate-700 transition-all ${filterDuration === p.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                   >
                     {p.label}
                   </button>
                ))}
             </div>
          </div>

          {filteredMembers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredMembers.map(member => (
                <Card key={member.id} className="relative group hover:border-gym-accent/50 transition-all">
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                    <Badge status={getMemberStatus(member.expiryDate)} />
                    <button 
                        onClick={() => handleWhatsAppClick(member)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSendingWhatsApp === member.id ? 'bg-slate-700 animate-pulse' : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'}`}
                        title="Send WhatsApp Message"
                    >
                        {isSendingWhatsApp === member.id ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fab fa-whatsapp text-lg"></i>}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden ring-2 ring-slate-800">
                      {member.profilePhoto ? <img src={member.profilePhoto} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xl text-slate-500 font-bold">{member.name.charAt(0)}</div>}
                    </div>
                    <div>
                      <h3 className="font-bold text-white truncate w-24">{member.name}</h3>
                      <p className="text-xs text-slate-500">ID: {member.id}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-4 border-t border-slate-700/50 pt-2">
                     <span>{member.planDurationDays} Day Plan</span>
                     <span>Exp: {new Date(member.expiryDate).toLocaleDateString()}</span>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { 
                      setSelectedMember(member); 
                      setFormData({
                          id: member.id, name: member.name, phone: member.phone, age: String(member.age),
                          weight: String(member.weight), height: String(member.height), address: member.address,
                          password: member.password, planDurationDays: member.planDurationDays, amountPaid: '', joinDate: member.joinDate.split('T')[0], profilePhoto: member.profilePhoto || ''
                      });
                      setIsEditModalOpen(true); 
                  }}>Manage Member</Button>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
               <i className="fas fa-users text-4xl text-slate-700 mb-4"></i>
               <p className="text-slate-500">No members match your current filters.</p>
               <Button variant="outline" size="sm" className="mt-4" onClick={() => {setFilterStatus('ALL'); setFilterDuration('ALL'); setSearchTerm('');}}>Clear All Filters</Button>
            </div>
          )}
        </>
      )}

      {!loading && activeTab === 'FINANCIALS' && (
        <div className="space-y-6">
           <Card title="Financial Overview">
              <div className="flex flex-wrap gap-4 mb-6 items-end">
                 <Select 
                    label="Range" 
                    className="w-40"
                    options={[
                        { label: 'Today', value: 'TODAY' },
                        { label: 'This Month', value: 'MONTH' },
                        { label: 'Specific Date', value: 'SPECIFIC' },
                        { label: 'Date Range', value: 'RANGE' },
                    ]} 
                    value={finRange}
                    onChange={e => setFinRange(e.target.value as any)}
                 />
                 {(finRange === 'SPECIFIC' || finRange === 'RANGE') && (
                    <Input label="Start" type="date" value={finStartDate} onChange={e => setFinStartDate(e.target.value)} />
                 )}
                 {finRange === 'RANGE' && (
                    <Input label="End" type="date" value={finEndDate} onChange={e => setFinEndDate(e.target.value)} />
                 )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-sm text-slate-500 uppercase font-bold tracking-wider">Total Revenue</div>
                    <div className="text-3xl font-bold text-gym-accent mt-1">₹{finStats.total}</div>
                 </div>
                 <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-sm text-slate-500 uppercase font-bold tracking-wider">Memberships</div>
                    <div className="text-2xl font-bold text-blue-400 mt-1">₹{finStats.membership}</div>
                    <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                       <div className="bg-blue-400 h-full" style={{ width: `${(finStats.membership/finStats.total)*100 || 0}%` }}></div>
                    </div>
                 </div>
                 <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-sm text-slate-500 uppercase font-bold tracking-wider">Supplements</div>
                    <div className="text-2xl font-bold text-orange-400 mt-1">₹{finStats.supplements}</div>
                    <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                       <div className="bg-orange-400 h-full" style={{ width: `${(finStats.supplements/finStats.total)*100 || 0}%` }}></div>
                    </div>
                 </div>
              </div>
           </Card>

           <Card title="Transaction History">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-800">
                      <th className="pb-3 px-2">Date</th>
                      <th className="pb-3 px-2">Details</th>
                      <th className="pb-3 px-2">Category</th>
                      <th className="pb-3 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {finStats.filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                      <tr key={t.id} className="text-sm hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-2 text-slate-400">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="py-3 px-2 text-white">{t.details}</td>
                        <td className="py-3 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${t.category === TransactionCategory.MEMBERSHIP ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                              {t.category}
                            </span>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-white font-mono">₹{t.amount}</td>
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
        <form onSubmit={handleAddMember} className="space-y-4">
           <div className="flex justify-center mb-4">
              <label className="cursor-pointer">
                <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border-2 border-gym-accent shadow-inner">
                    {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" /> : <i className="fas fa-camera text-2xl text-slate-400"></i>}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'profile')} disabled={processing} />
              </label>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <Input label="Member ID (Mobile)" required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={processing} />
              <Input label="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={processing} />
           </div>
           <div className="grid grid-cols-3 gap-2">
              <Input label="Age" type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} disabled={processing} />
              <Input label="Weight (kg)" type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} disabled={processing} />
              <Input label="Height (cm)" type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} disabled={processing} />
           </div>
           <Input label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={processing} />
           <div className="grid grid-cols-2 gap-4">
              <Input label="Password" type="text" placeholder="Default: 1234" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} disabled={processing} />
              <Input label="Join Date" type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} disabled={processing} />
           </div>
           <div className="p-4 bg-slate-800 rounded-lg space-y-4 border border-slate-700">
              <Select 
                label="Plan Selection"
                options={[
                    { label: `1 Month (₹${gym?.pricing.oneMonth})`, value: 30 },
                    { label: `2 Months (₹${gym?.pricing.twoMonths})`, value: 60 },
                    { label: `3 Months (₹${gym?.pricing.threeMonths})`, value: 90 },
                    { label: `6 Months (₹${gym?.pricing.sixMonths})`, value: 180 },
                    { label: `1 Year (₹${gym?.pricing.twelveMonths})`, value: 365 },
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
              <Input label="Amount Paid (INR)" type="number" value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: e.target.value})} disabled={processing} />
           </div>
           <Button type="submit" className="w-full" isLoading={processing}>Register Member</Button>
        </form>
      </Modal>

      {/* Member Management Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Manage Member Account">
        {selectedMember && (
          <div className="space-y-8 pb-10">
            {/* Section 1: Profile & Extensions */}
            <section className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
               <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                   <h3 className="text-lg font-bold text-white">1. Profile & Plan Extension</h3>
                   <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleWhatsAppClick(selectedMember)}
                    className="flex items-center gap-2 text-green-400 border-green-500/30 hover:bg-green-500/10"
                   >
                     {isSendingWhatsApp === selectedMember.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fab fa-whatsapp"></i>}
                     Send WhatsApp
                   </Button>
               </div>
               
               <div className="flex justify-center mb-6">
                 <div className="relative group">
                    <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border-2 border-gym-accent shadow-lg">
                        {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" /> : <i className="fas fa-user text-4xl text-slate-500"></i>}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-gym-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-gym-accentHover transition-colors border-2 border-slate-800">
                       <i className="fas fa-camera text-xs text-white"></i>
                       <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'profile')} disabled={processing} />
                    </label>
                    {formData.profilePhoto && (
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, profilePhoto: '' }))}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 border-2 border-slate-800"
                      >
                         <i className="fas fa-times text-[10px] text-white"></i>
                      </button>
                    )}
                 </div>
               </div>

               <form onSubmit={updateMemberProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <Input label="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={processing} />
                     <Input label="Password" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} disabled={processing} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <Input label="Age" type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} disabled={processing} />
                     <Input label="Weight (kg)" type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} disabled={processing} />
                     <Input label="Height (cm)" type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} disabled={processing} />
                  </div>
                  <Input label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={processing} />
                  <Button type="submit" size="sm" className="w-full" isLoading={processing}>Update Member Profile</Button>
               </form>
               <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm font-medium text-slate-300 mb-2 font-bold">Renew / Extend Membership</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                     <Button size="sm" variant="secondary" onClick={() => extendPlan(30)} disabled={processing}>+30 Days</Button>
                     <Button size="sm" variant="secondary" onClick={() => extendPlan(60)} disabled={processing}>+60 Days</Button>
                     <Button size="sm" variant="secondary" onClick={() => extendPlan(90)} disabled={processing}>+90 Days</Button>
                     <Button size="sm" variant="secondary" onClick={() => extendPlan(180)} disabled={processing}>+6 Months</Button>
                     <Button size="sm" variant="secondary" onClick={() => extendPlan(365)} disabled={processing}>+1 Year</Button>
                  </div>
                  <div className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                    <div className="flex-1">
                      <Input 
                        label="Custom Days" 
                        type="number" 
                        placeholder="Days" 
                        value={manualExtendDays} 
                        onChange={e => setManualExtendDays(e.target.value)}
                        disabled={processing}
                      />
                    </div>
                    <div className="flex-1">
                      <Input 
                        label="Extend Fee (₹)" 
                        type="number" 
                        placeholder="Amount" 
                        value={manualExtendAmount} 
                        onChange={e => setManualExtendAmount(e.target.value)}
                        disabled={processing}
                      />
                    </div>
                    <Button 
                      size="sm" 
                      className="whitespace-nowrap h-[42px]"
                      isLoading={processing}
                      onClick={() => {
                        const d = Number(manualExtendDays);
                        const a = manualExtendAmount ? Number(manualExtendAmount) : undefined;
                        if (d > 0) extendPlan(d, a);
                        else alert('Please enter valid days');
                      }}
                    >
                      Update
                    </Button>
                  </div>
               </div>
            </section>

            {/* Section 2: Transformation Photos */}
            <section className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
               <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">2. Transformation Journey</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <p className="text-xs text-slate-500 uppercase font-bold">Before Photo</p>
                     <label className="block w-full h-48 bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg overflow-hidden cursor-pointer relative hover:border-gym-accent transition-all">
                        {selectedMember.transformationPhotos.before ? (
                            <img src={selectedMember.transformationPhotos.before} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                               <i className="fas fa-upload text-2xl"></i>
                               <span className="text-[10px]">Select Photo</span>
                            </div>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'before')} disabled={processing} />
                     </label>
                  </div>
                  <div className="space-y-2">
                     <p className="text-xs text-slate-500 uppercase font-bold">After Photo</p>
                     <label className="block w-full h-48 bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg overflow-hidden cursor-pointer relative hover:border-gym-accent transition-all">
                        {selectedMember.transformationPhotos.after ? (
                            <img src={selectedMember.transformationPhotos.after} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                               <i className="fas fa-upload text-2xl"></i>
                               <span className="text-[10px]">Select Photo</span>
                            </div>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'after')} disabled={processing} />
                     </label>
                  </div>
               </div>
            </section>

            {/* Section 3: Supplement Billing */}
            <section className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
               <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">3. Supplement Billing</h3>
               <form onSubmit={addSupplementBill} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div className="col-span-1 md:col-span-1"><Input label="Item Name" required value={suppForm.itemName} onChange={e => setSuppForm({...suppForm, itemName: e.target.value})} disabled={processing} /></div>
                  <div className="col-span-1 md:col-span-1"><Input label="Qty" type="number" value={suppForm.qty} onChange={e => setSuppForm({...suppForm, qty: Number(e.target.value)})} disabled={processing} /></div>
                  <div className="col-span-1 md:col-span-1"><Input label="Amount (₹)" type="number" required value={suppForm.amount} onChange={e => setSuppForm({...suppForm, amount: Number(e.target.value)})} disabled={processing} /></div>
                  <div className="col-span-1 md:col-span-1"><Button type="submit" size="sm" className="w-full" isLoading={processing}>Add Bill</Button></div>
               </form>
               <div className="mt-4">
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Recent Supplement Sales</p>
                  {selectedMember.supplementBills.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                       {selectedMember.supplementBills.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(b => (
                          <div key={b.id} className="text-xs flex justify-between items-center p-3 bg-slate-900/80 rounded border border-slate-800">
                             <div>
                                <span className="text-white font-bold block">{b.itemName} (x{b.qty})</span>
                                <span className="text-slate-500 block mt-0.5">{new Date(b.date).toLocaleDateString()}</span>
                             </div>
                             <span className="text-orange-400 font-bold font-mono text-sm">₹{b.amount}</span>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-600 text-[10px]">No supplements recorded.</div>
                  )}
               </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ManagerDashboard;