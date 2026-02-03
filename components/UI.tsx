import React from 'react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading,
  children, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gym-dark disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  const variants = {
    primary: "bg-gym-accent hover:bg-gym-accentHover text-white shadow-lg shadow-gym-accent/20 focus:ring-gym-accent",
    secondary: "bg-slate-800 hover:bg-slate-700 text-white focus:ring-slate-500",
    danger: "bg-gym-danger hover:bg-red-600 text-white shadow-lg shadow-red-500/20 focus:ring-red-500",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
    outline: "border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white focus:ring-slate-500",
    ghost: "bg-transparent hover:bg-white/5 text-slate-400 hover:text-white"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
    icon: "w-10 h-10 p-2"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-gym-accent transition-colors">
            <i className={`fas ${icon}`}></i>
          </div>
        )}
        <input
          className={`w-full bg-slate-900/50 border ${error ? 'border-red-500' : 'border-slate-800'} rounded-xl ${icon ? 'pl-11' : 'px-4'} py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gym-accent/50 focus:border-gym-accent transition-all ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500 ml-1">{error}</p>}
    </div>
  );
};

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{label}</label>}
      <div className="relative">
        <select
          className={`w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-gym-accent/50 focus:border-gym-accent appearance-none transition-all ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
           <i className="fas fa-chevron-down text-xs"></i>
        </div>
      </div>
    </div>
  );
};

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; icon?: string }> = ({ children, className = '', title, icon }) => {
  return (
    <div className={`glass rounded-2xl p-6 transition-all duration-300 ${className}`}>
      {title && (
        <div className="flex items-center gap-3 mb-5">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-gym-accent/10 flex items-center justify-center text-gym-accent">
              <i className={`fas ${icon}`}></i>
            </div>
          )}
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
};

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gym-dark/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-gym-card w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl relative z-10 overflow-hidden animate-fade-in">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/30">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Badge ---
export const Badge: React.FC<{ status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' | string }> = ({ status }) => {
  let colorClass = "bg-slate-800 text-slate-400";
  let icon = "fa-circle";
  let label = status;

  if (status === 'ACTIVE') {
    colorClass = "bg-green-500/10 text-green-400 border border-green-500/20";
    icon = "fa-check-circle";
    label = "Active";
  } else if (status === 'EXPIRED') {
    colorClass = "bg-red-500/10 text-red-400 border border-red-500/20";
    icon = "fa-exclamation-circle";
    label = "Expired";
  } else if (status === 'EXPIRING_SOON') {
    colorClass = "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
    icon = "fa-clock";
    label = "Soon";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <i className={`fas ${icon} text-[8px]`}></i>
      {label}
    </span>
  );
};