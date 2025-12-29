import React from 'react';
import { Flame } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onBack }) => {
    return (
        <div className="min-h-screen bg-charcoal-950 text-ember-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-charcoal-900 to-charcoal-950">
            <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="mr-2 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                            </button>
                        )}
                        <div className="p-2 bg-gradient-to-br from-ember-500 to-red-600 rounded-lg shadow-lg shadow-ember-500/20">
                            <Flame className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-gradient">Churrasco</span> Manager
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Auth Button or User Info will go here */}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 pb-32 md:pb-8">
                {children}
            </main>

            <footer className="py-6 text-center text-charcoal-500 text-sm">
                <p>© {new Date().getFullYear()} Churrasco App. Manage your BBQ expenses with style.</p>
            </footer>
        </div>
    );
};
