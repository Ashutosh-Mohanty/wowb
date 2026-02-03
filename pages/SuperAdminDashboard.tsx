import React, { useState, useEffect, useMemo } from 'react';
import { Gym } from '../types';
import { getGyms, addGym, updateGym, calculateExpiry, deleteGym as removeGym } from '../services/storage';
import { Card, Button, Input, Modal } from '../components/UI';

const SuperAdminDashboard: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);

  const initialGymForm = {
    id: '', name: '', address: '', city: '', idProof: '',
    password: '',
    joinDate: new Date().toISOString().split('T')[0],
    planDays: 365,
    oneMonth: 1500, twoMonths: 2800, threeMonths: 4000, sixMonths: 8000, twelveMonths: 15000
  };
  const [formData, setFormData] = useState(initialGymForm);

  const refreshGyms = async () => {
    setLoading(true);
    try {
      const data = await getGyms();
      setGyms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshGyms();
  }, []);

  const filteredGyms = gyms.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    return {
      total: gyms.length,
      active: gyms.filter(g => g.status === 'ACTIVE').length,
      paused: gyms.filter(g => g.status === 'PAUSED').length,
      due: gyms.reduce((acc, g) => acc + (g.subscriptionDue || 0), 0)
    };
  }, [gyms]);

  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const joinDate = new Date(formData.joinDate).toISOString();
      const expiry = calculateExpiry(joinDate, Number(formData.planDays));

      const newGym: Gym = {
        id: formData.id || `GYM${Date.now().toString().slice(-4)}`,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        idProof: formData.idProof,
        password: formData.password,
        status: 'ACTIVE',
        createdAt: joinDate,
        subscriptionPlanDays: Number(formData.planDays),
        subscriptionExpiry: expiry,
        termsAndConditions: 'Standard Gym Terms Applied.',
        pricing: {
          oneMonth: Number(formData.oneMonth),
          twoMonths: Number(formData.twoMonths),
          threeMonths: Number(formData.threeMonths),
          sixMonths: Number(formData.sixMonths),
          twelveMonths: Number(formData.twelveMonths),
        },
        subscriptionDue: 100,
        lastPaymentDate: new Date().toISOString()
      };
      await addGym(newGym);
      await refreshGyms();
      setIsAddModalOpen(false);
      setFormData(initialGymForm);
    } catch (err) {
      alert("Error creating gym account");
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGym) return;
    setProcessing(true);
    try {
      const joinDate = new Date(formData.joinDate).toISOString();
      const expiry = calculateExpiry(joinDate, Number(formData.planDays));

      const updated = {
          ...selectedGym,
          name: formData.name,
          address: formData.address,
          city: formData.city,
          idProof: formData.idProof,
          password: formData.password,
          createdAt: joinDate,
          subscriptionPlanDays: Number(formData.planDays),
          subscriptionExpiry: expiry,
          pricing: {
              oneMonth: Number(formData.oneMonth),
              twoMonths: Number(formData.twoMonths),
              threeMonths: Number(formData.threeMonths),
              sixMonths: Number(formData.sixMonths),
              twelveMonths: Number(formData.twelveMonths),
          }
      };
      await updateGym(updated);
      await refreshGyms();
      setIsEditModalOpen(false);
    } catch (err) {
      alert("Error updating gym");
    } finally {
      setProcessing(false);
    }
  };

  const toggleStatus = async (gym: Gym) => {
    try {
      const updated = { ...gym, status: gym.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' as any };
      await updateGym(updated);
      await refreshGyms();
    } catch (err) {
      alert("Status toggle failed");
    }
  };

  const deleteGymById = async (id: string) => {
    if (confirm('Are you sure you want to delete this gym? Data cannot be recovered.')) {
        try {
          await removeGym(id);
          await refreshGyms();
        } catch (err) {
          alert("Deletion failed");
        }
    }
  };

  const startEdit = (gym: Gym) => {
    setSelectedGym(gym);
    setFormData({
        id: gym.id,
        name: gym.name,
        address: gym.address,
        city: gym.city,
        idProof: gym.idProof || '',
        password: gym.password,
        joinDate: gym.createdAt.split('T')[0],
        planDays: gym.subscriptionPlanDays || 365,
        oneMonth: gym.pricing.oneMonth,
        twoMonths: gym.pricing.twoMonths,
        threeMonths: gym.pricing.threeMonths,
        sixMonths: gym.pricing.sixMonths,
        twelveMonths: gym.pricing.twelveMonths
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
           <p className="text-slate-400">Manage cloud-hosted gym subscriptions</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
           <i className="fas fa-plus mr-2"></i> Create Gym Account
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="border-l-4 border-l-blue-500">
            <div className="text-xs text-slate-500 uppercase">Total Gyms</div>
            <div className="text-2xl font-bold text-white">{loading ? '...' : stats.total}</div>
         </Card>
         <Card className="border-l-4 border-l-green-500">
            <div className="text-xs text-slate-500 uppercase">Active</div>
            <div className="text-2xl font-bold text-white">{loading ? '...' : stats.active}</div>
         </Card>
         <Card className="border-l-4 border-l-red-500">
            <div className="text-xs text-slate-500 uppercase">Paused</div>
            <div className="text-2xl font-bold text-white">{loading ? '...' : stats.paused}</div>
         </Card>
         <Card className="border-l-4 border-l-yellow-500">
            <div className="text-xs text-slate-500 uppercase">Revenue Due</div>
            <div className="text-2xl font-bold text-white">{loading ? '...' : `₹${stats.due}`}</div>
         </Card>
      </div>

      <Card title="Gym Directory">
        <div className="mb-4">
           <Input 
             placeholder="Search by ID or Name..." 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             className="max-w-md"
           />
        </div>

        {loading ? (
          <div className="text-center py-20">
            <i className="fas fa-spinner fa-spin text-3xl text-gym-accent mb-4"></i>
            <p className="text-slate-500">Fetching records from cloud...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-sm">
                  <th className="pb-3 pl-2">Gym ID & Name</th>
                  <th className="pb-3">Location</th>
                  <th className="pb-3">ID Proof</th>
                  <th className="pb-3">Platform Expiry</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredGyms.map(gym => {
                  const isPlatformExpired = new Date(gym.subscriptionExpiry) < new Date();
                  return (
                    <tr key={gym.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="font-bold text-white">{gym.name}</div>
                        <div className="text-xs text-slate-500">ID: {gym.id}</div>
                      </td>
                      <td className="py-4 text-sm text-slate-300">
                        <div>{gym.city}</div>
                        <div className="text-[10px] text-slate-500 max-w-[150px] truncate">{gym.address}</div>
                      </td>
                      <td className="py-4 text-sm text-slate-400">
                        {gym.idProof || 'N/A'}
                      </td>
                      <td className="py-4 text-sm font-mono">
                        <span className={isPlatformExpired ? 'text-red-400' : 'text-gym-accent'}>
                          {new Date(gym.subscriptionExpiry).toLocaleDateString()}
                        </span>
                        <div className="text-[10px] text-slate-500">{gym.subscriptionPlanDays} Days Plan</div>
                      </td>
                      <td className="py-4 text-right pr-2">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => startEdit(gym)} title="Edit" className="p-2 text-slate-400 hover:text-white"><i className="fas fa-edit"></i></button>
                           <button onClick={() => toggleStatus(gym)} title={gym.status === 'ACTIVE' ? 'Pause' : 'Activate'} className={`p-2 ${gym.status === 'ACTIVE' ? 'text-yellow-500' : 'text-green-500'}`}>
                              <i className={`fas ${gym.status === 'ACTIVE' ? 'fa-pause' : 'fa-play'}`}></i>
                           </button>
                           <button onClick={() => deleteGymById(gym.id)} title="Delete" className="p-2 text-red-500"><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Gym Account">
        <form onSubmit={handleCreateGym} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <Input label="Gym ID" required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={processing} />
              <Input label="Gym Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={processing} />
           </div>
           <div className="grid grid-cols-2 gap-4">
              <Input label="City" required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} disabled={processing} />
              <Input label="ID Proof (GST/Reg No.)" value={formData.idProof} onChange={e => setFormData({...formData, idProof: e.target.value})} disabled={processing} />
           </div>
           <Input label="Full Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={processing} />
           <Input label="Manager Password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} disabled={processing} />
           
           <div className="p-4 bg-slate-800 rounded-lg space-y-4 border border-slate-700">
              <h4 className="text-sm font-bold text-slate-300">Platform Subscription</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Join Date" type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} disabled={processing} />
                <Input label="Plan Days" type="number" value={formData.planDays} onChange={e => setFormData({...formData, planDays: Number(e.target.value)})} disabled={processing} />
              </div>
           </div>
           
           <div className="p-4 bg-slate-800 rounded-lg space-y-4 border border-slate-700">
              <h4 className="text-sm font-bold text-slate-300">Member Plan Pricing (₹)</h4>
              <div className="grid grid-cols-5 gap-2">
                <Input label="1m" type="number" value={formData.oneMonth} onChange={e => setFormData({...formData, oneMonth: Number(e.target.value)})} disabled={processing} />
                <Input label="2m" type="number" value={formData.twoMonths} onChange={e => setFormData({...formData, twoMonths: Number(e.target.value)})} disabled={processing} />
                <Input label="3m" type="number" value={formData.threeMonths} onChange={e => setFormData({...formData, threeMonths: Number(e.target.value)})} disabled={processing} />
                <Input label="6m" type="number" value={formData.sixMonths} onChange={e => setFormData({...formData, sixMonths: Number(e.target.value)})} disabled={processing} />
                <Input label="12m" type="number" value={formData.twelveMonths} onChange={e => setFormData({...formData, twelveMonths: Number(e.target.value)})} disabled={processing} />
              </div>
           </div>
           <Button type="submit" className="w-full" isLoading={processing}>Save Gym</Button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Gym Account">
        <form onSubmit={handleUpdateGym} className="space-y-4">
           <Input label="Gym Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={processing} />
           <div className="grid grid-cols-2 gap-4">
              <Input label="City" required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} disabled={processing} />
              <Input label="ID Proof" value={formData.idProof} onChange={e => setFormData({...formData, idProof: e.target.value})} disabled={processing} />
           </div>
           <Input label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={processing} />
           <Input label="Manager Password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} disabled={processing} />
           
           <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                <Input label="Join Date" type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} disabled={processing} />
                <Input label="Plan Days" type="number" value={formData.planDays} onChange={e => setFormData({...formData, planDays: Number(e.target.value)})} disabled={processing} />
           </div>
           
           <div className="grid grid-cols-5 gap-2">
                <Input label="1m" type="number" value={formData.oneMonth} onChange={e => setFormData({...formData, oneMonth: Number(e.target.value)})} disabled={processing} />
                <Input label="2m" type="number" value={formData.twoMonths} onChange={e => setFormData({...formData, twoMonths: Number(e.target.value)})} disabled={processing} />
                <Input label="3m" type="number" value={formData.threeMonths} onChange={e => setFormData({...formData, threeMonths: Number(e.target.value)})} disabled={processing} />
                <Input label="6m" type="number" value={formData.sixMonths} onChange={e => setFormData({...formData, sixMonths: Number(e.target.value)})} disabled={processing} />
                <Input label="12m" type="number" value={formData.twelveMonths} onChange={e => setFormData({...formData, twelveMonths: Number(e.target.value)})} disabled={processing} />
           </div>
           <Button type="submit" className="w-full" isLoading={processing}>Update Details</Button>
        </form>
      </Modal>
    </div>
  );
};

export default SuperAdminDashboard;