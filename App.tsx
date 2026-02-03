import React, { useState, useEffect, createContext, useContext } from 'react';
import { AuthState, UserRole } from './types';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import MemberDashboard from './pages/MemberDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// --- Auth Context ---
interface AuthContextType {
  authState: AuthState;
  login: (role: UserRole, data: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

// --- Main App ---
export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    role: null,
  });

  // Rehydrate auth state on mount
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('gym_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed && typeof parsed === 'object' && parsed.isAuthenticated) {
          setAuthState(parsed);
        }
      }
    } catch (e) {
      console.error("Auth hydration error:", e);
      localStorage.removeItem('gym_auth');
    }
  }, []);

  const login = (role: UserRole, data: any) => {
    const newAuth = { isAuthenticated: true, user: data, role };
    setAuthState(newAuth);
    localStorage.setItem('gym_auth', JSON.stringify(newAuth));
  };

  const logout = () => {
    setAuthState({ isAuthenticated: false, user: null, role: null });
    localStorage.removeItem('gym_auth');
  };

  // View Router
  let CurrentView;
  if (!authState.isAuthenticated) {
    CurrentView = <Login onLogin={login} />;
  } else {
    switch (authState.role) {
      case UserRole.SUPER_ADMIN:
        CurrentView = <SuperAdminDashboard />;
        break;
      case UserRole.MANAGER:
        CurrentView = <ManagerDashboard />;
        break;
      case UserRole.MEMBER:
        CurrentView = <MemberDashboard />;
        break;
      default:
        CurrentView = <Login onLogin={login} />;
    }
  }

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      <div className="min-h-screen bg-gym-dark text-gym-text flex flex-col">
        {authState.isAuthenticated && (
           <nav className="border-b border-slate-800 bg-gym-dark/95 backdrop-blur-md sticky top-0 z-50">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between h-16 items-center">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-gym-accent flex items-center justify-center shadow-lg shadow-gym-accent/20">
                     <i className="fas fa-dumbbell text-white text-lg"></i>
                   </div>
                   <span className="font-bold text-xl tracking-tight text-white hidden sm:block">
                     GymPro<span className="text-gym-accent">Central</span>
                   </span>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="text-right hidden sm:block border-r border-slate-800 pr-4 mr-1">
                     <div className="text-sm font-bold text-white">
                        {authState.role === UserRole.SUPER_ADMIN ? 'Platform Admin' : (authState.user as any)?.name}
                     </div>
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                       {authState.role?.replace('_', ' ')}
                     </div>
                   </div>
                   <button 
                    onClick={logout}
                    className="p-2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
                    title="Logout"
                   >
                     <i className="fas fa-sign-out-alt"></i>
                   </button>
                 </div>
               </div>
             </div>
           </nav>
        )}
        <main className={`flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${!authState.isAuthenticated ? 'flex items-center justify-center' : ''}`}>
          <div className="w-full animate-fade-in">
            {CurrentView}
          </div>
        </main>
      </div>
    </AuthContext.Provider>
  );
}