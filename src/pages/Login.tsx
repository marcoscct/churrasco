
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Flame } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export const Login: React.FC = () => {
    const { login, token } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (token) {
            navigate('/dashboard');
        }
    }, [token, navigate]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl">
                <div className="w-20 h-20 bg-gradient-to-tr from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-orange-900/50 shadow-lg transform rotate-3 hover:rotate-6 transition-all">
                    <Flame className="w-10 h-10 text-white" />
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">Churrasco Manager</h1>
                <p className="text-slate-400 mb-8">
                    Gerencie seus churrascos, divida a conta e integre com o Google Planilhas de forma simples e segura.
                </p>

                <button
                    onClick={() => login()}
                    className="w-full bg-white text-slate-900 font-bold py-3 px-6 rounded-xl hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Entrar com Google
                </button>

                <p className="text-xs text-slate-500 mt-6 max-w-xs">
                    Ao entrar, você será solicitado a permitir acesso aos arquivos do Drive criados por este aplicativo.
                </p>
            </div>
        </div>
    );
};
