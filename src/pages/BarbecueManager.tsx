import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { ParticipantCard } from '../components/ParticipantCard';
import { SettlementMatrix } from '../components/SettlementMatrix';
import { AddProductModal } from '../components/AddProductModal';
import { ManageParticipantsModal } from '../components/ManageParticipantsModal';
import {
  Plus,
  Users,
  ShoppingBag,
  DollarSign,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit,
  Trash2,
  ArrowLeft,
  Share2
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Product, Participant, Transaction, PaymentRecord } from '../types';
import { fetchSpreadsheetData, deleteAllPaymentsFromSheet } from '../services/sheets';
import { ConfirmationModal, type ConfirmationState } from '../components/ConfirmationModal';

export const BarbecueManager = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settlements, setSettlements] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [debugInfo, setDebugInfo] = useState<any>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isManageParticipantsOpen, setIsManageParticipantsOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<string | undefined>(undefined);
  const [sheetUrl, setSheetUrl] = useState('');

  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => { }
  });

  const loadData = async (url?: string) => {
    setLoading(true);
    setError(null);
    try {
      const targetUrl = id ? `https://docs.google.com/spreadsheets/d/${id}` : (url || sheetUrl);
      const data = await fetchSpreadsheetData(targetUrl, token!);

      // Check for Empty Sheet
      if (data.isEmpty) {
        if (products.length > 0 && confirm("A planilha parece estar vazia. Deseja exportar os dados atuais para ela?")) {
          // Export Logic
          import('../services/sheets').then(({ initializeSheet }) => {
            initializeSheet(targetUrl, products, participants, payments, token!)
              .then(() => {
                alert("Dados exportados com sucesso!");
                loadData(targetUrl); // Reload to confirm
              })
              .catch((e: any) => {
                console.error("Erro na exportação", e);
                setError("Falha ao exportar dados: " + e.message);
              });
          });
          setSheetUrl(targetUrl);
          return;
        }
        // If denied, we load empty? Or keep local?
        // User might want to start fresh.
      }

      setProducts(data.products);
      setParticipants(data.participants);
      setSettlements(data.settlements || []);
      setPayments(data.payments || []);
      setDebugInfo(data.debugInfo || null);
      if (url) setSheetUrl(url); // Confirm URL only on success
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setSheetUrl('');
    setDebugInfo(null);
    // Keep local data or clear?
    // User request: "Desvincular". Usually means keep data but stop syncing.
    // So we do nothing to products/participants.
  };

  useEffect(() => {
    if (token) loadData();
    if (token) loadData();
  }, [token, id]);

  // Ensure sheetUrl is set if we have an ID, to show "Connected" status immediately
  useEffect(() => {
    if (id && !sheetUrl) {
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${id}`);
    }
  }, [id, sheetUrl]);

  // Handle URL Params for "Join" flow
  useEffect(() => {
    if (loading || participants.length === 0) return;

    const editName = searchParams.get('edit');
    const newName = searchParams.get('new');

    if (newName) {
      // Check if exists (Case insensitive lookup)
      const match = participants.find(p => p.name.toLowerCase() === newName.toLowerCase());
      if (match) {
        setEditingParticipant(match.name);
      } else {
        // Create new
        handleUpdateParticipant(newName);
        setEditingParticipant(newName);
      }
      setIsManageParticipantsOpen(true);
      setSearchParams({}, { replace: true });
    } else if (editName) {
      setEditingParticipant(editName);
      setIsManageParticipantsOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [loading, searchParams]); // removed participants to avoid loop if not handled carefully, logic relies on current snapshot which is fine if we update immediately.


  // Helper: Reset Payments
  const handleResetPayments = async () => {
    setLoading(true);
    try {
      await deleteAllPaymentsFromSheet(debugInfo?.sheetId ? null : id || null, sheetUrl, token!);
      // Reload data to reflect
      await loadData();
    } catch (e) {
      console.error("Failed to reset payments", e);
      alert("Erro ao resetar pagamentos.");
      setLoading(false);
    }
  };

  const handleAddProduct = async (data: { name: string; price: number; payer: string; consumers: string[] }) => {
    if (isSyncing) return;
    setIsSyncing(true);
    // Optimistic Update
    const newProduct: Product = {
      id: 'temp-' + Date.now(),
      ...data
    };

    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);

    // Recalculate everything locally
    import('../services/sheets').then(({ calculateStats, addProductToSheet }) => {
      // Reconstruct map
      const pMap = new Map<string, Participant>();
      const currentParticipants = participants.map(p => ({ ...p }));
      currentParticipants.forEach(p => pMap.set(p.name, p));

      // Reconstruct Payments for Calculation
      const paymentItems = payments.map(pay => ({
        id: pay.id,
        name: 'Pagamento',
        price: pay.amount,
        payer: pay.from,
        consumers: [pay.to],
        isPayment: true
      } as Product));

      const allItems = [...updatedProducts, ...paymentItems];

      const result = calculateStats(allItems, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);
      setPayments(result.payments || []);

      // Persist to Sheet using NEW Insert logic
      if (debugInfo?.sheetName && debugInfo?.sheetId) {
        addProductToSheet(
          { ...data, price: data.price },
          data.consumers,
          debugInfo.sheetName,
          debugInfo.sheetId,
          participants, // full list for columns
          sheetUrl,
          token!
        )
          .catch(err => console.error("Failed to add product", err))
          .finally(() => setIsSyncing(false));
      } else {
        setIsSyncing(false);
      }
    });

    console.log("Saving new product:", data);
  };

  /* Logic Updates */
  const [isSyncing, setIsSyncing] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    settlements: true,
    participants: true,
    products: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEditProductSave = async (data: { name: string; price: number; payer: string; consumers: string[] }) => {
    if (!editingProduct || isSyncing) return;
    setIsSyncing(true);

    const updatedList = products.map(p => {
      if (p.id === editingProduct.id) {
        return {
          ...p,
          ...data
        };
      }
      return p;
    });

    setProducts(updatedList);

    // Optimistic UI update done.
    const productToSave = { ...editingProduct, ...data };

    setEditingProduct(undefined);
    setIsProductModalOpen(false);

    console.log("Updated product:", editingProduct.id, data);

    // Recalculate locally
    import('../services/sheets').then(({ calculateStats, updateProductInSheet }) => {
      const pMap = new Map<string, Participant>();
      const currentParticipants = participants.map(p => ({ ...p }));
      currentParticipants.forEach(p => pMap.set(p.name, p));

      // Reconstruct Payments for Calculation
      const paymentItems = payments.map(pay => ({
        id: pay.id,
        name: 'Pagamento',
        price: pay.amount,
        payer: pay.from,
        consumers: [pay.to],
        isPayment: true
      } as Product));

      const allItems = [...updatedList, ...paymentItems];

      const result = calculateStats(allItems, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);
      setPayments(result.payments || []);

      // PERSIST to Sheet
      updateProductInSheet(productToSave, result.participants, debugInfo?.sheetName, sheetUrl)
        .catch(err => {
          console.error("Failed to update product in sheet", err);
        })
        .finally(() => setIsSyncing(false));
    });
  };

  const handleEditProductSave = async (data: { name: string; price: number; payer: string; consumers: string[] }) => {
    if (!editingProduct || isSyncing) return;

    // Check for existing payments
    if (payments.length > 0) {
      setConfirmation({
        isOpen: true,
        title: "Pagamentos em Aberto",
        description: "Existem pagamentos registrados. Alterar este item pode distorcer o balanço. Deseja zerar os pagamentos para recalcular tudo do zero?",
        variant: 'warning',
        confirmLabel: 'Zerar e Salvar',
        cancelLabel: 'Salvar sem Zerar', // This will trigger onClose, which just closes the modal.
        onConfirm: async () => {
          await handleResetPayments();
          await processProductUpdate(data);
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: async () => { // Custom onCancel to handle "Save without Reset"
          await processProductUpdate(data);
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    // If no payments, or user chose to save without resetting
    processProductUpdate(data);
  };

  const handleAddPayment = async (payer: string, receiver: string, amount: number) => {
    if (isSyncing) return;
    setIsSyncing(true);

    // 1. Prepare Data
    const tempId = 'temp-pay-' + Date.now();
    const newPayment: Product = {
      id: tempId,
      name: 'Pagamento',
      price: amount,
      payer: payer,
      consumers: [receiver],
      isPayment: true
    };

    // 2. Reconstruct Full List for Calculation (Products + Existing Payments + New Payment)
    const existingPaymentsAsProducts = payments.map(pay => ({
      id: pay.id,
      name: 'Pagamento',
      price: pay.amount,
      payer: pay.from,
      consumers: [pay.to],
      isPayment: true
    } as Product));

    const allItems = [...products, ...existingPaymentsAsProducts, newPayment];

    // 3. Recalculate State
    import('../services/sheets').then(({ calculateStats, addPaymentToSheet }) => {
      const pMap = new Map<string, Participant>();
      const currentParticipants = participants.map(p => ({ ...p })); // Deep copy to avoid mutation issues
      currentParticipants.forEach(p => pMap.set(p.name, p));

      // Note: calculateStats resets totals on the passed map, so we're safe using a clone
      const result = calculateStats(allItems, pMap, debugInfo?.sheetName);

      setParticipants(result.participants);
      setSettlements(result.settlements);
      setPayments(result.payments || []);

      // 4. Persist
      if (debugInfo?.sheetName && debugInfo?.sheetId) {
        addPaymentToSheet(payer, receiver, amount, debugInfo.sheetName, debugInfo.sheetId, participants, sheetUrl, token!)
          .then((realId) => {
            console.log("Payment persisted. Real ID:", realId);
            const realPaymentId = 'pay-' + realId;

            // Update local payment state to replace temp ID with real ID
            setPayments(prev => prev.map(p => {
              if (p.id === tempId) {
                return { ...p, id: realPaymentId };
              }
              return p;
            }));
          })
          .catch(err => {
            console.error("Failed to persist payment", err);
            alert("Erro ao salvar pagamento na planilha. Recarregue a página.");
            loadData();
          })
          .finally(() => setIsSyncing(false));
      } else {
        setIsSyncing(false);
      }
    });
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (isSyncing) return;
    setIsSyncing(true);

    // 1. Filter out the deleted payment from existing payments
    const updatedPayments = payments.filter(p => p.id !== paymentId);

    // 2. Reconstruct Full List (Products + Remaining Payments)
    const existingPaymentsAsProducts = updatedPayments.map(pay => ({
      id: pay.id,
      name: 'Pagamento',
      price: pay.amount,
      payer: pay.from,
      consumers: [pay.to],
      isPayment: true
    } as Product));

    const allItems = [...products, ...existingPaymentsAsProducts];

    // 3. Recalculate
    import('../services/sheets').then(({ calculateStats, deleteProductFromSheet }) => {
      const pMap = new Map<string, Participant>();
      const currentParticipants = participants.map(p => ({ ...p }));
      currentParticipants.forEach(p => pMap.set(p.name, p));

      const result = calculateStats(allItems, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);
      setPayments(result.payments || []);

      // 4. Persist Deletion
      if (debugInfo?.sheetName && debugInfo?.sheetId) {
        // We pass a dummy product object only with ID because that's what deleteProductFromSheet needs for Payments
        const dummyProduct: any = { id: paymentId, isPayment: true };
        deleteProductFromSheet(dummyProduct, debugInfo.sheetName, debugInfo.sheetId, sheetUrl)
          .then(() => console.log("Payment deleted successfully"))
          .catch(err => {
            console.error("Failed to delete payment", err);
            alert("Erro ao remover pagamento. Recarregue a página.");
            loadData();
          })
          .finally(() => setIsSyncing(false));
      } else {
        setIsSyncing(false);
      }
    });
  };



  const handleRemoveParticipant = (name: string) => {
    if (isSyncing) return;
    if (participants.length <= 1) {
      alert("Não é possível remover o único participante.");
      return;
    }

    setIsSyncing(true);

    // Optimistic Update
    const updatedParticipants = participants.filter(p => p.name !== name);
    // Also remove from products? Or just leave 'x' dangling?
    // 'x' in sheet references column. If column deleted, we fine.
    // Local products state: Remove from consumers list.
    const updatedProducts = products.map(p => ({
      ...p,
      consumers: p.consumers.filter(c => c !== name),
      payer: p.payer === name ? '-' : p.payer
    }));

    setParticipants(updatedParticipants);
    setProducts(updatedProducts);

    import('../services/sheets').then(({ calculateStats, deleteParticipantFromSheet }) => {
      // Recalculate
      const pMap = new Map<string, Participant>();
      updatedParticipants.forEach(p => pMap.set(p.name, p));

      const result = calculateStats(updatedProducts, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);
      setPayments(result.payments || []); // Might remove payments involving this person

      // Persist
      if (debugInfo?.sheetName && debugInfo?.sheetId) {
        deleteParticipantFromSheet(name, debugInfo.sheetName, debugInfo.sheetId, sheetUrl)
          .then(() => console.log("Removed participant"))
          .catch(err => {
            console.error("Failed to remove participant", err);
            alert("Erro ao remover participante da planilha.");
            loadData();
          })
          .finally(() => setIsSyncing(false));
      } else {
        setIsSyncing(false);
      }
    });
  };

  const handleUpdatePayer = (productId: string, newPayer: string) => {
    // Logic inside ManageParticipantsModal expects this
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;

    const updatedProducts = products.map(p => {
      if (p.id === productId) {
        return { ...p, payer: newPayer };
      }
      return p;
    });

    setProducts(updatedProducts);

    // Recalculate
    import('../services/sheets').then(({ calculateStats, updateProductInSheet }) => {
      const pMap = new Map<string, Participant>();
      participants.forEach(p => pMap.set(p.name, p));

      const result = calculateStats(updatedProducts, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);

      if (debugInfo?.sheetName) {
        updateProductInSheet({ ...targetProduct, payer: newPayer }, result.participants, debugInfo.sheetName, sheetUrl)
          .catch(err => console.error("Failed to update payer", err));
      }
    });
  };

  const handleUpdateParticipant = (name: string, data?: { pix?: { key: string; type: string }, responsible?: string }) => {
    let found = false;
    const updated = participants.map(p => {
      if (p.name === name) {
        found = true;
        return {
          ...p,
          ...(data?.pix ? { pix: data.pix as any } : {}),
          ...(data?.responsible !== undefined ? { paymentResponsible: data.responsible } : {})
        };
      }
      return p;
    });

    if (!found) {
      // Add new participant
      updated.push({
        name,
        totalPaid: 0,
        totalConsumed: 0,
        netBalance: 0,
        pix: data?.pix as any, // undefined if not provided
        paymentResponsible: data?.responsible
      });
    }

    setParticipants(updated);
    console.log("Updated participant:", name, data);

    // Persist to Sheet
    if (!found && debugInfo?.sheetName && debugInfo?.sheetId) {
      // NEW Participant -> Insert Column
      import('../services/sheets').then(({ addParticipantToSheet }) => {
        addParticipantToSheet(name, debugInfo.sheetName, debugInfo!.sheetId!, sheetUrl)
          .catch(err => console.error("Failed to add participant col", err));
      });
    }

    if (data) {
      import('../services/sheets').then(({ saveParticipantData }) => {
        saveParticipantData(name, data, sheetUrl).catch(err => {
          console.error("Falha ao salvar dados do participante", err);
        });
      });
    }
  };

  const totalCost = products.filter(p => !p.isPayment).reduce((acc, p) => acc + p.price, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-4">
          {/* Back Button */}
          <button onClick={() => navigate('/dashboard')} className="self-start mb-4 flex items-center gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" /> Voltar
          </button>

          <div className="flex flex-col items-center justify-center h-[50vh] text-charcoal-400 gap-4">
            <RefreshCw className="w-10 h-10 animate-spin text-ember-500" />
            <p>Carregando Dados do Churrasco...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout onBack={() => navigate('/dashboard')}>
        <div className="flex flex-col items-center justify-center p-8 text-red-400 gap-4 max-w-2xl mx-auto mt-20">
          <AlertCircle className="w-12 h-12" />
          <h2 className="text-xl font-semibold">Erro ao Carregar Dados</h2>

          <div className="w-full bg-red-900/10 border border-red-500/20 rounded-lg p-4 text-sm text-center">
            <p className="font-mono mb-2">{error}</p>
            <p className="text-xs text-charcoal-400 mt-2">
              Verifique se você tem permissão de acesso a esta planilha.
            </p>
          </div>


          <div className="w-full max-w-lg mt-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Cole o link da planilha Google aqui..."
                  className="w-full bg-charcoal-700/50 text-white rounded-lg pl-10 pr-4 py-3 border border-charcoal-600 focus:border-ember-500 focus:ring-1 focus:ring-ember-500 transition-all outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadData((e.currentTarget as HTMLInputElement).value);
                      (e.currentTarget as HTMLInputElement).value = ''; // Clear input usually? Or keep?
                      // If we setSheetUrl state, maybe clear input to show status below.
                      (e.currentTarget as HTMLInputElement).value = '';
                    }
                  }}
                />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Google_Sheets_logo_%282014-2020%29.svg/512px-Google_Sheets_logo_%282014-2020%29.svg.png"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-70" alt="Sheet" />
              </div>
            </div>

            {/* Connection Status */}
            {sheetUrl && (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 mt-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                  <span className="text-green-400 text-sm font-medium truncate">
                    Vinculado: <span className="text-white">{debugInfo?.sheetName || 'Planilha'}</span>
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-charcoal-400 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
                  title="Desvincular"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  /*
   INTERCEPT ManageParticipantsModal ACTIONS
   We need to wrap the handlers passed to ManageParticipantsModal to check for payments.
*/

  const handleUpdatePayerWrapped = (productId: string, newPayer: string) => {
    if (payments.length > 0) {
      setConfirmation({
        isOpen: true,
        title: "Pagamentos Existentes",
        description: "Alterar o pagador afetará os saldos. Deseja zerar os pagamentos já realizados?",
        variant: 'warning',
        confirmLabel: 'Zerar e Alterar',
        cancelLabel: 'Apenas Alterar', // This will trigger onClose, which just closes the modal.
        onConfirm: async () => {
          await handleResetPayments();
          handleUpdatePayer(productId, newPayer);
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: async () => { // Custom onCancel to handle "Just Update"
          handleUpdatePayer(productId, newPayer);
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }
    handleUpdatePayer(productId, newPayer);
  };

  const handleToggleConsumption = (productId: string, participantName: string, isConsumed: boolean) => {
    if (payments.length > 0) {
      setConfirmation({
        isOpen: true,
        title: "Pagamentos Existentes",
        description: "Alterar os consumidores afetará os saldos. Deseja zerar os pagamentos já realizados?",
        variant: 'warning',
        confirmLabel: 'Zerar e Alterar',
        cancelLabel: 'Apenas Alterar',
        onConfirm: async () => {
          await handleResetPayments();
          // Proceed with the original logic
          const updated = products.map(p => {
            if (p.id === productId) {
              const newConsumers = isConsumed
                ? [...p.consumers, participantName]
                : p.consumers.filter(c => c !== participantName);
              return { ...p, consumers: newConsumers };
            }
            return p;
          });
          setProducts(updated);

          // Update State
          import('../services/sheets').then(({ calculateStats, updateProductInSheet }) => {
            const pMap = new Map<string, Participant>();
            participants.forEach(part => pMap.set(part.name, { ...part }));

            const result = calculateStats(updated, pMap, debugInfo?.sheetName);
            setParticipants(result.participants);
            setSettlements(result.settlements);

            // Persist
            const targetProduct = updated.find(p => p.id === productId);
            if (targetProduct && debugInfo?.sheetName) {
              updateProductInSheet(targetProduct, result.participants, debugInfo.sheetName, sheetUrl)
                .then(() => console.log("Updated product consumption"))
                .catch(err => console.error("Failed to update consumption", err));
            }
          });
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: async () => {
          // Proceed with the original logic without resetting payments
          const updated = products.map(p => {
            if (p.id === productId) {
              const newConsumers = isConsumed
                ? [...p.consumers, participantName]
                : p.consumers.filter(c => c !== participantName);
              return { ...p, consumers: newConsumers };
            }
            return p;
          });
          setProducts(updated);

          // Update State
          import('../services/sheets').then(({ calculateStats, updateProductInSheet }) => {
            const pMap = new Map<string, Participant>();
            participants.forEach(part => pMap.set(part.name, { ...part }));

            const result = calculateStats(updated, pMap, debugInfo?.sheetName);
            setParticipants(result.participants);
            setSettlements(result.settlements);

            // Persist
            const targetProduct = updated.find(p => p.id === productId);
            if (targetProduct && debugInfo?.sheetName) {
              updateProductInSheet(targetProduct, result.participants, debugInfo.sheetName, sheetUrl)
                .then(() => console.log("Updated product consumption"))
                .catch(err => console.error("Failed to update consumption", err));
            }
          });
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    // Original logic if no payments exist
    const updated = products.map(p => {
      if (p.id === productId) {
        const newConsumers = isConsumed
          ? [...p.consumers, participantName]
          : p.consumers.filter(c => c !== participantName);
        return { ...p, consumers: newConsumers };
      }
      return p;
    });
    setProducts(updated);

    // Update State
    import('../services/sheets').then(({ calculateStats, updateProductInSheet }) => {
      const pMap = new Map<string, Participant>();
      participants.forEach(part => pMap.set(part.name, { ...part }));

      const result = calculateStats(updated, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);

      // Persist
      const targetProduct = updated.find(p => p.id === productId);
      if (targetProduct && debugInfo?.sheetName) {
        updateProductInSheet(targetProduct, result.participants, debugInfo.sheetName, sheetUrl)
          .then(() => console.log("Updated product consumption"))
          .catch(err => console.error("Failed to update consumption", err));
      }
    });
  };

  return (
    <div className="min-h-screen bg-charcoal-950 pb-20 md:pb-0 relative">
      <ConfirmationModal
        state={confirmation}
        onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel} // Pass the custom onCancel handler
      />
      <AddProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(undefined);
        }}
        participants={participants}
        onAdd={handleAddProduct}
        onEdit={handleEditProductSave}
        productToEdit={editingProduct}
      />

      {/* Modal de Gerenciar Participantes */}
      <ManageParticipantsModal
        isOpen={isManageParticipantsOpen}
        onClose={() => {
          setIsManageParticipantsOpen(false);
          setEditingParticipant(undefined);
        }}
        participants={participants}
        products={products}
        initialExpandedParticipant={editingParticipant}
        onUpdate={(name, pix) => handleUpdateParticipant(name, pix as any)}
        onRemove={handleRemoveParticipant}
        onUpdatePayer={handleUpdatePayerWrapped}
        onToggleConsumption={handleToggleConsumption}
      />

      {/* Sheet Input */}
      <div className="mb-8 p-4 glass-panel rounded-xl border border-white/5 bg-charcoal-900/40">
        <label className="block text-xs font-bold text-charcoal-400 mb-2 uppercase tracking-widest">Importar do Google Sheets</label>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Cole o link da planilha aqui..."
            className="w-full bg-charcoal-950/80 border border-charcoal-700/50 rounded-xl px-4 py-3 text-white placeholder-charcoal-600 focus:outline-none focus:border-ember-500/50 focus:ring-1 focus:ring-ember-500/50 transition-all shadow-inner"
          />
          <button
            onClick={() => loadData(sheetUrl)}
            className="w-full md:w-auto px-6 py-3 bg-charcoal-800 hover:bg-charcoal-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-charcoal-900/20 border border-white/5 active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Carregar"}
          </button>
        </div>

        {/* Connection Status Indicator */}
        {sheetUrl && debugInfo?.sheetName && (
          <div className="mt-3 flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-green-400 text-sm font-medium truncate">
                Vinculado: <span className="text-white font-bold">{debugInfo.sheetName}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}#/join/${id}`;
                  navigator.clipboard.writeText(url);
                  // Quick visual feedback
                  const btn = document.getElementById('invite-btn');
                  if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<span class="text-green-400 font-bold">Copiado!</span>';
                    setTimeout(() => {
                      btn.innerHTML = originalText;
                    }, 2000);
                  }
                }}
                id="invite-btn"
                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5 transition-colors border border-transparent hover:border-blue-500/20"
                title="Copiar Link de Convite"
              >
                <Share2 className="w-3 h-3" />
                Convidar
              </button>
              <button
                onClick={handleDisconnect}
                className="text-charcoal-400 hover:text-red-400 text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5 transition-colors border border-transparent hover:border-red-500/20"
                title="Desvincular Planilha"
              >
                <Trash2 className="w-3 h-3" />
                Desvincular
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Overview Cards - Mobile: Grid 2 cols (Cost takes full width? Or compact 2 cols) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-10">
        <div className="col-span-2 md:col-span-1 glass-panel p-5 md:p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-ember-500/10 rounded-full blur-2xl group-hover:bg-ember-500/20 transition-all" />
          <div className="p-3 bg-charcoal-800 rounded-xl shrink-0">
            <DollarSign className="w-6 h-6 text-ember-400" />
          </div>
          <div>
            <p className="text-charcoal-400 text-xs md:text-sm font-medium uppercase tracking-wider">Custo Total</p>
            <p className="text-xl md:text-2xl font-bold text-white">R$ {totalCost.toFixed(2)}</p>
          </div>
        </div>

        <div className="glass-panel p-4 md:p-6 rounded-2xl flex items-center gap-3 md:gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
          <div className="p-2 md:p-3 bg-charcoal-800 rounded-xl shrink-0">
            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-charcoal-400 text-xs md:text-sm font-medium">Participantes</p>
            <p className="text-lg md:text-2xl font-bold text-white leading-none">{participants.length}</p>
          </div>
        </div>

        <div className="glass-panel p-4 md:p-6 rounded-2xl flex items-center gap-3 md:gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all" />
          <div className="p-2 md:p-3 bg-charcoal-800 rounded-xl shrink-0">
            <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
          </div>
          <div>
            <p className="text-charcoal-400 text-xs md:text-sm font-medium">Produtos</p>
            <p className="text-lg md:text-2xl font-bold text-white leading-none">{products.length}</p>
          </div>
        </div>
      </div>

      {/* Mobile Fixed Action Bar (Bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-charcoal-950/80 backdrop-blur-xl border-t border-white/10 z-40 flex gap-3 pb-8">
        <button
          onClick={() => {
            setEditingProduct(undefined);
            setIsProductModalOpen(true);
          }}
          className="flex-1 py-3.5 bg-gradient-to-r from-ember-600 to-red-600 text-white font-bold rounded-xl shadow-lg shadow-ember-900/40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          Add Produto
        </button>
        <button
          onClick={() => setIsManageParticipantsOpen(true)}
          className="flex-1 py-3.5 bg-charcoal-800 text-white font-semibold rounded-xl border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Users className="w-5 h-5" />
          Participantes
        </button>
      </div>

      {/* Desktop Actions */}
      <div className="hidden md:flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => {
            setEditingProduct(undefined);
            setIsProductModalOpen(true);
          }}
          className="px-6 py-3 bg-gradient-to-r from-ember-600 to-red-600 hover:from-ember-500 hover:to-red-500 text-white font-semibold rounded-xl shadow-lg shadow-ember-900/20 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 text-shadow"
        >
          <Plus className="w-5 h-5" />
          Adicionar Produto
        </button>
        <button
          onClick={() => setIsManageParticipantsOpen(true)}
          className="px-6 py-3 glass-panel hover:bg-white/10 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Users className="w-5 h-5" />
          Participantes
        </button>
        <button
          onClick={() => loadData()}
          className="px-4 py-3 glass-panel hover:bg-white/10 text-white rounded-xl transition-all flex items-center justify-center"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* NEW Layout: Products (Top) / Matrix + Participants (Bottom) */}
      <div className="flex flex-col gap-8">

        {/* Top Row: Products (Full Width) */}
        <Section
          title="Produtos"
          icon={<ShoppingBag className="w-5 h-5 text-blue-400" />}
          isExpanded={expandedSections['products']}
          onToggle={() => toggleSection('products')}
        >
          {products.length === 0 ? (
            <div className="text-charcoal-500 italic p-8 text-center space-y-4">
              <p>Nenhum produto encontrado.</p>
            </div>
          ) : (
            <ProductsTable
              products={products}
              debugInfo={debugInfo}
              onEdit={(p) => {
                setEditingProduct(p);
                setIsProductModalOpen(true);
              }}
              onDelete={async (p) => {
                if (isSyncing) return;

                if (confirm(`Tem certeza que deseja excluir "${p.name}"?`)) {
                  setIsSyncing(true);
                  // Optimistic delete
                  const updated = products.filter(prod => prod.id !== p.id);
                  setProducts(updated);

                  // Recalculate
                  import('../services/sheets').then(({ calculateStats, deleteProductFromSheet }) => {
                    const pMap = new Map<string, Participant>();
                    const currentParticipants = participants.map(part => ({ ...part }));
                    currentParticipants.forEach(part => pMap.set(part.name, part));

                    // Reconstruct Payments for Calculation
                    const paymentItems = payments.map(pay => ({
                      id: pay.id,
                      name: 'Pagamento',
                      price: pay.amount,
                      payer: pay.from,
                      consumers: [pay.to],
                      isPayment: true
                    } as Product));

                    const allItems = [...updated, ...paymentItems];

                    const result = calculateStats(allItems, pMap, debugInfo?.sheetName);
                    setParticipants(result.participants);
                    setSettlements(result.settlements);
                    setPayments(result.payments || []);

                    if (debugInfo?.sheetName && debugInfo?.sheetId) {
                      deleteProductFromSheet(p, debugInfo.sheetName, debugInfo.sheetId, sheetUrl)
                        .catch(err => {
                          console.error("Failed to delete product", err);
                          alert("Erro ao excluir produto. Recarregue a página.");
                          loadData();
                        })
                        .finally(() => setIsSyncing(false));
                    } else {
                      setIsSyncing(false);
                    }
                  });
                }
              }}

            />
          )}
        </Section>

        {/* Bottom Row: Matrix and Participants side-by-side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Section
            title="Plano de Pagamentos"
            icon={<RefreshCw className="w-5 h-5 text-green-400" />}
            isExpanded={expandedSections['settlements']}
            onToggle={() => toggleSection('settlements')}
          >
            <SettlementMatrix
              settlements={settlements}
              participants={participants}
              payments={payments}
              onAddPayment={handleAddPayment}
              onDeletePayment={handleDeletePayment}
            // No need for setSettlements here unless we want to drag/drop the CENTRALIZED list, which is tricky.
            // Disabling reorder for centralized view implicitly.
            />
          </Section>

          <Section
            title="Participantes"
            icon={<Users className="w-5 h-5 text-ember-400" />}
            isExpanded={expandedSections['participants']}
            onToggle={() => toggleSection('participants')}
          >
            <div className="space-y-3">
              {participants.map((participant) => (
                <ParticipantCard
                  key={participant.name}
                  participant={participant}
                  products={products}
                  onEdit={() => {
                    setEditingParticipant(participant.name);
                    setIsManageParticipantsOpen(true);
                  }}
                />
              ))}
              <div className="pt-4 mt-4 border-t border-white/5">
                <button
                  onClick={() => setIsManageParticipantsOpen(true)}
                  className="w-full py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white rounded-lg transition-colors text-sm font-medium border border-dashed border-charcoal-600 hover:border-white/20"
                >
                  Gerenciar Participantes...
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>

    </div>
  );
}

const Section = ({ title, icon, isExpanded, onToggle, children }: any) => {
  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-white/5">
      <div
        className="p-4 flex items-center justify-between bg-charcoal-900/50 backdrop-blur-sm select-none border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            {icon}
            {title}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-2 hover:bg-white/10 rounded-lg text-charcoal-400"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: "auto" },
              collapsed: { opacity: 0, height: 0 }
            }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductsTable = ({ products, debugInfo, onEdit, onDelete }: { products: any[], debugInfo: any, onEdit: (p: any) => void, onDelete: (p: any) => void }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  if (products.length === 0) {
    return (
      <div className="text-charcoal-500 italic p-8 text-center space-y-4">
        <p>Nenhum produto encontrado.</p>
        {debugInfo && (
          <div className="text-left bg-charcoal-900 p-4 rounded-xl border border-charcoal-700 font-mono text-xs overflow-x-auto">
            <p className="text-ember-500 font-bold mb-2">Informações de Depuração:</p>
            <p>Nome da Planilha: <span className="text-white">{debugInfo.sheetName}</span></p>
            <p className="mt-2 text-charcoal-400">Primeiras 5 Linhas:</p>
            {debugInfo.firstRows.map((row: string[], i: number) => (
              <div key={i} className="flex gap-2 border-b border-white/5 py-1">
                <span className="text-charcoal-500 w-6">{i + 1}:</span>
                {row.map((cell, j) => (
                  <span key={j} className="bg-white/5 px-1 rounded text-charcoal-300 whitespace-nowrap">
                    {cell || '""'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <table className="w-full text-left text-sm table-fixed">
        <thead className="bg-charcoal-900/50 text-charcoal-400">
          <tr>
            <th className="p-3 font-medium text-xs uppercase tracking-wider w-[40%] md:w-[30%]">Item</th>
            <th className="p-3 font-medium text-xs uppercase tracking-wider w-[25%] md:w-[15%]">Valor</th>
            <th className="p-3 font-medium hidden md:table-cell text-xs uppercase tracking-wider md:w-[20%]">Quem Pagou</th>
            <th className="p-3 font-medium text-xs uppercase tracking-wider w-[25%] md:w-[30%]">Consumidores</th>
            <th className="p-3 w-[10%] md:w-[5%]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {products.filter(p => !p.isPayment && p.name !== 'Pagamento' && !p.id.toString().startsWith('pay-')).map((p: any) => (
            <tr key={p.id} className="hover:bg-white/5 transition-colors group relative">
              <td className="p-3 font-medium text-white truncate pr-2" title={p.name}>
                {p.name}
              </td>
              <td className="p-3 text-charcoal-300 whitespace-nowrap">R$ {p.price.toFixed(2)}</td>
              <td className="p-3 text-charcoal-400 hidden md:table-cell truncate">
                <span className="px-2 py-1 bg-charcoal-800 rounded text-xs">{p.payer}</span>
              </td>
              <td className="p-3 text-charcoal-400">
                <div className="flex flex-wrap gap-1">
                  {/* Show first 3 avatars on mobile, 5 on desktop */}
                  {p.consumers.slice(0, 5).map((c: string, i: number) => (
                    <div key={i} className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-charcoal-700 flex items-center justify-center text-[8px] md:text-[10px] border border-charcoal-800 shrink-0 select-none" title={c}>
                      {c.charAt(0)}
                    </div>
                  ))}
                  {p.consumers.length > 5 && (
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-[8px] md:text-[10px] border border-charcoal-800 shrink-0">
                      +{p.consumers.length - 5}
                    </div>
                  )}
                </div>
              </td>
              <td className="p-3 text-right relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === p.id ? null : p.id);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-charcoal-400 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {openMenuId === p.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-8 top-8 z-50 w-32 bg-charcoal-800 border border-charcoal-600 rounded-xl shadow-2xl overflow-hidden"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(p);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-charcoal-200 hover:bg-white/5 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" /> Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(p);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

