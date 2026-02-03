
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Input, Button, Card } from '../components/UI';
import { getMembers, getGyms } from '../services/storage';

interface LoginProps {
  onLogin: (role: UserRole, data: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.MANAGER);
  const [gymId, setGymId] = useState('GYM001');
  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (role === UserRole.SUPER_ADMIN) {
          if (username === 'super' && password === 'admin') {
              onLogin(UserRole.SUPER_ADMIN, { name: 'Platform Admin' });
          } else {
              setError('Invalid Super Admin credentials');
          }
          return;
      }

      const gyms = await getGyms();
      const targetGym = gyms.find(g => g.id === gymId);

      if (!targetGym) {
          setError('Gym ID not found');
          return;
      }

      if (targetGym.status === 'PAUSED') {
          setError('This gym account is currently paused. Please contact support.');
          return;
      }

      const isExpired = new Date(targetGym.subscriptionExpiry) < new Date();
      // Fix: Removed redundant 'role !== UserRole.SUPER_ADMIN' check.
      // Since we already handled and returned for UserRole.SUPER_ADMIN at the start of this function,
      // TypeScript correctly identifies that 'role' can only be MANAGER or MEMBER here.
      if (isExpired) {
          setError('Platform subscription expired. Please contact Super Admin.');
          return;
      }

      if (role === UserRole.MANAGER) {
        if (password === targetGym.password) {
          onLogin(UserRole.MANAGER, { ...targetGym, role: UserRole.MANAGER });
        } else {
          setError('Invalid Manager password');
        }
      } else if (role === UserRole.MEMBER) {
        const members = await getMembers(gymId);
        const member = members.find(m => m.id === username || m.phone === username);
        if (member && password === member.password) {
          onLogin(UserRole.MEMBER, member);
        } else {
          setError('Invalid Member credentials');
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="mb-8 text-center animate-bounce-slow">
        <div className="w-16 h-16 bg-gym-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gym-accent/20">
            <i className="fas fa-dumbbell text-3xl text-white"></i>
        </div>
        <h1 className="text-3xl font-bold text-white">GymPro Central</h1>
        <p className="text-slate-400 mt-2">The Ultimate Management Platform</p>
      </div>

      <Card className="w-full max-w-md backdrop-blur-sm bg-gym-card/90">
        <form onSubmit={handleLogin} className="space-y-4">
          
          <div className="bg-slate-800/50 p-1 rounded-lg flex text-xs mb-4">
            {[UserRole.MANAGER, UserRole.MEMBER].map((r) => (
               <button
                 key={r}
                 type="button"
                 onClick={() => {
                   setRole(r);
                   setError('');
                 }}
                 className={`flex-1 py-2 rounded-md transition-all ${role === r ? 'bg-gym-accent text-white shadow' : 'text-slate-400 hover:text-white'}`}
               >
                 {r.replace('_', ' ')}
               </button>
            ))}
          </div>

          {role === UserRole.SUPER_ADMIN && (
             <div className="text-center py-2 mb-2 bg-blue-500/10 rounded border border-blue-500/20">
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Platform Administration Mode</p>
             </div>
          )}

          {role !== UserRole.SUPER_ADMIN && (
            <Input 
              label="Gym ID" 
              placeholder="e.g. GYM001" 
              value={gymId} 
              onChange={e => setGymId(e.target.value)}
              disabled={loading}
            />
          )}

          {(role === UserRole.MEMBER || role === UserRole.SUPER_ADMIN) && (
            <Input 
              label={role === UserRole.MEMBER ? "Mobile Number / ID" : "Admin Username"} 
              placeholder={role === UserRole.MEMBER ? "Enter mobile" : "Enter super admin username"}
              value={username} 
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          )}

          <Input 
            label="Password" 
            type="password" 
            placeholder="Enter password"
            value={password} 
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" isLoading={loading}>
            Login as {role.replace('_', ' ').toLowerCase()}
          </Button>
          
          <div className="flex flex-col gap-2 mt-4">
            <div className="text-center text-[10px] text-slate-500">
               Cloud Integrated: Data persists via Supabase
            </div>
            
            {role !== UserRole.SUPER_ADMIN ? (
              <button 
                type="button"
                onClick={() => setRole(UserRole.SUPER_ADMIN)}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest font-bold mt-2"
              >
                Platform Admin Access
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setRole(UserRole.MANAGER)}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest font-bold mt-2"
              >
                Back to Gym Login
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Login;
