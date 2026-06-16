import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, FolderOpen, LogOut, Flame, FileSpreadsheet, Loader2, ArrowRight, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
    listBarbecues, 
    createBarbecue, 
    deleteBarbecue, 
    createBarbecueWithData 
} from '../services/firebaseService';
import { fetchSpreadsheetData } from '../services/sheets';

import useDrivePicker from 'react-google-drive-picker';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from '../config/auth';

interface RecentBbq {
    id: string;
    name: string;
    visitedAt: string;
}

export const Dashboard: React.FC = () => {
    const { user, logout, token } = useAuth();
    const navigate = useNavigate();
    
    const [myBarbecues, setMyBarbecues] = useState<any[]>([]);
    const [recentBarbecues, setRecentBarbecues] = useState<RecentBbq[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [openPicker] = useDrivePicker();

    // Import State
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    const loadList = async () => {
        if (!user?.email) return;
        setLoading(true);
        try {
            const list = await listBarbecues(user.email);
            setMyBarbecues(list);
        } catch (error) {
            console.error("Failed to list barbecues from Firestore", error);
        } finally {
            setLoading(false);
        }
    };

    // Load both owner list and recent barbecues from localStorage
    useEffect(() => {
        if (user?.email) {
            loadList();
        }
        
        // Load recent barbecues visited
        try {
            const storedRecents = localStorage.getItem('recent_barbecues');
            if (storedRecents) {
                const parsed = JSON.parse(storedRecents) as RecentBbq[];
                // Filter out my own barbecues to avoid duplication, and sort by date
                setRecentBarbecues(parsed);
            }
        } catch (e) {
            console.error("Failed to parse recent barbecues", e);
        }
    }, [user?.email]);

    const handleCreate = async () => {
        const name = prompt("Nome do Churrasco:", "Churrasco do Fim de Semana");
        if (!name || !user?.email) return;

        setCreating(true);
        try {
            const id = await createBarbecue(name, user.email, user.name);
            navigate(`/churrasco/${id}`);
        } catch (error) {
            console.error("Failed to create barbecue in Firestore:", error);
            alert("Erro ao criar churrasco. Verifique o console.");
        } finally {
            setCreating(false);
        }
    };

    const handleImport = async (fileId: string, fileName: string) => {
        if (!fileId || !token || !user?.email) return;

        setImporting(true);
        setImportError(null);
        try {
            // 1. Fetch data from Google Sheet using user token
            const url = `https://docs.google.com/spreadsheets/d/${fileId}`;
            const sheetData = await fetchSpreadsheetData(url, token);
            
            // 2. Upload to Firestore
            const cleanName = fileName.replace(/\.xlsx$/i, '').replace(/Planilha/i, '').trim();
            const id = await createBarbecueWithData(cleanName || "Churrasco Importado", user.email, user.name, sheetData);
            
            // 3. Navigate to new page
            navigate(`/churrasco/${id}`);
        } catch (error) {
            console.error("Failed to import spreadsheet", error);
            setImportError("Erro ao importar a planilha. Verifique se o formato está correto e se o arquivo tem permissão de leitura.");
        } finally {
            setImporting(false);
        }
    };

    const handleOpenPicker = () => {
        openPicker({
            clientId: GOOGLE_CLIENT_ID,
            developerKey: GOOGLE_API_KEY,
            viewId: "SPREADSHEETS",
            token: token || "",
            showUploadView: true,
            showUploadFolders: true,
            supportDrives: true,
            multiselect: false,
            callbackFunction: (data) => {
                if (data.action === 'picked') {
                    const file = data.docs[0];
                    console.log("Picked file:", file);
                    if (file.id) {
                        handleImport(file.id, file.name || "Churrasco do Drive");
                    }
                }
            },
        });
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Deseja excluir definitivamente o churrasco "${name}"? Esta ação não pode ser desfeita.`)) {
            setLoading(true);
            try {
                await deleteBarbecue(id);
                loadList();
            } catch (err) {
                console.error("Failed to delete from Firestore:", err);
                alert("Erro ao excluir o churrasco do banco de dados.");
                setLoading(false);
            }
        }
    };

    // Filter local recents to not duplicate with own barbecues
    const sharedRecents = recentBarbecues.filter(r => !myBarbecues.some(m => m.id === r.id));

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
            <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Flame className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">ChurrascoApp</h1>
                        <p className="text-xs text-slate-400">Bem-vindo, {user?.name}</p>
                    </div>
                </div>
                <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" title="Sair">
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            <main className="max-w-4xl mx-auto space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="bg-gradient-to-r from-orange-500 to-red-600 p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? (
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                        ) : (
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <span className="font-bold">{creating ? 'Criando...' : 'Novo Churrasco'}</span>
                    </button>

                    <button
                        onClick={handleOpenPicker}
                        disabled={importing}
                        className="bg-slate-800 border border-white/5 p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 hover:bg-slate-700/50 transition-all active:scale-95 group"
                    >
                        {importing ? (
                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        ) : (
                            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center group-hover:bg-slate-600 transition-colors">
                                <FolderOpen className="w-6 h-6 text-blue-400" />
                            </div>
                        )}
                        <span className="font-bold text-slate-200">{importing ? 'Importando...' : 'Importar do Drive'}</span>
                    </button>
                </div>

                {importError && (
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-start gap-2 animate-in slide-in-from-top-2">
                        <span className="mt-0.5">⚠️</span>
                        {importError}
                    </div>
                )}

                {/* Owner's Barbecues */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-300">Meus Churrascos (Criador)</h2>
                        <button onClick={loadList} className="text-xs text-slate-500 hover:text-white">Atualizar</button>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-50" />
                            Carregando seus churrascos...
                        </div>
                    ) : myBarbecues.length === 0 ? (
                        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-3xl p-8 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <FileSpreadsheet className="w-8 h-8 text-slate-600" />
                            </div>
                            <h3 className="text-slate-300 font-medium mb-1">Nenhum churrasco criado por você</h3>
                            <p className="text-sm text-slate-500 max-w-xs mb-4">
                                Crie um novo churrasco acima ou importe uma planilha para começar.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {myBarbecues.map(f => (
                                <div
                                    key={f.id}
                                    onClick={() => navigate(`/churrasco/${f.id}`)}
                                    className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-white/5 hover:border-orange-500/30 hover:bg-slate-700/80 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-orange-950/20 flex items-center justify-center border border-orange-500/20 group-hover:border-orange-500/50 transition-colors">
                                            <Flame className="w-5 h-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200 group-hover:text-white transition-colors">{f.name}</h4>
                                            <p className="text-xs text-slate-400">Criado em {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(f.id, f.name);
                                            }}
                                            className="p-2 bg-transparent hover:bg-red-500/10 hover:text-red-400 rounded-lg text-slate-500 transition-colors"
                                            title="Excluir Churrasco"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-orange-500 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Shared / Visited Barbecues */}
                {sharedRecents.length > 0 && (
                    <section className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-300">Churrascos Compartilhados (Recentes)</h2>
                        </div>
                        <div className="grid gap-3">
                            {sharedRecents.map(f => (
                                <div
                                    key={f.id}
                                    onClick={() => navigate(`/churrasco/${f.id}`)}
                                    className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-white/5 hover:border-orange-500/30 hover:bg-slate-700/80 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-950/20 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/50 transition-colors">
                                            <Users className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200 group-hover:text-white transition-colors">{f.name}</h4>
                                            <p className="text-xs text-slate-400">Acessado em {new Date(f.visitedAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-orange-500 transition-colors" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};
