import { useState, useEffect } from 'react';
import { X, Save, Users, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Participant, Product } from '../types';

interface ManageParticipantsModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: Participant[];
    products: Product[];
    onUpdate: (name: string, data?: { pix?: { key: string; type: string }, responsible?: string }) => void;
    onToggleConsumption: (productId: string, participantName: string, isConsumed: boolean) => void;
    initialExpandedParticipant?: string;
}

export function ManageParticipantsModal({ isOpen, onClose, participants, products, onUpdate, onToggleConsumption, initialExpandedParticipant }: ManageParticipantsModalProps) {
    if (!isOpen) return null;

    // Get list of all participants for the responsible selector
    const allParticipants = participants;

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
                        Gerenciar Participantes
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-charcoal-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-4">
                        {participants.map((p) => (
                            <ParticipantRow
                                key={p.name}
                                participant={p}
                                allParticipants={allParticipants}
                                onSave={(data) => onUpdate(p.name, data)}
                                products={products}
                                onToggleConsumption={onToggleConsumption}
                                defaultExpanded={initialExpandedParticipant === p.name}
                            />
                        ))}

                        {/* New Participant Input */}
                        <div className="pt-4 border-t border-white/5">
                            <p className="text-sm font-medium text-charcoal-400 mb-2">Adicionar Novo</p>
                            <NewParticipantForm onAdd={(name: string) => onUpdate(name)} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function ParticipantRow({ participant, allParticipants, onSave, products, onToggleConsumption, defaultExpanded }: {
    participant: Participant,
    allParticipants: Participant[],
    onSave: (data: { pix: { key: string, type: string }, responsible: string }) => void,
    products: Product[],
    onToggleConsumption: (pid: string, pname: string, val: boolean) => void,
    defaultExpanded?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || false);

    // Reset expansion state if defaultExpanded changes (e.g. reopening modal with different target)
    useEffect(() => {
        if (defaultExpanded) {
            setIsExpanded(true);
        }
    }, [defaultExpanded]);
    const [activeTab, setActiveTab] = useState<'details' | 'consumption'>('details');

    // Local State for PIX and Responsible form
    const [pixKey, setPixKey] = useState(participant.pix?.key || '');
    const [pixType, setPixType] = useState(participant.pix?.type || 'CPF');
    const [editingResponsible, setEditingResponsible] = useState(participant.paymentResponsible || '');

    // Update local state when participant prop changes (e.g. after save)
    useEffect(() => {
        setPixKey(participant.pix?.key || '');
        setPixType(participant.pix?.type || 'CPF');
        setEditingResponsible(participant.paymentResponsible || '');
    }, [participant]);

    const handleSave = () => {
        onSave({
            pix: { key: pixKey, type: pixType },
            responsible: editingResponsible
        });
        // Optional: Close expansion on save? No, let user confirm.
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
                        <p className="font-semibold text-white text-lg leading-tight">{participant.name}</p>
                        {participant.paymentResponsible && (
                            <div className="mt-1 bg-charcoal-900/50 px-2 py-0.5 rounded-md border border-white/5 inline-flex items-center gap-1.5">
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

                                        <div className="flex justify-end gap-2 pt-2">
                                            <button
                                                onClick={handleSave}
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
                                            >
                                                <Save className="w-4 h-4" />
                                                Salvar Dados
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {products.length === 0 ? (
                                            <p className="text-xs text-charcoal-500 italic">Nenhum produto cadastrado.</p>
                                        ) : (
                                            products.map((prod) => {
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
                placeholder="Nome..."
                className="flex-1 bg-charcoal-950 border border-charcoal-700 rounded-lg px-3 py-2 text-sm text-white placeholder-charcoal-600 focus:border-ember-500 outline-none"
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
