import { useState } from 'react';
import type { Participant, Product } from '../types';
import { ArrowDownLeft, ArrowUpRight, Edit2, ChevronDown, ChevronUp, Copy, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';


interface ParticipantCardProps {
    participant: Participant;
    products: Product[];
    onEdit: () => void;
    isExpanded?: boolean;
    onToggle?: () => void;
    // Props para reordenação (arrastar e soltar)
    index: number;
    showAmounts?: boolean;
    isDragging?: boolean;
    isSearching?: boolean;
    onDragStart?: (index: number) => void;
    onDragOver?: (e: React.DragEvent, index: number) => void;
    onDragEnd?: () => void;
    onTouchStart?: (index: number) => void;
}

export function ParticipantCard({ 
    participant, 
    products, 
    onEdit, 
    isExpanded: isExpandedProp, 
    onToggle,
    index,
    showAmounts = true,
    isDragging = false,
    isSearching = false,
    onDragStart,
    onDragOver,
    onDragEnd,
    onTouchStart
}: ParticipantCardProps) {
    const [isExpandedLocal, setIsExpandedLocal] = useState(false);
    const { showToast } = useToast();
    const isExpanded = isExpandedProp !== undefined ? isExpandedProp : isExpandedLocal;
    const toggleExpand = onToggle || (() => setIsExpandedLocal(!isExpandedLocal));
    const isReceiver = participant.netBalance > 0.01;
    const isPayer = participant.netBalance < -0.01;
    const isSettled = !isReceiver && !isPayer;

    const isDependent = !!participant.paymentResponsible && participant.paymentResponsible !== participant.name;
    const consumedProducts = (products || []).filter(p => p.consumers.includes(participant.name));

    let balanceLabel = "Nada a Pagar/Receber";
    if (isReceiver) balanceLabel = "Saldo a Receber";
    if (isPayer) balanceLabel = "Saldo Devedor";

    const displayPaid = isDependent ? participant.totalConsumed : participant.totalPaid;
    const [dragEnabled, setDragEnabled] = useState(false);

    return (
        <div 
            onClick={toggleExpand}
            draggable={!isSearching && dragEnabled}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                e.dataTransfer.effectAllowed = 'move';
                onDragStart?.(index);
            }}
            onDragOver={(e) => onDragOver?.(e, index)}
            onDragEnd={() => {
                onDragEnd?.();
                setDragEnabled(false);
            }}
            data-participant-index={index}
            className={clsx(
                "glass-panel p-4 rounded-xl border-l-4 transition-all relative group select-none",
                isDragging 
                    ? "opacity-30 border-dashed border-2 border-ember-500 scale-95 pointer-events-none" 
                    : (isSettled ? "border-l-charcoal-500 hover:bg-white/5" : isReceiver ? "border-l-green-500 hover:bg-green-500/[0.02]" : "border-l-red-500 hover:bg-red-500/[0.02]"),
                !isSearching && "cursor-pointer"
            )}
        >
            <div className="absolute top-3.5 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    className="p-1.5 bg-charcoal-800 hover:bg-white/10 rounded-full text-charcoal-400 hover:text-white transition-colors"
                    title="Editar Participante"
                >
                    <Edit2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Collapsed Header View */}
            <div className="flex justify-between items-center pr-6">
                <div className="flex items-center gap-3 min-w-0">
                    {!isSearching && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setDragEnabled(true);
                            }}
                            onMouseUp={(e) => {
                                e.stopPropagation();
                                setDragEnabled(false);
                            }}
                            onTouchStart={(e) => {
                                e.stopPropagation();
                                setDragEnabled(true);
                                onTouchStart?.(index);
                            }}
                            onTouchEnd={(e) => {
                                e.stopPropagation();
                                setDragEnabled(false);
                            }}
                            className="cursor-grab active:cursor-grabbing p-1.5 -ml-2 text-charcoal-500 hover:text-white rounded hover:bg-white/5 transition-colors shrink-0 flex items-center justify-center"
                            title="Arrastar para reordenar"
                        >
                            <GripVertical className="w-4 h-4" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-base text-white leading-tight truncate">{participant.name}</h3>
                            {participant.isHalf && (
                                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none shrink-0">
                                    Meia
                                </span>
                            )}
                        </div>
                        {isDependent && (
                            <p className="text-[10px] text-charcoal-500 font-bold uppercase tracking-wider mt-0.5">Pago por {participant.paymentResponsible}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {showAmounts && (
                        <span className={clsx(
                            "text-sm font-bold",
                            isSettled ? "text-charcoal-500" : isReceiver ? "text-green-400" : "text-red-400"
                        )}>
                            {isDependent && isSettled
                                ? <span className="text-xs font-normal text-charcoal-500 italic">Zerado no Responsável</span>
                                : <>
                                    {isReceiver ? "+" : isPayer ? "-" : ""} {formatCurrency(participant.netBalance).replace('- ', '').replace('+', '')}
                                </>
                            }
                        </span>
                    )}
                    <div className="text-charcoal-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {/* Expanded Detailed View */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {participant.pix && (
                        <div className="flex items-center justify-between bg-charcoal-900/50 p-2.5 rounded-lg border border-white/5">
                            <div className="flex items-center gap-2 text-xs text-charcoal-400 min-w-0">
                                <span className="uppercase bg-charcoal-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-charcoal-300 shrink-0">{participant.pix.type}</span>
                                <span className="font-mono truncate select-all">{participant.pix.key}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(participant.pix?.key || "");
                                    showToast(`Chave PIX (${participant.pix?.type}) copiada!`, "success");
                                }}
                                className="p-1 hover:bg-white/10 rounded text-charcoal-400 hover:text-white transition-all active:scale-90"
                                title="Copiar Chave PIX"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-charcoal-900/50 p-3 rounded-lg">
                            <p className="text-charcoal-400 text-xs mb-1">Consumiu</p>
                            <p className="font-semibold text-white">{formatCurrency(participant.totalConsumed)}</p>
                        </div>
                        <div
                            className="bg-charcoal-900/50 p-3 rounded-lg cursor-help transition-colors hover:bg-charcoal-800/50"
                            title={isDependent ? `Pago por ${participant.paymentResponsible}` : undefined}
                        >
                            <p className="text-charcoal-400 text-xs mb-1 flex items-center gap-1">
                                Pagou
                                {isDependent && <span className="text-charcoal-500 font-bold">*</span>}
                            </p>
                            <p className="font-semibold text-white">{formatCurrency(displayPaid)}</p>
                        </div>
                    </div>

                    {consumedProducts.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xxs uppercase tracking-wider font-bold text-charcoal-500">Itens Consumidos</p>
                            <div className="flex flex-wrap gap-1">
                                {consumedProducts.map(p => (
                                    <span key={p.id} className="text-xs px-2 py-1 rounded bg-charcoal-800/50 text-charcoal-400 border border-white/5 hover:bg-charcoal-800 transition-colors">
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-2 flex justify-between items-center text-xs text-charcoal-500 border-t border-white/5">
                        <span>{balanceLabel}</span>
                        {!isSettled && showAmounts && (
                            <span className={clsx(
                                "flex items-center gap-0.5 font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                                isReceiver ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                            )}>
                                {isReceiver ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                {isReceiver ? "Recebe" : "Paga"}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
