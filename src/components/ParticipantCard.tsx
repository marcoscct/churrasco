import type { Participant, Product } from '../types';
import { ArrowDownLeft, ArrowUpRight, Edit2 } from 'lucide-react';
import { clsx } from 'clsx';

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

    const consumedProducts = products.filter(p => p.consumers.includes(participant.name));

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
                <div>
                    <h3 className="font-bold text-lg text-white">{participant.name}</h3>
                    {participant.pix && (
                        <div className="flex items-center gap-1 text-xs text-charcoal-400 mt-1">
                            <span className="uppercase bg-charcoal-800 px-1 rounded">{participant.pix.type}</span>
                            <span className="font-mono">{participant.pix.key}</span>
                        </div>
                    )}
                    {isDependent && (
                        <div className="mt-1">
                            <span className="text-xxs px-1.5 py-0.5 rounded-full bg-charcoal-800 border border-charcoal-600 text-charcoal-400">
                                Pago por: {participant.paymentResponsible}
                            </span>
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
                    <p className="font-semibold text-white">R$ {participant.totalConsumed.toFixed(2)}</p>
                </div>
                <div className="bg-charcoal-900/50 p-3 rounded-lg">
                    <p className="text-charcoal-400 text-xs mb-1">Pagou</p>
                    <p className="font-semibold text-white">R$ {participant.totalPaid.toFixed(2)}</p>
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
                <span className="text-sm text-charcoal-400">Saldo Final</span>
                <span className={clsx(
                    "text-lg font-bold",
                    isSettled ? "text-charcoal-500" : isReceiver ? "text-green-400" : "text-red-400"
                )}>
                    {isDependent && isSettled
                        ? <span className="text-sm font-normal text-charcoal-500 italic">Zerado no Responsável</span>
                        : <>
                            {isReceiver ? "+" : ""} R$ {participant.netBalance.toFixed(2)}
                        </>
                    }
                </span>
            </div>
        </div>
    );
}
