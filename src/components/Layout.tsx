import React from 'react';
import { Flame, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
    onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onBack }) => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-charcoal-950 text-ember-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-charcoal-900 to-charcoal-950">
            <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 md:px-6 py-3.5">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="mr-1 p-2 hover:bg-white/10 rounded-full transition-colors text-charcoal-300 hover:text-white shrink-0"
                                aria-label="Voltar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                            </button>
                        )}
                        <div className="p-1.5 bg-gradient-to-br from-ember-500 to-red-600 rounded-lg shadow-lg shadow-ember-500/20 shrink-0">
                            <Flame className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <h1 className="text-lg md:text-xl font-extrabold tracking-tight truncate">
                            <span className="text-gradient">Churrasco</span>Manager
                        </h1>
                    </div>
                    
                    {user && (
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:flex flex-col text-right">
                                <span className="text-xs font-semibold text-white leading-none">{user.name}</span>
                                <span className="text-[10px] text-charcoal-400 mt-0.5">{user.email}</span>
                            </div>
                            {user.picture ? (
                                <img 
                                    src={user.picture} 
                                    alt={user.name} 
                                    className="w-8 h-8 rounded-full border border-white/10 shadow-md"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-ember-600 text-white font-bold text-xs flex items-center justify-center border border-white/10">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <button 
                                onClick={logout} 
                                className="p-2 hover:bg-red-500/10 rounded-lg text-charcoal-400 hover:text-red-400 transition-colors"
                                title="Sair da Conta"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-8">
                {children}
            </main>

            <footer className="py-6 text-center text-charcoal-600 text-xs border-t border-white/5 bg-charcoal-950/20">
                <p>© {new Date().getFullYear()} Churrasco App. Divisão de despesas de churrasco sem stress.</p>
            </footer>
        </div>
    );
};
