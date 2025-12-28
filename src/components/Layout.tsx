import React from 'react';
import { Flame } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-charcoal-950 text-ember-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-charcoal-900 to-charcoal-950">
            <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
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

            <main className="max-w-5xl mx-auto px-4 py-8">
                {children}
            </main>

            <footer className="py-6 text-center text-charcoal-500 text-sm">
                <p>© {new Date().getFullYear()} Churrasco App. Manage your BBQ expenses with style.</p>
            </footer>
        </div>
    );
};
