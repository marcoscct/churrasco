import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Users, Check, CreditCard, CalendarClock, RotateCcw, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction, Participant, PaymentRecord } from '../types';

interface SettlementMatrixProps {
    settlements: Transaction[];
    participants: Participant[];
    payments: PaymentRecord[];
    onAddPayment: (payer: string, receiver: string, amount: number) => void;
    onDeletePayment: (id: string) => void;
}

export function SettlementMatrix({ settlements, participants, payments, onAddPayment, onDeletePayment }: SettlementMatrixProps) {
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

    return (
        <div className="space-y-4">
            <div className="flex bg-charcoal-900/50 p-1 rounded-lg border border-white/5">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pending' ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg' : 'text-charcoal-400 hover:text-white'}`}
                >
                    Pendentes ({settlements.length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-lg' : 'text-charcoal-400 hover:text-white'}`}
                >
                    Concluídos ({payments.length})
                </button>
            </div>

            <div className="flex flex-col gap-3 min-h-[200px]">
                {activeTab === 'pending' ? (
                    settlements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-charcoal-500 gap-2">
                            <CheckCircle2 className="w-12 h-12 opacity-50" />
                            <p>Nenhum pagamento pendente.</p>
                        </div>
                    ) : (
                        settlements.map((tx, idx) => (
                            <SettlementItem
                                key={`${tx.from}-${tx.to}-${idx}`}
                                tx={tx}
                                participants={participants}
                                onPay={() => {
                                    onAddPayment(tx.from, tx.to, tx.amount);
                                }}
                            />
                        ))
                    )
                ) : (
                    payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-charcoal-500 gap-2">
                            <CalendarClock className="w-12 h-12 opacity-50" />
                            <p>Nenhum histórico de pagamento.</p>
                        </div>
                    ) : (
                        payments.slice().reverse().map((pay, idx) => ( // Show newest first
                            <div key={idx} className="bg-charcoal-900/40 border border-green-900/20 rounded-xl p-4 flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity group">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-white font-medium">{pay.from}</span>
                                        <ArrowRight className="w-3 h-3 text-charcoal-500" />
                                        <span className="text-white font-medium">{pay.to}</span>
                                    </div>
                                    <span className="text-xs text-charcoal-500">Pagamento registrado</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-green-500 font-bold font-mono">
                                        R$ {pay.amount.toFixed(2)}
                                    </span>
                                    <button
                                        onClick={() => onDeletePayment(pay.id)}
                                        className="p-1 text-charcoal-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                        title="Reverter Pagamento"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
}

function SettlementItem({ tx, participants, onPay }: { tx: Transaction, participants: Participant[], onPay: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Identify Group Logic
    const debtorName = tx.from;
    const dependents = participants.filter(p => p.paymentResponsible === debtorName);
    const groupMembers = [
        participants.find(p => p.name === debtorName),
        ...dependents
    ].filter(Boolean) as Participant[];

    // Get Receiver Data for PIX
    const receiver = participants.find(p => p.name === tx.to);

    return (
        <div className="bg-charcoal-900/40 glass-panel border-l-4 border-l-red-500 rounded-xl overflow-hidden">
            <div
                className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 md:gap-3 text-sm md:text-base font-medium flex-1 overflow-hidden">
                    <span className="text-red-300 truncate text-right md:text-left font-bold">{tx.from}</span>
                    <div className="flex items-center gap-1 text-charcoal-500 px-1 shrink-0">
                        <ArrowRight className="w-4 h-4" />
                    </div>
                    <span className="text-green-400 truncate font-bold">{tx.to}</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-white text-lg font-bold font-mono">
                        R$ {tx.amount.toFixed(2)}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onPay(); }}
                        className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-full transition-colors border border-green-500/30"
                        title="Marcar como Pago"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button className="text-charcoal-400 hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-charcoal-900/50 border-t border-white/5 text-sm"
                    >
                        <div className="p-4 space-y-4">
                            {/* PIX INFO Section */}
                        </div>
                    </div>

                            {/* Aggregation Details */}
                {groupMembers.length > 1 && (
                    <div>
                        <div className="flex items-center gap-2 text-charcoal-400 text-xs uppercase tracking-wider font-bold mb-2">
                            <Users className="w-3 h-3" />
                            Composição do valor
                        </div>
                        <div className="space-y-1 pl-2 border-l-2 border-charcoal-700">
                            {groupMembers.map(member => {
                                const rawNet = member.totalPaid - member.totalConsumed;
                                return (
                                    <div key={member.name} className="flex justify-between items-center text-charcoal-300 text-xs">
                                        <span>{member.name}</span>
                                        <span className={rawNet < 0 ? "text-red-300" : "text-green-300"}>
                                            {rawNet < 0 ? "Deve" : "Recebe"} R$ {Math.abs(rawNet).toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                            <div className="pt-1 mt-1 border-t border-white/5 text-xxs text-charcoal-500 italic">
                                *Valores originais antes do agrupamento
                            </div>
                        </div>
                    </div>
                )}
        </div>
                    </motion.div >
                )
}
            </AnimatePresence >
        </div >
    );
}
