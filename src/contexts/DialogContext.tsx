import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, HelpCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

interface DialogOptions {
    title: string;
    description: string;
    type: 'alert' | 'confirm' | 'prompt';
    defaultValue?: string;
    variant?: 'default' | 'danger' | 'warning';
    resolve: (value: any) => void;
}

interface DialogContextType {
    alert: (title: string, description: string) => Promise<void>;
    confirm: (title: string, description: string, variant?: 'default' | 'danger' | 'warning') => Promise<boolean>;
    prompt: (title: string, description: string, defaultValue?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<DialogOptions | null>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (dialog && dialog.type === 'prompt') {
            setInputValue(dialog.defaultValue || '');
            // Auto-focus input
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [dialog]);

    const alert = (title: string, description: string) => {
        return new Promise<void>((resolve) => {
            setDialog({
                title,
                description,
                type: 'alert',
                resolve: () => {
                    setDialog(null);
                    resolve();
                }
            });
        });
    };

    const confirm = (title: string, description: string, variant: 'default' | 'danger' | 'warning' = 'default') => {
        return new Promise<boolean>((resolve) => {
            setDialog({
                title,
                description,
                type: 'confirm',
                variant,
                resolve: (value: boolean) => {
                    setDialog(null);
                    resolve(value);
                }
            });
        });
    };

    const prompt = (title: string, description: string, defaultValue: string = '') => {
        return new Promise<string | null>((resolve) => {
            setDialog({
                title,
                description,
                type: 'prompt',
                defaultValue,
                resolve: (value: string | null) => {
                    setDialog(null);
                    resolve(value);
                }
            });
        });
    };

    const handleConfirm = () => {
        if (!dialog) return;
        if (dialog.type === 'prompt') {
            dialog.resolve(inputValue);
        } else {
            dialog.resolve(true);
        }
    };

    const handleCancel = () => {
        if (!dialog) return;
        if (dialog.type === 'alert') {
            dialog.resolve(undefined);
        } else if (dialog.type === 'confirm') {
            dialog.resolve(false);
        } else {
            dialog.resolve(null);
        }
    };

    return (
        <DialogContext.Provider value={{ alert, confirm, prompt }}>
            {children}
            <AnimatePresence>
                {dialog && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={handleCancel}
                        />

                        {/* Modal Panel */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-charcoal-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleConfirm();
                                } else if (e.key === 'Escape') {
                                    handleCancel();
                                }
                            }}
                        >
                            {/* Close button */}
                            <button
                                onClick={handleCancel}
                                className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full transition-colors text-charcoal-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="p-6">
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={clsx(
                                        "p-3 rounded-full shrink-0",
                                        dialog.variant === 'danger'
                                            ? "bg-red-500/10 text-red-500"
                                            : dialog.variant === 'warning'
                                                ? "bg-orange-500/10 text-orange-500"
                                                : "bg-ember-500/10 text-ember-500"
                                    )}>
                                        {dialog.type === 'confirm' ? (
                                            <HelpCircle className="w-6 h-6" />
                                        ) : dialog.type === 'prompt' ? (
                                            <Info className="w-6 h-6" />
                                        ) : (
                                            <AlertCircle className="w-6 h-6" />
                                        )}
                                    </div>

                                    {/* Text Content */}
                                    <div className="flex-1 pr-6">
                                        <h3 className="text-lg font-bold text-white mb-2 leading-snug">{dialog.title}</h3>
                                        <p className="text-charcoal-300 text-sm leading-relaxed whitespace-pre-line">{dialog.description}</p>
                                        
                                        {/* Prompt Input */}
                                        {dialog.type === 'prompt' && (
                                            <div className="mt-4">
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={inputValue}
                                                    onChange={(e) => setInputValue(e.target.value)}
                                                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-lg px-3 py-2 text-sm text-white focus:border-ember-500 outline-none transition-colors"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="bg-charcoal-950/50 p-4 border-t border-white/5 flex gap-3 justify-end">
                                {dialog.type !== 'alert' && (
                                    <button
                                        onClick={handleCancel}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-charcoal-300 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    className={clsx(
                                        "px-5 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-transform active:scale-95",
                                        dialog.variant === 'danger'
                                            ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                            : dialog.variant === 'warning'
                                                ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20'
                                                : 'bg-ember-600 hover:bg-ember-500 shadow-ember-900/20'
                                    )}
                                >
                                    {dialog.type === 'alert' ? 'OK' : 'Confirmar'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DialogContext.Provider>
    );
}
