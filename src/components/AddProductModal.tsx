import { useState, useEffect } from 'react';
import { X, Check, Plus, ShoppingBag, Save } from 'lucide-react';
import { clsx } from 'clsx';
import type { Participant, Product, Group } from '../types';
import { useDialog } from '../contexts/DialogContext';

interface AddProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: Participant[];
    groups?: Group[];
    onAdd: (data: { name: string; price: number; payer: string; consumers: string[]; linkedGroupName?: string }) => void;
    onEdit?: (data: { name: string; price: number; payer: string; consumers: string[]; linkedGroupName?: string }) => void;
    productToEdit?: Product;
}

export function AddProductModal({ isOpen, onClose, participants, groups = [], onAdd, onEdit, productToEdit }: AddProductModalProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [payer, setPayer] = useState('');
    const [consumers, setConsumers] = useState<string[]>([]);
    const [linkedGroupName, setLinkedGroupName] = useState<string | undefined>(undefined);
    
    const dialog = useDialog();

    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                // Pre-fill for edit
                setName(productToEdit.name);
                setPrice(productToEdit.price.toString());
                setPayer(productToEdit.payer);
                setConsumers(productToEdit.consumers || []);
                setLinkedGroupName(productToEdit.linkedGroupName);
            } else {
                // Reset for add
                setName('');
                setPrice('');
                setPayer(participants[0]?.name || '');
                setConsumers([]);
                setLinkedGroupName(undefined);
            }
        }
    }, [isOpen, productToEdit, participants]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const priceNum = parseFloat(price.replace(',', '.'));

        // Validation
        if (!name || isNaN(priceNum) || !payer || consumers.length === 0) {
            dialog.alert(
                "Campos Obrigatórios",
                "Por favor, preencha todos os campos e selecione ao menos um consumidor."
            );
            return;
        }

        const data = {
            name,
            price: priceNum,
            payer,
            consumers,
            linkedGroupName
        };

        if (productToEdit && onEdit) {
            onEdit(data);
        } else {
            onAdd(data);
            // Reset form only on Add
            setName('');
            setPrice('');
            setConsumers([]);
            setLinkedGroupName(undefined);
        }
    };

    const toggleConsumer = async (pName: string) => {
        const isChecked = consumers.includes(pName);
        if (linkedGroupName) {
            if (isChecked) {
                // Warning popup on unlinking
                const confirmed = await dialog.confirm(
                    "Desvincular do Grupo",
                    `Ao remover "${pName}" deste item, o consumo deixará de ser associado ao grupo "${linkedGroupName}" e passará a ser um consumo de grupo de pessoas personalizado. Deseja continuar?`,
                    "warning"
                );
                if (!confirmed) return;
                setLinkedGroupName(undefined);
            } else {
                // Quietly unlink on addition
                setLinkedGroupName(undefined);
            }
        }

        setConsumers(prev =>
            prev.includes(pName)
                ? prev.filter(c => c !== pName)
                : [...prev, pName]
        );
    };

    const toggleGroup = (group: Group) => {
        const groupMembers = group.members.filter(mName => participants.some(p => p.name === mName));
        if (groupMembers.length === 0) return;

        const isLinked = linkedGroupName === group.name;
        if (isLinked) {
            // Unlink group and clear its members
            setConsumers([]);
            setLinkedGroupName(undefined);
        } else {
            // Link to this group and set consumers to its members
            setConsumers(groupMembers);
            setLinkedGroupName(group.name);
        }
    };

    const toggleAll = () => {
        if (consumers.length === participants.length) {
            setConsumers([]);
            setLinkedGroupName(undefined);
        } else {
            setConsumers(participants.map(p => p.name));
            setLinkedGroupName(undefined); // Clear since it is all participants, not a specific group
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-charcoal-950/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-charcoal-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-ember-500" />
                        {productToEdit ? 'Editar Produto' : 'Adicionar Produto'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-charcoal-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-charcoal-400 mb-1 uppercase tracking-wider">Nome do Produto</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Picanha, Cerveja..."
                            className="w-full bg-charcoal-950 border border-charcoal-700 rounded-lg px-4 py-3 text-white placeholder-charcoal-600 focus:outline-none focus:border-ember-500 focus:ring-1 focus:ring-ember-500 transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-charcoal-400 mb-1 uppercase tracking-wider">Preço (R$)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-500">R$</span>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    className="w-full bg-charcoal-950 border border-charcoal-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-charcoal-600 focus:outline-none focus:border-ember-500 focus:ring-1 focus:ring-ember-500 transition-all font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-charcoal-400 mb-1 uppercase tracking-wider">Quem Pagou?</label>
                            <select
                                value={payer}
                                onChange={(e) => setPayer(e.target.value)}
                                className="w-full bg-charcoal-950 border border-charcoal-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-ember-500 focus:ring-1 focus:ring-ember-500 transition-all appearance-none animate-none"
                            >
                                <option value="" disabled>Selecione...</option>
                                {participants.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-medium text-charcoal-400 uppercase tracking-wider">Quem Consumiu?</label>
                            <button
                                type="button"
                                onClick={toggleAll}
                                className="text-xs text-ember-500 hover:text-ember-400 font-medium"
                            >
                                {consumers.length === participants.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </button>
                        </div>

                        {/* Group Selection Shortcuts */}
                        {groups.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3 bg-charcoal-950/40 p-2.5 rounded-lg border border-white/5">
                                <span className="text-[10px] uppercase font-bold text-charcoal-500 mr-1 self-center">Grupos:</span>
                                {groups.map(g => {
                                    const validMembers = g.members.filter(m => participants.some(p => p.name === m));
                                    const isLinked = linkedGroupName === g.name;
                                    return (
                                        <button
                                            key={g.name}
                                            type="button"
                                            onClick={() => toggleGroup(g)}
                                            className={clsx(
                                                "text-xxs px-2.5 py-1 rounded-md border font-medium transition-all flex items-center gap-1",
                                                isLinked
                                                    ? "bg-ember-500/20 border-ember-500/50 text-ember-400 hover:bg-ember-500/30"
                                                    : "bg-charcoal-800 border-white/5 text-charcoal-400 hover:bg-charcoal-700 hover:text-white"
                                            )}
                                        >
                                            {isLinked && <Check className="w-2.5 h-2.5" />}
                                            {g.name} ({validMembers.length})
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {participants.map(p => (
                                <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => toggleConsumer(p.name)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border ${consumers.includes(p.name)
                                            ? 'bg-ember-500/10 border-ember-500/50 text-white'
                                            : 'bg-charcoal-800 border-transparent text-charcoal-400 hover:bg-charcoal-700'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${consumers.includes(p.name)
                                            ? 'bg-ember-500 border-ember-500'
                                            : 'border-charcoal-500'
                                        }`}>
                                        {consumers.includes(p.name) && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="truncate">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full py-4 bg-gradient-to-r from-ember-600 to-red-600 hover:from-ember-500 hover:to-red-500 text-white font-bold rounded-xl shadow-lg shadow-ember-900/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <div className="bg-white/20 p-1 rounded-full">
                                {productToEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </div>
                            {productToEdit ? 'Salvar Alterações' : 'Adicionar Produto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
