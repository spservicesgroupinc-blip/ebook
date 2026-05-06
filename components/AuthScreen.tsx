
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { CloudService, BACKEND_URL } from '../services/cloud';
import { Feather, Loader2, Lock, User as UserIcon, Link, ShieldCheck } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize URL: Prioritize the constant from code, then localStorage, then empty
  const [backendUrl, setBackendUrl] = useState('');
  
  useEffect(() => {
    if (BACKEND_URL && BACKEND_URL.trim() !== "") {
      setBackendUrl(BACKEND_URL);
    } else {
      setBackendUrl(localStorage.getItem('lore_backend_url') || '');
    }
  }, []);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendUrl) {
      setError("Please configure the library server URL.");
      return;
    }
    
    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      if (!BACKEND_URL) {
        localStorage.setItem('lore_backend_url', backendUrl);
      }

      let user: User;
      if (isLogin) {
        user = await CloudService.login(backendUrl, username, password);
      } else {
        user = await CloudService.signup(backendUrl, username, password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="bg-white max-w-md w-full p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-100">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white shadow-xl shadow-slate-900/20">
             <Feather size={32} strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Lore Studio</h1>
          <p className="text-slate-500 mt-2 font-medium">Your personalized ghostwriting platform</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
            <button 
                type="button"
                onClick={() => { setIsLogin(true); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Sign In
            </button>
            <button 
                type="button"
                onClick={() => { setIsLogin(false); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Create Account
            </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-lg flex items-start gap-3">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* URL input */}
          {(!BACKEND_URL || BACKEND_URL === "") && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workspace Server URL</label>
              <div className="relative">
                <div className="absolute left-4 top-3.5 text-slate-400"><Link size={18} /></div>
                <input 
                  type="url" 
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none text-sm font-medium transition-colors"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workspace Username</label>
            <div className="relative">
              <div className="absolute left-4 top-3.5 text-slate-400"><UserIcon size={18} /></div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Author Name"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <div className="absolute left-4 top-3.5 text-slate-400"><Lock size={18} /></div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-colors"
                required
              />
            </div>
          </div>

          {!isLogin && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative">
                <div className="absolute left-4 top-3.5 text-slate-400"><ShieldCheck size={18} /></div>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-colors"
                  required
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 mt-8 text-lg"
          >
            {isLoading ? <Loader2 className="animate-spin" size={22} /> : (isLogin ? 'Sign In to Workspace' : 'Create Author Account')}
          </button>
        </form>
      </div>
    </div>
  );
};
