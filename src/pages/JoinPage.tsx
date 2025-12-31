
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchSpreadsheetData } from '../services/sheets';
import type { Participant } from '../types';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';

export function JoinPage() {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [newUserName, setNewUserName] = useState('');
    const [view, setView] = useState<'list' | 'new'>('list');

    useEffect(() => {
        if (!token || !id) return;

        async function load() {
            try {
                const url = `https://docs.google.com/spreadsheets/d/${id}`;
                const data = await fetchSpreadsheetData(url, token!);
                setParticipants(data.participants);
            } catch (err) {
                console.error("Failed to load participants", err);
                alert("Erro ao carregar lista de participantes.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token, id]);

    const handleSelect = (name: string) => {
        navigate(`/churrasco/${id}?edit=${encodeURIComponent(name)}`);
    };

    const handleCreate = () => {
        if (!newUserName.trim()) return;
        navigate(`/churrasco/${id}?new=${encodeURIComponent(newUserName.trim())}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-charcoal-950 flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-ember-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-charcoal-950 text-white p-4 flex flex-col items-center pt-20">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-ember-500 to-orange-600 bg-clip-text text-transparent">
                        Participar do Churrasco
                    </h1>
                    <p className="text-charcoal-400">Quem é você?</p>
                </div>

                {view === 'list' ? (
                    <div className="space-y-3">
                        <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {participants.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => handleSelect(p.name)}
                                    className="w-full p-4 bg-charcoal-900 border border-charcoal-800 hover:border-ember-500/50 hover:bg-charcoal-800 rounded-xl transition-all flex items-center justify-between group"
                                >
                                    <span className="font-medium group-hover:text-ember-400 transition-colors">{p.name}</span>
                                    <ArrowRight className="w-4 h-4 text-charcoal-600 group-hover:text-ember-500 transition-colors" />
                                </button>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <button
                                onClick={() => setView('new')}
                                className="w-full p-4 border border-dashed border-charcoal-600 hover:border-ember-500 text-charcoal-400 hover:text-ember-500 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                Sou novo por aqui
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-charcoal-400">Seu Nome</label>
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-lg px-4 py-3 text-white placeholder-charcoal-600 focus:border-ember-500 outline-none transition-colors"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleCreate}
                                disabled={!newUserName.trim()}
                                className="w-full py-3 bg-ember-600 hover:bg-ember-500 disabled:opacity-50 disabled:hover:bg-ember-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-ember-900/20"
                            >
                                Entrar
                            </button>
                        </div>
                        <button
                            onClick={() => setView('list')}
                            className="w-full text-center text-sm text-charcoal-500 hover:text-charcoal-300"
                        >
                            Voltar para lista
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
