import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export interface ConfirmationState {
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
    onCancel?: () => void;
}

interface ConfirmationModalProps {
    state: ConfirmationState;
    onClose: () => void;
    onConfirm: () => void;
    onCancel?: () => void;
}

export function ConfirmationModal({ state, onClose, onConfirm, onCancel }: ConfirmationModalProps) {
    if (!state.isOpen) return null;

    const handleCancel = () => {
        if (onCancel) onCancel();
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={handleCancel}
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-charcoal-900 w-full max-w-sm rounded-xl border border-white/10 shadow-2xl relative z-10 overflow-hidden"
                >
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full shrink-0 ${state.variant === 'danger' ? 'bg-red-500/10 text-red-500' : state.variant === 'warning' ? 'bg-orange-500/10 text-orange-500' : 'bg-ember-500/10 text-ember-500'}`}>
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-2">{state.title}</h3>
                                <p className="text-charcoal-300 text-sm leading-relaxed">{state.description}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-charcoal-950/50 p-4 border-t border-white/5 flex gap-3 justify-end">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-charcoal-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            {state.cancelLabel || 'Cancelar'}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-transform active:scale-95 ${state.variant === 'danger'
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                : state.variant === 'warning'
                                    ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20'
                                    : 'bg-ember-600 hover:bg-ember-500 shadow-ember-900/20'
                                }`}
                        >
                            {state.confirmLabel || 'Confirmar'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
