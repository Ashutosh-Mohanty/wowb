import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../App';
import { Member, Gym, TransactionCategory, PaymentRecord } from '../types';
import { Card, Badge, Button } from '../components/UI';
import { getMemberStatus, getTransactions, getGyms } from '../services/storage';
import { getAIWorkoutTip } from '../services/geminiService';

const MemberDashboard: React.FC = () => {
  const { authState } = useAuth();
  const initialMember = authState.user as Member;
  const [member, setMember] = useState<Member>(initialMember);
  const [gym, setGym] = useState<Gym | null>(null);
  const [transactions, setTransactions] = useState<PaymentRecord[]>([]);
  const [tip, setTip] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    if (!member) return;
    setLoading(true);
    try {
      const [gyms, txs] = await Promise.all([
        getGyms(),
        getTransactions(member.gymId)
      ]);
      const currentGym = gyms.find(g => g.id === member.gymId);
      setGym(currentGym || null);
      
      const memberTxs = txs.filter(t => t.details?.includes(member.name) || t.details?.includes(member.id));
      setTransactions(memberTxs);

      const daysActive = Math.ceil((new Date().getTime() - new Date(member.joinDate).getTime()) / (1000 * 3600 * 24));
      const aiTip = await getAIWorkoutTip(daysActive);
      setTip(aiTip);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [member?.id]);

  if (!member) return <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing Cloud Profile...</div>;

  const status = getMemberStatus(member.expiryDate);
  const daysLeft = Math.ceil((new Date(member.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 animate-fade-in">
      {/* Profile Header */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-gym-accent to-blue-600 rounded-[3rem] blur opacity-20 transition duration-1000"></div>
        <Card className="relative glass flex flex-col md:flex-row gap-8 items-center md:items-start bg-slate-950/40 p-10 rounded-[2.5rem] border-white/5">
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-[2.5rem] bg-slate-900 flex items-center justify-center overflow-hidden border-4 border-slate-800 shadow-2xl group-hover:scale-105 transition-transform duration-500">
             {member.profilePhoto ? (
               <img src={member.profilePhoto} className="w-full h-full object-cover" alt="Profile" />
             ) : (
               <div className="text-5xl font-black text-slate-800">{member.name.charAt(0)}</div>
             )}
          </div>
          <div className="flex-1 text-center md:text-left">
             <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black text-white mb-2 tracking-tight">{member.name}</h1>
                  <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                     <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/5">ID: {member.id}</span>
                     <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/5">Joined: {new Date(member.joinDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="md:mt-0">
                   <Badge status={status} />
                </div>
             </div>
             
             <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-3xl border-slate-800 shadow-xl group/stat hover:border-gym-accent/30 transition-all">
                   <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-2">
                      <i className="fas fa-calendar-check text-gym-accent"></i> Membership
                   </div>
                   <div className={`text-xl font-black ${daysLeft < 5 ? 'text-red-400' : 'text-white'}`}>
                      {new Date(member.expiryDate).toLocaleDateString()}
                   </div>
                   <div className="text-[10px] text-slate-600 font-bold mt-1">
                      {daysLeft > 0 ? `${daysLeft} days until renewal` : 'Account currently inactive'}
                   </div>
                </div>
                <div className="glass p-5 rounded-3xl border-slate-800 shadow-xl group/stat hover:border-blue-500/30 transition-all">
                   <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-2">
                      <i className="fas fa-dumbbell text-blue-400"></i> Plan Type
                   </div>
                   <div className="text-xl font-black text-white">{member.planDurationDays} Days</div>
                   <div className="text-[10px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">Premium Access Active</div>
                </div>
                <div className="glass p-5 rounded-3xl border-slate-800 shadow-xl group/stat hover:border-orange-500/30 transition-all">
                   <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-2">
                      <i className="fas fa-weight-scale text-orange-400"></i> Weight
                   </div>
                   <div className="text-xl font-black text-white">{member.weight} <span className="text-xs text-slate-500">kg</span></div>
                   <div className="text-[10px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">Tracked on Cloud</div>
                </div>
                <div className="glass p-5 rounded-3xl border-slate-800 shadow-xl group/stat hover:border-emerald-500/30 transition-all">
                   <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-2">
                      <i className="fas fa-ruler-vertical text-emerald-400"></i> Height
                   </div>
                   <div className="text-xl font-black text-white">{member.height} <span className="text-xs text-slate-500">cm</span></div>
                   <div className="text-[10px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">Verified Metric</div>
                </div>
             </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Transformation Progress */}
          <Card title="Fitness Evolution Timeline" icon="fa-person-running">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Baseline Phase</p>
                    <span className="text-[9px] font-bold text-slate-600">Day 1</span>
                  </div>
                  <div className="h-80 bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl relative group">
                    {member.transformationPhotos.before ? (
                        <img src={member.transformationPhotos.before} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Before" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-800 text-sm gap-4">
                          <i className="fas fa-image-portrait text-5xl opacity-20"></i>
                          <span className="font-bold uppercase tracking-widest text-[10px] opacity-40">Awaiting Profile Sync</span>
                        </div>
                    )}
                  </div>
              </div>
              <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Peak Performance</p>
                    <span className="text-[9px] font-bold text-gym-accent">Current Status</span>
                  </div>
                  <div className="h-80 bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl relative group">
                    {member.transformationPhotos.after ? (
                        <img src={member.transformationPhotos.after} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="After" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-800 text-sm gap-4">
                          <i className="fas fa-image-portrait text-5xl opacity-20"></i>
                          <span className="font-bold uppercase tracking-widest text-[10px] opacity-40">Upload in Progress</span>
                        </div>
                    )}
                    {member.transformationPhotos.after && (
                      <div className="absolute top-4 right-4 px-3 py-1 bg-gym-accent/90 text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                         Verified
                      </div>
                    )}
                  </div>
              </div>
            </div>
          </Card>

          {/* Payment History */}
          <Card title="Financial Transparency" icon="fa-receipt">
              {transactions && transactions.length > 0 ? (
                  <div className="overflow-hidden rounded-3xl border border-slate-800">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-500 uppercase text-[9px] tracking-widest font-black">
                          <tr>
                              <th className="p-5">Transaction Date</th>
                              <th className="p-5">Subscription Package</th>
                              <th className="p-5 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                              <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                <td className="p-5 text-slate-400 font-medium">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="p-5 text-slate-200 text-xs font-bold group-hover:text-gym-accent transition-colors">{tx.details}</td>
                                <td className="p-5 text-right font-black text-white text-base">₹{tx.amount.toLocaleString()}</td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                  </div>
              ) : (
                  <div className="text-slate-600 text-xs font-black uppercase tracking-widest py-10 text-center glass rounded-3xl border-dashed border-slate-800">
                     No subscription history found on the cloud
                  </div>
              )}
          </Card>
        </div>

        <div className="space-y-10">
          {/* AI Trainer Tip */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-gym-accent to-emerald-400 rounded-3xl blur opacity-30"></div>
            <Card className="relative glass border-none bg-slate-950/80 p-8">
              <h3 className="text-xs font-black text-gym-accent uppercase tracking-[0.2em] flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gym-accent/10 flex items-center justify-center">
                    <i className="fas fa-brain animate-pulse"></i>
                  </div>
                  AI Performance Insights
              </h3>
              <p className="text-slate-200 font-bold text-base leading-relaxed tracking-tight italic">
                "{tip || 'Analyzing bio-metrics and consistency patterns...'}"
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[8px] text-slate-600 font-black uppercase tracking-[0.2em]">
                 Generated via Gemini Flash Intelligence
              </div>
            </Card>
          </div>

          {/* Supplement Billing */}
          <Card title="Dietary Registry" icon="fa-capsules">
            {member.supplementBills && member.supplementBills.length > 0 ? (
                <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                  {member.supplementBills.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(bill => (
                      <div key={bill.id} className="p-4 glass rounded-2xl border-slate-800 flex justify-between items-center group hover:border-gym-accent/30 transition-all">
                        <div className="flex gap-4 items-center">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center text-sm shadow-inner">
                               <i className="fas fa-capsules"></i>
                            </div>
                            <div>
                                <div className="text-white font-extrabold text-sm tracking-tight">{bill.itemName} <span className="text-slate-600 ml-1">x{bill.qty}</span></div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{new Date(bill.date).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <div className="text-white font-black text-lg">₹{bill.amount.toLocaleString()}</div>
                      </div>
                  ))}
                </div>
            ) : (
                <div className="text-center py-10 text-slate-700 font-black uppercase tracking-widest text-[9px] border-2 border-dashed border-slate-900 rounded-[2rem]">
                   No commercial dietary records
                </div>
            )}
          </Card>

          {/* Gym Specific Terms & Conditions */}
          <Card title="Legal Policy & Branch Info" icon="fa-building-shield">
             <div className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800 shadow-inner">
                <div className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-medium">
                   {gym?.termsAndConditions || 'Standard GymPro policies are in effect. Please consult local management for detailed liability disclosures.'}
                </div>
             </div>
             <div className="mt-8 space-y-4 px-2">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-gym-accent text-white flex items-center justify-center shadow-lg shadow-gym-accent/20">
                      <i className="fas fa-location-dot"></i>
                   </div>
                   <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Primary Branch</p>
                      <p className="text-sm font-black text-white">{gym?.name}</p>
                   </div>
                </div>
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-loose">
                   <p className="flex items-center gap-3"><i className="fas fa-map text-gym-accent/50"></i> {gym?.address}, {gym?.city}</p>
                   <p className="flex items-center gap-3 mt-1"><i className="fas fa-id-card-clip text-gym-accent/50"></i> Reg ID: {gym?.idProof || gym?.id}</p>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;