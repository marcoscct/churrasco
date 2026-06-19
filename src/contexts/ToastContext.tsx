import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Info, AlertCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Portal Container */}
      <div className="fixed bottom-24 md:bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        <AnimatePresence>
          {toasts.map(toast => {
            const isSuccess = toast.type === 'success';
            const isError = toast.type === 'error';
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className="pointer-events-auto bg-charcoal-900/95 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 shadow-2xl shadow-black/40 overflow-hidden relative group"
              >
                {/* Visual Indicator Line */}
                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                  isSuccess ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-blue-500'
                }`} />

                <div className="flex items-center gap-3 pl-1">
                  {isSuccess && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                  {isError && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
                  {!isSuccess && !isError && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
                  
                  <p className="text-sm font-semibold text-white leading-tight">{toast.message}</p>
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 hover:bg-white/5 rounded-lg text-charcoal-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
