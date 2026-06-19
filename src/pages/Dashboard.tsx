import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, FolderOpen, Flame, FileSpreadsheet, Loader2, ArrowRight, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
    listBarbecues, 
    createBarbecue, 
    deleteBarbecue, 
    createBarbecueWithData 
} from '../services/firebaseService';
import { fetchSpreadsheetData } from '../services/sheets';
import { Layout } from '../components/Layout';

import useDrivePicker from 'react-google-drive-picker';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from '../config/auth';
import { useDialog } from '../contexts/DialogContext';

interface RecentBbq {
    id: string;
    name: string;
    visitedAt: string;
}

export const Dashboard: React.FC = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const dialog = useDialog();
    
    const [myBarbecues, setMyBarbecues] = useState<any[]>([]);
    const [recentBarbecues, setRecentBarbecues] = useState<RecentBbq[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [openPicker] = useDrivePicker();

    // Tab State
    const [dashboardTab, setDashboardTab] = useState<'my' | 'shared'>('my');

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
                setRecentBarbecues(parsed);
            }
        } catch (e) {
            console.error("Failed to parse recent barbecues", e);
        }
    }, [user?.email]);

    const handleCreate = async () => {
        const name = await dialog.prompt("Nome do Churrasco:", "Digite o nome para o seu churrasco:", "Churrasco do Fim de Semana");
        if (!name || !user?.email) return;

        setCreating(true);
        try {
            const id = await createBarbecue(name, user.email, user.name);
            navigate(`/churrasco/${id}`);
        } catch (error) {
            console.error("Failed to create barbecue in Firestore:", error);
            dialog.alert("Erro ao Criar", "Erro ao criar churrasco. Verifique o console.");
        } finally {
            setCreating(false);
        }
    };

    const handleImport = async (fileId: string, fileName: string) => {
        if (!fileId || !token || !user?.email) return;

        setImporting(true);
        setImportError(null);
        try {
            const url = `https://docs.google.com/spreadsheets/d/${fileId}`;
            const sheetData = await fetchSpreadsheetData(url, token);
            const cleanName = fileName.replace(/\.xlsx$/i, '').replace(/Planilha/i, '').trim();
            const id = await createBarbecueWithData(cleanName || "Churrasco Importado", user.email, user.name, sheetData);
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
        const confirmed = await dialog.confirm(
            "Excluir Churrasco",
            `Deseja excluir definitivamente o churrasco "${name}"? Esta ação não pode ser desfeita.`,
            "danger"
        );
        if (confirmed) {
            setLoading(true);
            try {
                await deleteBarbecue(id);
                loadList();
            } catch (err) {
                console.error("Failed to delete from Firestore:", err);
                dialog.alert("Erro ao Excluir", "Erro ao excluir o churrasco do banco de dados.");
                setLoading(false);
            }
        }
    };

    // Filter local recents to not duplicate with own barbecues
    const sharedRecents = recentBarbecues.filter(r => !myBarbecues.some(m => m.id === r.id));

    return (
        <Layout>
            <div className="space-y-6">
                {/* Banner/Intro */}
                <div className="bg-charcoal-900/40 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-ember-500/10 rounded-full blur-3xl group-hover:bg-ember-500/20 transition-all" />
                    <div className="space-y-2 max-w-lg">
                        <h2 className="text-xl md:text-2xl font-black text-white">Churrasco sem complicação!</h2>
                        <p className="text-sm text-charcoal-400">
                            Crie um novo evento ou importe os dados de uma planilha existente no seu Google Drive. Nós cuidamos dos cálculos.
                        </p>
                    </div>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="bg-gradient-to-r from-orange-500 to-red-600 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? (
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                        ) : (
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <span className="font-bold text-base text-white">{creating ? 'Criando...' : 'Novo Churrasco'}</span>
                    </button>

                    <button
                        onClick={handleOpenPicker}
                        disabled={importing}
                        className="bg-charcoal-900/50 border border-white/5 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-3 hover:bg-charcoal-800/80 transition-all active:scale-95 group"
                    >
                        {importing ? (
                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        ) : (
                            <div className="w-10 h-10 bg-charcoal-800 rounded-full flex items-center justify-center group-hover:bg-charcoal-700 transition-colors">
                                <FolderOpen className="w-6 h-6 text-blue-400" />
                            </div>
                        )}
                        <span className="font-bold text-base text-charcoal-200">{importing ? 'Importando...' : 'Importar do Drive'}</span>
                    </button>
                </div>

                {importError && (
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-start gap-2 animate-in slide-in-from-top-2">
                        <span className="mt-0.5">⚠️</span>
                        {importError}
                    </div>
                )}

                {/* Segmented Tab Bar */}
                <div className="flex bg-charcoal-900/50 p-1.5 rounded-xl border border-white/5 gap-1.5">
                    <button
                        onClick={() => setDashboardTab('my')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${dashboardTab === 'my' ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Meus Churrascos
                        <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${dashboardTab === 'my' ? 'bg-orange-500 text-white' : 'bg-charcoal-800'}`}>{myBarbecues.length}</span>
                    </button>
                    <button
                        onClick={() => setDashboardTab('shared')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${dashboardTab === 'shared' ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Compartilhados
                        <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${dashboardTab === 'shared' ? 'bg-blue-500 text-white' : 'bg-charcoal-800'}`}>{sharedRecents.length}</span>
                    </button>
                </div>

                {/* Lists rendering based on tab selection */}
                {dashboardTab === 'my' ? (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal-400">Churrascos que você gerencia</h3>
                            <button onClick={loadList} className="text-xs text-charcoal-400 hover:text-white transition-colors">Atualizar</button>
                        </div>

                        {loading ? (
                            <div className="text-center py-12 text-charcoal-500 flex flex-col items-center">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-50" />
                                Carregando seus churrascos...
                            </div>
                        ) : myBarbecues.length === 0 ? (
                            <div className="bg-charcoal-900/20 border-2 border-dashed border-charcoal-800 rounded-3xl p-10 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-charcoal-900 rounded-full flex items-center justify-center mb-4">
                                    <FileSpreadsheet className="w-8 h-8 text-charcoal-600" />
                                </div>
                                <h4 className="text-charcoal-300 font-semibold mb-1">Nenhum churrasco criado por você</h4>
                                <p className="text-sm text-charcoal-500 max-w-xs mb-4">
                                    Crie um novo churrasco acima ou importe uma planilha para começar.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {myBarbecues.map(f => (
                                    <div
                                        key={f.id}
                                        onClick={() => navigate(`/churrasco/${f.id}`)}
                                        className="bg-charcoal-900/50 p-4 rounded-xl flex items-center justify-between border border-white/5 hover:border-orange-500/30 hover:bg-charcoal-800/80 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-orange-950/20 flex items-center justify-center border border-orange-500/20 group-hover:border-orange-500/50 transition-colors shrink-0">
                                                <Flame className="w-5 h-5 text-orange-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors truncate">{f.name}</h4>
                                                <p className="text-xs text-charcoal-400">Criado em {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(f.id, f.name);
                                                }}
                                                className="p-2 bg-transparent hover:bg-red-500/10 hover:text-red-400 rounded-lg text-charcoal-500 transition-colors"
                                                title="Excluir Churrasco"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <ArrowRight className="w-5 h-5 text-charcoal-500 group-hover:text-orange-500 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal-400">Churrascos compartilhados recentemente</h3>
                        </div>

                        {sharedRecents.length === 0 ? (
                            <div className="bg-charcoal-900/20 border-2 border-dashed border-charcoal-800 rounded-3xl p-10 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-charcoal-900 rounded-full flex items-center justify-center mb-4">
                                    <Users className="w-8 h-8 text-charcoal-600" />
                                </div>
                                <h4 className="text-charcoal-300 font-semibold mb-1">Nenhum churrasco compartilhado</h4>
                                <p className="text-sm text-charcoal-500 max-w-xs">
                                    Acesse churrascos criados por outras pessoas através do link de convite para que eles apareçam aqui.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {sharedRecents.map(f => (
                                    <div
                                        key={f.id}
                                        onClick={() => navigate(`/churrasco/${f.id}`)}
                                        className="bg-charcoal-900/50 p-4 rounded-xl flex items-center justify-between border border-white/5 hover:border-blue-500/30 hover:bg-charcoal-800/80 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-blue-950/20 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/50 transition-colors shrink-0">
                                                <Users className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors truncate">{f.name}</h4>
                                                <p className="text-xs text-charcoal-400">Acessado em {new Date(f.visitedAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-charcoal-500 group-hover:text-blue-500 transition-colors shrink-0 ml-3" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </Layout>
    );
};
