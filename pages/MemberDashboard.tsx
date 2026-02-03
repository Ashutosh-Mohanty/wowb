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

  if (!member) return <div className="p-10 text-center text-slate-500">Loading member data...</div>;

  const status = getMemberStatus(member.expiryDate);
  const daysLeft = Math.ceil((new Date(member.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Profile Header */}
      <Card className="flex flex-col md:flex-row gap-6 items-center md:items-start bg-gradient-to-br from-slate-800 to-slate-900 border-gym-accent/20">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-slate-600 shadow-2xl">
           {member.profilePhoto ? (
             <img src={member.profilePhoto} className="w-full h-full object-cover" alt="Profile" />
           ) : (
             <span className="text-4xl font-bold text-slate-400">{member.name.charAt(0)}</span>
           )}
        </div>
        <div className="flex-1 text-center md:text-left">
           <div className="flex flex-col md:flex-row items-center md:items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">{member.name}</h1>
                <p className="text-slate-400 font-mono text-sm">Member ID: {member.id}</p>
                <p className="text-slate-500 text-xs mt-1">Join Date: {new Date(member.joinDate).toLocaleDateString()}</p>
              </div>
              <div className="mt-4 md:mt-0">
                 <Badge status={status} />
              </div>
           </div>
           
           <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center md:text-left">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 shadow-inner">
                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Plan Expiry</div>
                 <div className={`text-lg font-bold ${daysLeft < 5 ? 'text-red-400' : 'text-gym-accent'}`}>
                    {new Date(member.expiryDate).toLocaleDateString()}
                 </div>
                 <div className="text-[10px] text-slate-400">{daysLeft > 0 ? `${daysLeft} days remaining` : 'Membership Expired'}</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 shadow-inner">
                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Active Plan</div>
                 <div className="text-lg font-bold text-white">{member.planDurationDays} Days</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 shadow-inner">
                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Weight</div>
                 <div className="text-lg font-bold text-white">{member.weight} kg</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 shadow-inner">
                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Height</div>
                 <div className="text-lg font-bold text-white">{member.height} cm</div>
              </div>
           </div>
        </div>
      </Card>

      {loading && (
        <div className="text-center py-10">
          <i className="fas fa-circle-notch fa-spin text-2xl text-gym-accent mb-2"></i>
          <p className="text-xs text-slate-500">Syncing profile...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Transformation Progress */}
            <Card title="My Transformation Journey">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase font-bold text-center">Before</p>
                    <div className="h-64 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner relative group">
                      {member.transformationPhotos.before ? (
                          <img src={member.transformationPhotos.before} className="w-full h-full object-cover" alt="Before" />
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-700 italic text-sm">
                            No "Before" photo uploaded.
                          </div>
                      )}
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase font-bold text-center">Current / After</p>
                    <div className="h-64 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner relative group">
                      {member.transformationPhotos.after ? (
                          <img src={member.transformationPhotos.after} className="w-full h-full object-cover" alt="After" />
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-700 italic text-sm">
                            No "After" photo uploaded.
                          </div>
                      )}
                    </div>
                </div>
              </div>
            </Card>

            {/* Payment History */}
            <Card title="Membership Payments">
                {transactions && transactions.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-slate-800">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-900/80 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Details</th>
                                <th className="p-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="p-3 text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                                  <td className="p-3 text-slate-200 text-xs">{tx.details}</td>
                                  <td className="p-3 text-right font-bold text-white font-mono">₹{tx.amount}</td>
                                </tr>
                            ))}
                          </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-slate-500 text-sm italic py-4 text-center">No payment history found.</div>
                )}
            </Card>
          </div>

          <div className="space-y-6">
            {/* AI Trainer Tip */}
            <Card className="border-l-4 border-l-gym-accent bg-gym-card/50 shadow-lg relative overflow-hidden">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <i className="fas fa-bolt text-gym-accent"></i> Today's Insight
              </h3>
              <p className="text-slate-300 italic text-sm leading-relaxed">"{tip || 'Analyzing progress...'}"</p>
            </Card>

            {/* Supplement Billing */}
            <Card title="Supplements">
              {member.supplementBills && member.supplementBills.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {member.supplementBills.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(bill => (
                        <div key={bill.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex justify-between items-center group hover:border-orange-500/30 transition-all">
                          <div>
                              <div className="text-white font-bold text-xs">{bill.itemName}</div>
                              <div className="text-[9px] text-slate-500">{new Date(bill.date).toLocaleDateString()}</div>
                          </div>
                          <div className="text-orange-400 font-mono font-bold text-sm">₹{bill.amount}</div>
                        </div>
                    ))}
                  </div>
              ) : (
                  <div className="text-slate-500 text-xs italic py-2 text-center">No purchases.</div>
              )}
            </Card>

            {/* Gym Specific Terms & Conditions */}
            <Card title="Gym Policy & Terms">
               <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                  <div className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                     {gym?.termsAndConditions || 'Standard gym policies apply. Please consult the manager for details.'}
                  </div>
               </div>
               <div className="mt-4 flex flex-col gap-2">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Branch Info</p>
                  <div className="text-xs text-slate-400">
                     <p className="font-bold text-white mb-1">{gym?.name}</p>
                     <p className="mb-1"><i className="fas fa-map-marker-alt mr-2"></i>{gym?.address}, {gym?.city}</p>
                     <p><i className="fas fa-id-card mr-2"></i>Reg: {gym?.idProof || gym?.id}</p>
                  </div>
               </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDashboard;