import { useState, useEffect } from 'react';
import { X, Save, Users, ChevronDown, ChevronUp, Plus, Trash2, AlertCircle, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { Participant, Product, Group } from '../types';

interface ManageParticipantsModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: Participant[];
    products: Product[];
    groups?: Group[];
    onSaveGroups: (groups: Group[]) => void;
    onUpdate: (name: string, data?: { pix?: Participant['pix'], responsible?: string, isHalf?: boolean }) => void;
    onBulkAdd: (names: string[]) => void;
    onToggleConsumption: (productId: string, participantName: string, isConsumed: boolean) => void;
    onUpdatePayer: (productId: string, newPayer: string) => void;
    onRemove: (name: string) => void;
    initialExpandedParticipant?: string;
}

import { ConfirmationModal, type ConfirmationState } from './ConfirmationModal';

export function ManageParticipantsModal({ isOpen, onClose, participants, products, groups = [], onSaveGroups, onUpdate, onBulkAdd, onToggleConsumption, onUpdatePayer, onRemove, initialExpandedParticipant }: ManageParticipantsModalProps) {
    if (!isOpen) return null;

    const [modalTab, setModalTab] = useState<'participants' | 'groups'>('participants');
    const allParticipants = participants;

    const [confirmation, setConfirmation] = useState<ConfirmationState>({
        isOpen: false,
        title: '',
        description: '',
        variant: 'default',
        onConfirm: () => { }
    });

    const requestConfirmation = (config: Omit<ConfirmationState, 'isOpen'>) => {
        setConfirmation({ ...config, isOpen: true });
    };

    const handleConfirm = () => {
        confirmation.onConfirm();
        setConfirmation(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-charcoal-900 w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-charcoal-950/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-ember-500" />
                        Gerenciar Churrasco
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-charcoal-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Tabs */}
                <div className="flex border-b border-white/5 bg-charcoal-950/20">
                    <button
                        onClick={() => setModalTab('participants')}
                        className={`flex-1 p-3.5 text-sm font-semibold transition-colors border-b-2 ${modalTab === 'participants' ? 'border-ember-500 text-ember-400' : 'border-transparent text-charcoal-400 hover:text-white'}`}
                    >
                        Participantes ({participants.length})
                    </button>
                    <button
                        onClick={() => setModalTab('groups')}
                        className={`flex-1 p-3.5 text-sm font-semibold transition-colors border-b-2 ${modalTab === 'groups' ? 'border-ember-500 text-ember-400' : 'border-transparent text-charcoal-400 hover:text-white'}`}
                    >
                        Grupos ({groups.length})
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {modalTab === 'groups' ? (
                        <div className="space-y-6">
                            {/* Group List */}
                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {groups.length === 0 ? (
                                    <p className="text-sm text-charcoal-500 italic text-center py-6">Nenhum grupo criado ainda.</p>
                                ) : (
                                    groups.map(g => (
                                        <div key={g.name} className="bg-charcoal-800/40 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-semibold text-white">{g.name}</h3>
                                                <button
                                                    onClick={() => {
                                                        const updated = groups.filter(group => group.name !== g.name);
                                                        onSaveGroups(updated);
                                                    }}
                                                    className="p-1 hover:bg-white/10 rounded text-red-500 transition-colors"
                                                    title="Excluir Grupo"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-xs text-charcoal-400">
                                                {g.members.length === 0
                                                    ? 'Sem participantes neste grupo'
                                                    : g.members.join(', ')
                                                }
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Create Group Form */}
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-sm font-medium text-charcoal-400 mb-3">Criar Novo Grupo</p>
                                <NewGroupForm
                                    participants={participants}
                                    onAdd={(newGroup) => {
                                        if (groups.some(g => g.name.toLowerCase() === newGroup.name.toLowerCase())) {
                                            alert("Já existe um grupo com este nome.");
                                            return;
                                        }
                                        onSaveGroups([...groups, newGroup]);
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {participants.map((p) => (
                                <ParticipantRow
                                    key={p.name}
                                    participant={p}
                                    allParticipants={allParticipants}
                                    onSave={(data) => onUpdate(p.name, data)}
                                    products={products}
                                    onToggleConsumption={onToggleConsumption}
                                    onUpdatePayer={onUpdatePayer}
                                    onRemove={onRemove}
                                    onRequestConfirmation={requestConfirmation}
                                    defaultExpanded={initialExpandedParticipant === p.name}
                                />
                            ))}

                            {/* New Participant Input */}
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-sm font-medium text-charcoal-400 mb-1">Adicionar Novo</p>
                                <p className="text-xs text-charcoal-500 mb-2">Separe múltiplos nomes por vírgula (,) ou ponto e vírgula (;)</p>
                                <NewParticipantForm onAdd={(nameInput: string) => {
                                    const names = nameInput.split(/[;,]/).map(n => n.trim()).filter(Boolean);
                                    if (names.length > 0) {
                                        onBulkAdd(names);
                                    }
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Custom Confirmation Modal */}
            <ConfirmationModal
                state={confirmation}
                onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirm}
            />
        </div>
    );
}

function ParticipantRow({ participant, allParticipants, onSave, products, onToggleConsumption, onUpdatePayer, onRemove, onRequestConfirmation, defaultExpanded }: {
    participant: Participant,
    allParticipants: Participant[],
    onSave: (data: { pix: NonNullable<Participant['pix']>, responsible: string, isHalf: boolean }) => void,
    products: Product[],
    onToggleConsumption: (pid: string, pname: string, val: boolean) => void,
    onUpdatePayer: (pid: string, newPayer: string) => void,
    onRemove: (name: string) => void,
    onRequestConfirmation: (config: Omit<ConfirmationState, 'isOpen'>) => void,
    defaultExpanded?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || false);

    // Reset expansion state if defaultExpanded changes (e.g. reopening modal with different target)
    useEffect(() => {
        if (defaultExpanded) {
            setIsExpanded(true);
        }
    }, [defaultExpanded]);
    const [activeTab, setActiveTab] = useState<'details' | 'consumption' | 'bought'>('details');

    // Local State for PIX, Responsible and Meia form
    const [pixKey, setPixKey] = useState(participant.pix?.key || '');
    const [pixType, setPixType] = useState(participant.pix?.type || 'CPF');
    const [editingResponsible, setEditingResponsible] = useState(participant.paymentResponsible || '');
    const [isHalf, setIsHalf] = useState(participant.isHalf || false);

    // Update local state when participant prop changes (e.g. after save)
    useEffect(() => {
        setPixKey(participant.pix?.key || '');
        setPixType(participant.pix?.type || 'CPF');
        setEditingResponsible(participant.paymentResponsible || '');
        setIsHalf(participant.isHalf || false);
    }, [participant]);

    const handleSave = () => {
        onSave({
            pix: { key: pixKey, type: pixType },
            responsible: editingResponsible,
            isHalf: isHalf
        });
    };

    return (
        <div className="bg-charcoal-800/50 rounded-xl border border-white/5 overflow-hidden">
            <div
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ember-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-ember-900/20">
                        {participant.name.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-semibold text-white text-lg leading-tight">{participant.name}</p>
                            {participant.isHalf && (
                                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none">
                                    Meia
                                </span>
                            )}
                        </div>
                        {participant.paymentResponsible && (
                            <div className="mt-1.5 bg-charcoal-900/50 px-2 py-0.5 rounded-md border border-white/5 inline-flex items-center gap-1.5">
                                <span className="text-[9px] uppercase tracking-wider text-charcoal-500 font-bold">PAGO POR</span>
                                <span className="text-xs text-charcoal-300 font-medium">{participant.paymentResponsible}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-charcoal-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                        {isExpanded ? 'Fechar' : 'Gerenciar'}
                    </span>
                    <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-white/10 text-white' : 'text-charcoal-500'}`}>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/5">
                            {/* Tabs Header */}
                            <div className="flex border-b border-white/5">
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'details' ? 'bg-white/5 text-ember-400' : 'text-charcoal-400 hover:text-white'}`}
                                >
                                    Dados / PIX
                                </button>
                                <button
                                    onClick={() => setActiveTab('consumption')}
                                    className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'consumption' ? 'bg-white/5 text-blue-400' : 'text-charcoal-400 hover:text-white'}`}
                                >
                                    O que consumiu?
                                </button>
                                <button
                                    onClick={() => setActiveTab('bought')}
                                    className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'bought' ? 'bg-white/5 text-green-400' : 'text-charcoal-400 hover:text-white'}`}
                                >
                                    O que comprou?
                                </button>
                            </div>

                            <div className="p-4 bg-charcoal-900/30">
                                {activeTab === 'details' ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-charcoal-500 font-bold mb-1">
                                                Chave PIX
                                            </label>
                                            <input
                                                type="text"
                                                value={pixKey}
                                                onChange={(e) => setPixKey(e.target.value)}
                                                placeholder="Ex: 123.456.789-00"
                                                className="w-full bg-charcoal-700 border border-charcoal-600 rounded-lg px-3 py-2 text-white placeholder-charcoal-500 focus:outline-none focus:border-ember-500 transition-colors"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs uppercase tracking-wider text-charcoal-500 font-bold mb-1">
                                                    Tipo de Chave
                                                </label>
                                                <select
                                                    value={pixType}
                                                    onChange={(e) => setPixType(e.target.value as any)}
                                                    className="w-full bg-charcoal-700 border border-charcoal-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500 transition-colors"
                                                >
                                                    <option value="CPF">CPF</option>
                                                    <option value="CNPJ">CNPJ</option>
                                                    <option value="EMAIL">E-mail</option>
                                                    <option value="PHONE">Telefone</option>
                                                    <option value="RANDOM">Aleatória</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/5">
                                            <label className="block text-xs uppercase tracking-wider text-charcoal-500 font-bold mb-1">
                                                Quem paga a conta? <span className="text-xxs font-normal normal-case opacity-60">(opcional)</span>
                                            </label>
                                            <p className="text-xs text-charcoal-400 mb-2">
                                                Se definir, <strong>{participant.name}</strong> não aparecerá nos pagamentos. O valor será cobrado do responsável.
                                            </p>
                                            <select
                                                value={editingResponsible}
                                                onChange={(e) => setEditingResponsible(e.target.value)}
                                                className="w-full bg-charcoal-700 border border-charcoal-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500 transition-colors"
                                            >
                                                <option value="">A própria pessoa ({participant.name})</option>
                                                <hr className="border-white/10" />
                                                {allParticipants
                                                    .filter(p => p.name !== participant.name)
                                                    .map(p => (
                                                        <option key={p.name} value={p.name}>{p.name}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>

                                        <div className="pt-2 border-t border-white/5">
                                            <label className="block text-xs uppercase tracking-wider text-charcoal-500 font-bold mb-1">
                                                Tipo de Participação / Divisão
                                            </label>
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-charcoal-900/40 border border-white/5 mt-1">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-sm font-semibold text-white leading-tight">Pagar Meia (Peso 0.5)</p>
                                                    <p className="text-[10px] text-charcoal-400 mt-0.5 leading-normal">Se ativo, esta pessoa pagará metade do valor de uma cota inteira na divisão de itens.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isHalf}
                                                        onChange={(e) => setIsHalf(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ember-600"></div>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex justify-between gap-2 pt-2 border-t border-white/5 mt-4">
                                            <button
                                                onClick={() => {
                                                    onRequestConfirmation({
                                                        title: "Remover Participante",
                                                        description: `Tem certeza que deseja remover ${participant.name}? Essa ação não pode ser desfeita e pode afetar o histórico de pagamentos.`,
                                                        variant: 'danger',
                                                        confirmLabel: 'Sim, remover',
                                                        onConfirm: () => onRemove(participant.name)
                                                    });
                                                }}
                                                className="px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-medium rounded-lg transition-colors flex items-center gap-2 text-xs"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Remover
                                            </button>

                                            <button
                                                onClick={handleSave}
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
                                            >
                                                <Save className="w-4 h-4" />
                                                Salvar Dados
                                            </button>
                                        </div>
                                    </div>
                                ) : activeTab === 'consumption' ? (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {products.filter(p => !p.isPayment).length === 0 ? (
                                            <p className="text-xs text-charcoal-500 italic">Nenhum produto cadastrado.</p>
                                        ) : (
                                            products.filter(p => !p.isPayment).map((prod) => {
                                                const isConsumed = prod.consumers.includes(participant.name);
                                                return (
                                                    <div key={prod.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors group">
                                                        <span className={`text-sm transition-colors max-w-[180px] truncate ${isConsumed ? 'text-white' : 'text-charcoal-400'}`}>{prod.name}</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isConsumed}
                                                                onChange={(e) => onToggleConsumption(prod.id, participant.name, e.target.checked)}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                        </label>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        <p className="text-xs text-charcoal-400 mb-3 bg-white/5 p-2 rounded border border-white/5 flex gap-2">
                                            <AlertCircle className="w-4 h-4 text-ember-500 shrink-0" />
                                            Marque os itens que <strong>{participant.name}</strong> comprou/pagou.
                                        </p>
                                        {products.filter(p => !p.isPayment).length === 0 ? (
                                            <p className="text-xs text-charcoal-500 italic">Nenhum produto cadastrado.</p>
                                        ) : (
                                            products.filter(p => !p.isPayment).map((prod) => {
                                                const isPayer = prod.payer === participant.name;
                                                const otherPayer = !isPayer && prod.payer && prod.payer !== 'Unknown' && prod.payer !== '-' ? prod.payer : null;

                                                return (
                                                    <div key={prod.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors group">
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm transition-colors max-w-[180px] truncate ${isPayer ? 'text-white' : 'text-charcoal-400'}`}>{prod.name}</span>
                                                            {otherPayer && (
                                                                <span className="text-[10px] text-charcoal-500 flex items-center gap-1">
                                                                    <Users className="w-3 h-3" />
                                                                    Pago por {otherPayer}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isPayer}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        if (otherPayer) {
                                                                            onRequestConfirmation({
                                                                                title: "Trocar Pagador",
                                                                                description: `Este item já está marcado como pago por ${otherPayer}. Deseja trocar para ${participant.name}?`,
                                                                                variant: 'warning',
                                                                                confirmLabel: 'Trocar',
                                                                                onConfirm: () => onUpdatePayer(prod.id, participant.name)
                                                                            });
                                                                        } else {
                                                                            onUpdatePayer(prod.id, participant.name);
                                                                        }
                                                                    } else {
                                                                        // Uncheck means removing ownership?
                                                                        onRequestConfirmation({
                                                                            title: "Remover Pagador",
                                                                            description: "Remover este pagador? O item ficará sem dono.",
                                                                            variant: 'warning',
                                                                            confirmLabel: 'Remover',
                                                                            onConfirm: () => onUpdatePayer(prod.id, '-')
                                                                        });
                                                                    }
                                                                }}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                                        </label>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function NewParticipantForm({ onAdd }: { onAdd: (name: string) => void }) {
    const [name, setName] = useState('');
    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nomes (ex: João, Maria; José)..."
                className="flex-1 bg-charcoal-950 border border-charcoal-700 rounded-lg px-3 py-2 text-sm text-white placeholder-charcoal-600 focus:border-ember-500 outline-none"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                        onAdd(name);
                        setName('');
                    }
                }}
            />
            <button
                disabled={!name.trim()}
                onClick={() => {
                    onAdd(name);
                    setName('');
                }}
                className="bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-50 disabled:hover:bg-charcoal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
}

function NewGroupForm({ participants, onAdd }: { participants: Participant[], onAdd: (g: Group) => void }) {
    const [name, setName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    const toggleMember = (mName: string) => {
        setSelectedMembers(prev => 
            prev.includes(mName)
                ? prev.filter(n => n !== mName)
                : [...prev, mName]
        );
    };

    const handleCreate = () => {
        if (!name.trim()) return;
        onAdd({
            name: name.trim(),
            members: selectedMembers
        });
        setName('');
        setSelectedMembers([]);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do grupo (ex: Bebem, Crianças)..."
                    className="flex-1 bg-charcoal-950 border border-charcoal-700 rounded-lg px-3 py-2 text-sm text-white placeholder-charcoal-600 focus:border-ember-500 outline-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && name.trim()) {
                            handleCreate();
                        }
                    }}
                />
                <button
                    disabled={!name.trim()}
                    onClick={handleCreate}
                    className="bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-50 disabled:hover:bg-charcoal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-bold text-charcoal-500 uppercase tracking-wider">Membros do Grupo</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {participants.map(p => {
                        const isChecked = selectedMembers.includes(p.name);
                        return (
                            <button
                                key={p.name}
                                type="button"
                                onClick={() => toggleMember(p.name)}
                                className={clsx(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all border",
                                    isChecked
                                        ? "bg-ember-500/10 border-ember-500/50 text-white"
                                        : "bg-charcoal-850 border-transparent text-charcoal-400 hover:bg-charcoal-800"
                                )}
                            >
                                <div className={clsx(
                                    "w-3 h-3 rounded border flex items-center justify-center transition-colors",
                                    isChecked ? "bg-ember-500 border-ember-500" : "border-charcoal-500"
                                )}>
                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className="truncate">{p.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
