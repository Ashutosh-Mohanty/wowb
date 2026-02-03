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
          setError('Account suspended. Contact support.');
          return;
      }

      const isExpired = new Date(targetGym.subscriptionExpiry) < new Date();
      if (isExpired) {
          setError('Subscription expired. Contact Admin.');
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
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] px-4 w-full">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-20">
         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gym-accent/30 rounded-full blur-[120px] animate-pulse-slow"></div>
         <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="mb-10 text-center animate-float">
        <div className="w-20 h-20 bg-gradient-to-tr from-gym-accent to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-gym-accent/30 rotate-3">
            <i className="fas fa-dumbbell text-4xl text-white"></i>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
          GymPro <span className="text-transparent bg-clip-text bg-gradient-to-r from-gym-accent to-emerald-400">Central</span>
        </h1>
        <p className="text-slate-400 mt-3 text-lg font-medium">Elevating your fitness business.</p>
      </div>

      <div className="w-full max-w-md relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-gym-accent to-blue-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <Card className="relative bg-slate-950/40 backdrop-blur-xl border-white/5 p-8 sm:p-10">
          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className="bg-slate-900/50 p-1.5 rounded-xl flex gap-1 mb-2">
              {[UserRole.MANAGER, UserRole.MEMBER].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setError(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${role === r ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>

            {role === UserRole.SUPER_ADMIN && (
              <div className="text-center py-2.5 mb-2 bg-blue-500/10 rounded-lg border border-blue-500/20 animate-fade-in">
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <i className="fas fa-shield-alt"></i> Platform Security Mode
                  </p>
              </div>
            )}

            {role !== UserRole.SUPER_ADMIN && (
              <Input 
                label="Gym Identifier" 
                placeholder="Enter Gym ID" 
                icon="fa-hashtag"
                value={gymId} 
                onChange={e => setGymId(e.target.value)}
                disabled={loading}
              />
            )}

            {(role === UserRole.MEMBER || role === UserRole.SUPER_ADMIN) && (
              <Input 
                label={role === UserRole.MEMBER ? "Account ID" : "Admin Username"} 
                placeholder={role === UserRole.MEMBER ? "Mobile or Member ID" : "Username"}
                icon={role === UserRole.MEMBER ? "fa-user" : "fa-user-shield"}
                value={username} 
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
            )}

            <Input 
              label="Access Password" 
              type="password" 
              placeholder="••••••••"
              icon="fa-lock"
              value={password} 
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3 animate-fade-in">
                <i className="fas fa-exclamation-triangle text-base"></i> {error}
              </div>
            )}

            <Button type="submit" className="w-full py-4 rounded-xl" size="lg" isLoading={loading}>
              Sign In to Dashboard
            </Button>
            
            <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/5">
              {role !== UserRole.SUPER_ADMIN ? (
                <button 
                  type="button"
                  onClick={() => setRole(UserRole.SUPER_ADMIN)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors uppercase font-bold tracking-[0.2em]"
                >
                  Administrator Portal
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={() => setRole(UserRole.MANAGER)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors uppercase font-bold tracking-[0.2em]"
                >
                  Return to Member Access
                </button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;