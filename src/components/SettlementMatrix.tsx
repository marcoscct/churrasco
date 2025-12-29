import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Users, Check, CreditCard, CalendarClock, RotateCcw, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction, Participant, PaymentRecord } from '../types';

import { formatCurrency } from '../utils/format';

interface SettlementMatrixProps {
    settlements: Transaction[];
    participants: Participant[];
    payments: PaymentRecord[];
    onAddPayment: (payer: string, receiver: string, amount: number) => void;
    onDeletePayment: (id: string) => void;
    isSyncing?: boolean;
}

export function SettlementMatrix({ settlements, participants, payments, onAddPayment, onDeletePayment, isSyncing }: SettlementMatrixProps) {
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

    return (
        <div className="space-y-4">
            <div className="flex bg-charcoal-800/50 p-1.5 rounded-xl border border-white/5">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'pending' ? 'bg-gradient-to-r from-red-500/20 to-red-500/10 text-red-400 border border-red-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
                >
                    Pendentes
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-red-500 text-white' : 'bg-charcoal-700'}`}>{settlements.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'completed' ? 'bg-gradient-to-r from-green-500/20 to-green-500/10 text-green-400 border border-green-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
                >
                    Concluídos
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'completed' ? 'bg-green-500 text-white' : 'bg-charcoal-700'}`}>{payments.length}</span>
                </button>
            </div>

            <div className="flex flex-col gap-3 min-h-[200px]">
                {activeTab === 'pending' ? (
                    settlements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-charcoal-500 gap-4 bg-white/5 rounded-2xl border border-dashed border-charcoal-700">
                            <div className="w-16 h-16 rounded-full bg-charcoal-800 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 opacity-50" />
                            </div>
                            <p>Tudo quitado! Nenhum pagamento pendente.</p>
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
                                isSyncing={isSyncing}
                            />
                        ))
                    )
                ) : (
                    payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-charcoal-500 gap-4 bg-white/5 rounded-2xl border border-dashed border-charcoal-700">
                            <div className="w-16 h-16 rounded-full bg-charcoal-800 flex items-center justify-center">
                                <CalendarClock className="w-8 h-8 opacity-50" />
                            </div>
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
                                        {formatCurrency(pay.amount)}
                                    </span>
                                    <button
                                        onClick={() => onDeletePayment(pay.id)}
                                        disabled={isSyncing}
                                        className={`p-2 rounded-lg transition-all ${isSyncing ? 'bg-charcoal-800 text-charcoal-600 cursor-not-allowed' : 'bg-charcoal-800 text-charcoal-500 hover:text-red-400 border border-transparent hover:border-red-500/20'}`}
                                        title="Reverter Pagamento"
                                    >
                                        <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
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

function SettlementItem({ tx, participants, onPay, isSyncing }: { tx: Transaction, participants: Participant[], onPay: () => void, isSyncing?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Identify Group Logic
    const debtorName = tx.from;
    const dependents = participants.filter(p => p.paymentResponsible === debtorName && p.name !== debtorName);
    const debtorParticipant = participants.find(p => p.name === debtorName);
    const groupMembers = [debtorParticipant, ...dependents].filter(Boolean) as Participant[];

    const receiver = participants.find(p => p.name === tx.to);

    return (
        <motion.div
            layout
            className="bg-charcoal-800/50 border border-red-500/10 rounded-xl overflow-hidden shadow-lg shadow-black/20"
        >
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-white text-lg">{tx.from}</span>
                        {dependents.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-charcoal-300 bg-charcoal-900 px-2 py-0.5 rounded border border-white/5 uppercase tracking-wide">
                                <Users className="w-3 h-3" />
                                +{dependents.length}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-charcoal-400">
                        <span>deve para</span>
                        <span className="font-bold text-white">{tx.to}</span>
                    </div>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs text-charcoal-500 flex items-center gap-1 mt-3 hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Ver detalhes
                    </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                        <span className="block text-2xl font-bold text-red-500 font-mono leading-none">
                            {formatCurrency(tx.amount)}
                        </span>
                        <span className="text-xs text-charcoal-500 font-medium uppercase tracking-wider">Pendente</span>
                    </div>

                    <button
                        onClick={onPay}
                        disabled={isSyncing}
                        className={`h-12 w-20 rounded-xl shadow-lg transition-all flex flex-col items-center justify-center gap-0.5 border-b-4 ${isSyncing
                            ? 'bg-charcoal-700 text-charcoal-400 border-charcoal-800 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white shadow-green-900/30 border-green-700 active:border-b-0 active:translate-y-1 active:scale-95'}`}
                        title="Marcar como Pago"
                    >
                        <Check className={`w-5 h-5 ${isSyncing ? 'opacity-50' : ''}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">{isSyncing ? '...' : 'Pagar'}</span>
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="bg-charcoal-900/50 border-t border-white/5"
                    >
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* PIX INFO */}
                            <div>
                                <h4 className="text-xs uppercase text-charcoal-500 font-bold mb-3 flex items-center gap-2">
                                    <CreditCard className="w-3 h-3" /> Dados Bancários
                                </h4>
                                {receiver?.pix ? (
                                    <div className="bg-charcoal-900 rounded-lg p-3 border border-white/5">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs text-charcoal-400 block mb-1">Chave {receiver.pix.type}</span>
                                                <span className="text-white font-mono break-all">{receiver.pix.key}</span>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(receiver.pix?.key || "")}
                                                className="p-1.5 hover:bg-white/10 rounded-lg text-charcoal-400 hover:text-white transition-colors"
                                                title="Copiar Chave"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-charcoal-500 text-sm italic">Nenhuma chave PIX cadastrada.</p>
                                )}
                            </div>

                            {/* COMPOSITION */}
                            <div>
                                <h4 className="text-xs uppercase text-charcoal-500 font-bold mb-3 flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Composição do Valor
                                </h4>
                                <div className="space-y-2">
                                    {groupMembers.map(member => {
                                        // Calculate Personal Debt (Consumption - Paid) independent of Shadow Balance
                                        // "Debt" is positive if they consumed more than they paid
                                        const personalDebt = member.totalConsumed - member.totalPaid;

                                        // We only list those contributing to the debt part (positive personal debt)
                                        // If someone overpaid (negative personal debt), they aren't part of "owing" logic usually, 
                                        // or they reduced the group debt. 
                                        // For simplicity in this context (Composition of Amount Owed), we show the debit contributors.
                                        if (personalDebt <= 0.01) return null;

                                        return (
                                            <div key={member.name} className="flex justify-between text-sm">
                                                <span className="text-charcoal-300">{member.name}</span>
                                                <span className="text-red-400 font-mono text-xs">
                                                    - {formatCurrency(personalDebt).replace('R$', '').trim()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-sm">
                                        <span className="text-white">Total</span>
                                        <span className="text-red-400">{formatCurrency(tx.amount)}</span> {/* tx.amount is positive representation of debt */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
