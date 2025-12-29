import type { Participant, Product } from '../types';
import { ArrowDownLeft, ArrowUpRight, Edit2 } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency } from '../utils/format';

interface ParticipantCardProps {
    participant: Participant;
    products: Product[];
    onEdit: () => void;
}

export function ParticipantCard({ participant, products, onEdit }: ParticipantCardProps) {
    const isReceiver = participant.netBalance > 0.01;
    const isPayer = participant.netBalance < -0.01;
    const isSettled = !isReceiver && !isPayer;

    // Fix for Family Grouping:
    // If netBalance is 0 but Consumption > 0, it likely means they are a Dependent.
    // Or they paid exactly what they consumed.
    // We can check if they have a 'paymentResponsible' set.
    const isDependent = !!participant.paymentResponsible && participant.paymentResponsible !== participant.name;

    const consumedProducts = (products || []).filter(p => p.consumers.includes(participant.name));

    let balanceLabel = "Nada a Pagar/Receber";
    if (isReceiver) balanceLabel = "Saldo a Receber";
    if (isPayer) balanceLabel = "Saldo Devedor";

    // Dependent Display Logic:
    // If dependent, we show "Pagou" as if they paid their consumption (covered by responsible).
    const displayPaid = isDependent ? participant.totalConsumed : participant.totalPaid;

    return (
        <div className={clsx(
            "glass-panel p-5 rounded-xl border-l-4 transition-transform hover:translate-x-1 relative group",
            isSettled ? "border-l-charcoal-500" : isReceiver ? "border-l-green-500" : "border-l-red-500"
        )}>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={onEdit}
                    className="p-2 bg-charcoal-800 hover:bg-white/10 rounded-full text-charcoal-400 hover:text-white transition-colors"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
            </div>

            <div className="flex justify-between items-start mb-4 pr-8">
                <div className="flex flex-col gap-2">
                    <div>
                        <h3 className="font-bold text-lg text-white leading-none">{participant.name}</h3>
                        {participant.pix && (
                            <div className="flex items-center gap-1 text-xs text-charcoal-400 mt-2">
                                <span className="uppercase bg-charcoal-800 px-1 rounded">{participant.pix.type}</span>
                                <span className="font-mono">{participant.pix.key}</span>
                            </div>
                        )}
                    </div>

                    {isDependent && (
                        <div className="bg-charcoal-800/80 p-2 rounded-md border border-white/5 inline-flex flex-col justify-center min-w-[100px]">
                            <p className="text-charcoal-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">PAGO POR</p>
                            <p className="font-bold text-white text-sm leading-tight">{participant.paymentResponsible}</p>
                        </div>
                    )}
                </div>

                {!isSettled && (
                    <div className={clsx(
                        "flex items-center gap-1 font-bold text-sm px-2 py-1 rounded-full",
                        isReceiver ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                    )}>
                        {isReceiver ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        {isReceiver ? "Recebe" : "Paga"}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
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

            {/* Consumption Tags */}
            {consumedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {consumedProducts.map(p => (
                        <span key={p.id} className="text-xs px-2 py-1 rounded bg-charcoal-800/50 text-charcoal-400 border border-white/5 hover:bg-charcoal-800 transition-colors">
                            {p.name}
                        </span>
                    ))}
                </div>
            )}

            <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                <span className="text-sm text-charcoal-400">{balanceLabel}</span>
                <span className={clsx(
                    "text-lg font-bold",
                    isSettled ? "text-charcoal-500" : isReceiver ? "text-green-400" : "text-red-400"
                )}>
                    {isDependent && isSettled
                        ? <span className="text-sm font-normal text-charcoal-500 italic">Zerado no Responsável</span>
                        : <>
                            {isReceiver ? "+" : ""} {formatCurrency(participant.netBalance).replace('- ', '')}
                        </>
                    }
                </span>
            </div>
        </div>
    );
}
