import { useState, useEffect, useRef } from 'react';
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
  MoreVertical,
  Edit,
  Trash2,
  ArrowLeft,
  Share2,
  Search
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Product, Participant, Transaction, PaymentRecord, SheetData, Group } from '../types';
import { deleteAllPaymentsFromSheet } from '../services/sheets';
import { ConfirmationModal, type ConfirmationState } from '../components/ConfirmationModal';
import { subscribeToBarbecue } from '../services/firebaseService';
import { exportBarbecueToGoogleSheets } from '../services/sheetsExport';
import { FileSpreadsheet, Loader2, Flame } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';


export const BarbecueManager = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'participants' | 'settlements'>('overview');
  const [products, setProducts] = useState<Product[]>([]);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settlements, setSettlements] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [debugInfo, setDebugInfo] = useState<SheetData['debugInfo'] | null>(null);

  // Refs to avoid infinite loops in loadData dependency array
  const productsRef = useRef(products);
  const participantsRef = useRef(participants);
  const paymentsRef = useRef(payments);

  useEffect(() => {
    productsRef.current = products;
    participantsRef.current = participants;
    paymentsRef.current = payments;
  }, [products, participants, payments]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isManageParticipantsOpen, setIsManageParticipantsOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<string | undefined>(undefined);

  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [showAmounts, setShowAmounts] = useState(() => {
    const saved = localStorage.getItem('bbq_show_amounts');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('bbq_show_amounts', showAmounts.toString());
  }, [showAmounts]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    draggedIndexRef.current = draggedIndex;
  }, [draggedIndex]);

  const handleDragStart = (index: number) => {
    if (participantSearchQuery) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const currentDragged = draggedIndexRef.current;
    if (currentDragged === null || currentDragged === index || participantSearchQuery) return;

    // Swap items in state
    const currentParticipants = [...participantsRef.current];
    const temp = currentParticipants[currentDragged];
    currentParticipants[currentDragged] = currentParticipants[index];
    currentParticipants[index] = temp;

    setDraggedIndex(index);
    setParticipants(currentParticipants);
  };

  const handleDragEnd = async () => {
    const finalIndex = draggedIndexRef.current;
    setDraggedIndex(null);

    if (finalIndex !== null) {
      try {
        const { saveParticipantsOrder } = await import('../services/sheets');
        await saveParticipantsOrder(participantsRef.current, id!);
      } catch (err) {
        console.error("Failed to save reordered participants:", err);
      }
    }
  };

  const handleTouchStart = (index: number) => {
    if (participantSearchQuery) return;
    setDraggedIndex(index);
  };

  useEffect(() => {
    if (draggedIndex === null) return;

    const handleTouchMove = (e: TouchEvent) => {
      const currentDragged = draggedIndexRef.current;
      if (currentDragged === null) return;

      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!element) return;

      const card = element.closest('[data-participant-index]');
      if (!card) return;

      const targetIndex = Number(card.getAttribute('data-participant-index'));
      if (isNaN(targetIndex) || targetIndex === currentDragged) return;

      // Swap items in state
      const currentParticipants = [...participantsRef.current];
      const temp = currentParticipants[currentDragged];
      currentParticipants[currentDragged] = currentParticipants[targetIndex];
      currentParticipants[targetIndex] = temp;

      setDraggedIndex(targetIndex);
      setParticipants(currentParticipants);
    };

    const handleTouchEnd = async () => {
      const finalIndex = draggedIndexRef.current;
      setDraggedIndex(null);

      if (finalIndex !== null) {
        try {
          const { saveParticipantsOrder } = await import('../services/sheets');
          await saveParticipantsOrder(participantsRef.current, id!);
        } catch (err) {
          console.error("Failed to save reordered participants:", err);
        }
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [draggedIndex, id]);

  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => { }
  });

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    const unsubscribe = subscribeToBarbecue(
      id,
      (data) => {
        setProducts(data.products);
        setParticipants(data.participants);
        setSettlements(data.settlements || []);
        setPayments(data.payments || []);
        setGroups(data.groups || []);
        setDebugInfo(data.debugInfo || null);
        setLoading(false);
        
        // Save to recent list in localStorage
        try {
          const recentsStr = localStorage.getItem('recent_barbecues') || '[]';
          const recents = JSON.parse(recentsStr) as any[];
          const filtered = recents.filter((item: any) => item.id !== id);
          filtered.unshift({
              id,
              name: data.debugInfo?.sheetName || 'Churrasco Compartilhado',
              visitedAt: new Date().toISOString()
          });
          localStorage.setItem('recent_barbecues', JSON.stringify(filtered.slice(0, 10)));
        } catch (e) {
            console.error("Failed to save recent barbecue:", e);
        }
      },
      (err) => {
        setError(err.message || 'Erro ao sincronizar dados.');
        setLoading(false);
      }
    );
    
    return () => {
      unsubscribe();
    };
  }, [id]);

  const handleExportToSheets = async () => {
    if (!token) {
      showToast("Você precisa estar conectado com o Google para exportar.", "error");
      return;
    }
    setExporting(true);
    setExportedUrl(null);
    try {
      const sheetData: SheetData = {
        products,
        participants,
        settlements,
        payments,
        totalCost,
        groups
      };
      const result = await exportBarbecueToGoogleSheets(debugInfo?.sheetName || "Churrasco", sheetData, token);
      setExportedUrl(result.spreadsheetUrl);
      showToast("Churrasco exportado com sucesso! Use o botão exibido no painel para abrir.", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao exportar: " + (err.message || err), "error");
    } finally {
      setExporting(false);
    }
  };



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
      await deleteAllPaymentsFromSheet(null, id!, token!);
    } catch (e) {
      console.error("Failed to reset payments", e);
      dialog.alert("Erro", "Erro ao resetar pagamentos.");
      setLoading(false);
    }
  };

  // Helper: Reset Spreadsheet Data Completely
  const handleResetSpreadsheet = async () => {
    setLoading(true);
    try {
      const { resetSpreadsheetData } = await import('../services/sheets');
      await resetSpreadsheetData(id!, debugInfo?.sheetName || 'Churrasco', token!);
      setProducts([]);
      setParticipants([]);
      setSettlements([]);
      setPayments([]);
      setGroups([]);
    } catch (e) {
      console.error("Failed to reset spreadsheet", e);
      dialog.alert("Erro", "Erro ao resetar dados.");
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

      // Persist to Firebase
      addProductToSheet(
        { ...data, price: data.price },
        data.consumers,
        debugInfo?.sheetName || 'Churrasco',
        debugInfo?.sheetId || 0,
        participants, // full list for columns
        id!,
        token!
      )
        .catch(err => console.error("Failed to add product", err))
        .finally(() => setIsSyncing(false));
    });

    console.log("Saving new product:", data);
  };

  /* Logic Updates */


  const [expandedParticipants, setExpandedParticipants] = useState<Record<string, boolean>>({});

  const toggleParticipantExpanded = (name: string) => {
    setExpandedParticipants(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const processProductUpdate = async (data: { name: string; price: number; payer: string; consumers: string[] }) => {
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

      // PERSIST to Firebase
      updateProductInSheet(productToSave, result.participants, debugInfo?.sheetName || 'Churrasco', id!)
        .catch(err => {
          console.error("Failed to update product", err);
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

      // 4. Persist to Firebase
      addPaymentToSheet(payer, receiver, amount, debugInfo?.sheetName || 'Churrasco', debugInfo?.sheetId || 0, participants, id!, token!)
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
          dialog.alert("Erro ao Salvar", "Erro ao salvar pagamento. Recarregue a página.");
        })
        .finally(() => setIsSyncing(false));
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

      // 4. Persist Deletion to Firebase
      const dummyProduct: any = { id: paymentId, isPayment: true };
      deleteProductFromSheet(dummyProduct, debugInfo?.sheetName || 'Churrasco', debugInfo?.sheetId || 0, id!)
        .then(() => console.log("Payment deleted successfully"))
        .catch(err => {
          console.error("Failed to delete payment", err);
          dialog.alert("Erro ao Remover", "Erro ao remover pagamento.");
        })
        .finally(() => setIsSyncing(false));
    });
  };

  const performProductDeletion = (product: Product, shouldResetPayments: boolean) => {
    setIsSyncing(true);

    const updatedProducts = products.filter(p => p.id !== product.id);
    setProducts(updatedProducts);

    import('../services/sheets').then(({ calculateStats, deleteProductFromSheet }) => {
      const pMap = new Map<string, Participant>();
      const currentParticipants = participants.map(p => ({ ...p }));
      currentParticipants.forEach(p => pMap.set(p.name, p));

      // Determine payments to use
      const currentPayments = shouldResetPayments ? [] : payments;

      // Reconstruct Payments for Calculation
      const paymentItems = currentPayments.map(pay => ({
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

      deleteProductFromSheet(product, debugInfo?.sheetName || 'Churrasco', debugInfo?.sheetId || 0, id!)
        .then(() => console.log("Product deleted successfully"))
        .catch(err => {
          console.error("Failed to delete product", err);
          dialog.alert("Erro ao Remover", "Erro ao remover produto.");
        })
        .finally(() => setIsSyncing(false));
    });
  };

  const handleDeleteProduct = async (product: Product) => {
    if (isSyncing) return;

    if (payments.length > 0) {
      setConfirmation({
        isOpen: true,
        title: "Pagamentos Existentes",
        description: "Excluir este item afetará os saldos. Deseja zerar os pagamentos já realizados?",
        variant: 'warning',
        confirmLabel: 'Zerar e Excluir',
        cancelLabel: 'Apenas Excluir',
        onConfirm: async () => {
          await handleResetPayments();
          performProductDeletion(product, true);
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: async () => {
          performProductDeletion(product, false);
          setConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    performProductDeletion(product, false);
  };



  const handleRemoveParticipant = (name: string) => {
    if (isSyncing) return;
    if (participants.length <= 1) {
      dialog.alert("Operação Não Permitida", "Não é possível remover o único participante.");
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

      // Persist to Firebase
      deleteParticipantFromSheet(name, debugInfo?.sheetName || 'Churrasco', debugInfo?.sheetId || 0, id!)
        .then(() => console.log("Removed participant"))
        .catch(err => {
          console.error("Failed to remove participant", err);
          dialog.alert("Erro ao Remover", "Erro ao remover participante.");
        })
        .finally(() => setIsSyncing(false));
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

      updateProductInSheet({ ...targetProduct, payer: newPayer }, result.participants, debugInfo?.sheetName || 'Churrasco', id!)
        .catch(err => console.error("Failed to update payer", err));
    });
  };

  const handleUpdateParticipant = (name: string, data?: { pix?: Participant['pix'], responsible?: string, preferredRecipient?: string, isHalf?: boolean }) => {
    let found = false;
    const updated = participants.map(p => {
      if (p.name === name) {
        found = true;
        return {
          ...p,
          ...(data?.pix ? { pix: data.pix as any } : {}),
          ...(data?.responsible !== undefined ? { paymentResponsible: data.responsible } : {}),
          ...(data?.preferredRecipient !== undefined ? { preferredRecipient: data.preferredRecipient } : {}),
          ...(data?.isHalf !== undefined ? { isHalf: data.isHalf } : {})
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
        paymentResponsible: data?.responsible,
        preferredRecipient: data?.preferredRecipient,
        isHalf: data?.isHalf || false
      });
    }

    // Recalculate stats locally to immediately update Net Balances and Settlements in UI
    import('../services/sheets').then(({ calculateStats }) => {
      const pMap = new Map<string, Participant>();
      updated.forEach(p => pMap.set(p.name, { ...p }));

      const paymentItems = payments.map(pay => ({
        id: pay.id,
        name: 'Pagamento',
        price: pay.amount,
        payer: pay.from,
        consumers: [pay.to],
        isPayment: true
      } as Product));

      const allItems = [...products, ...paymentItems];

      const result = calculateStats(allItems, pMap, debugInfo?.sheetName);
      setParticipants(result.participants);
      setSettlements(result.settlements);
      setPayments(result.payments || []);
    });

    console.log("Updated participant:", name, data);

    // Persist to Firebase
    if (!found) {
      import('../services/sheets').then(({ addParticipantToSheet }) => {
        addParticipantToSheet(name, debugInfo?.sheetName || 'Churrasco', debugInfo?.sheetId || 0, id!)
          .catch(err => console.error("Failed to add participant", err));
      });
    }

    if (data) {
      import('../services/sheets').then(({ saveParticipantData }) => {
        saveParticipantData(name, data, id!).catch(err => {
          console.error("Falha ao salvar dados do participante", err);
        });
      });
    }
  };

  const handleBulkAddParticipants = async (names: string[]) => {
    const seen = new Set<string>();
    const uniqueInput = names
      .map(n => n.trim())
      .filter(n => {
        if (!n) return false;
        const lower = n.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });

    const newNames = uniqueInput.filter(name => {
      return !participants.some(p => p.name.toLowerCase() === name.toLowerCase());
    });

    if (newNames.length === 0) return;

    let updated = [...participants];
    newNames.forEach(name => {
      updated.push({
        name,
        totalPaid: 0,
        totalConsumed: 0,
        netBalance: 0
      });
    });

    setParticipants(updated);
    console.log("Bulk adding participants:", newNames);

    setIsSyncing(true);
    try {
      const { addParticipantToSheet } = await import('../services/sheets');
      // Add them sequentially to avoid concurrent update conflicts
      for (const name of newNames) {
        await addParticipantToSheet(name, debugInfo?.sheetName || 'Churrasco', debugInfo?.sheetId || 0, id!, token!);
      }
    } catch (err) {
      console.error("Failed to bulk add participants", err);
      dialog.alert("Erro ao Salvar", "Erro ao salvar alguns participantes.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveGroups = async (updatedGroups: Group[]) => {
    console.log("Saving groups:", updatedGroups);
    setIsSyncing(true);
    try {
      // Map updatedGroups to ensure they all have IDs
      const groupsWithIds = updatedGroups.map(g => ({
        ...g,
        id: g.id || `group_${Math.random().toString(36).substring(2, 9)}`
      }));

      const updatedProducts = [...products];
      let productsChanged = false;

      groupsWithIds.forEach(newGroup => {
        // Find old group by id, or by name if id was not present
        const oldGroup = groups.find(g => (newGroup.id && g.id === newGroup.id) || g.name === newGroup.name);
        if (oldGroup) {
          const nameChanged = oldGroup.name !== newGroup.name;
          const addedMembers = newGroup.members.filter(m => !oldGroup.members.includes(m));
          const removedMembers = oldGroup.members.filter(m => !newGroup.members.includes(m));

          if (nameChanged || addedMembers.length > 0 || removedMembers.length > 0) {
            updatedProducts.forEach((p) => {
              if (p.linkedGroupName === oldGroup.name) {
                let newConsumers = [...p.consumers];
                let consumerListChanged = false;

                if (nameChanged) {
                  p.linkedGroupName = newGroup.name;
                  productsChanged = true;
                }

                addedMembers.forEach(m => {
                  if (!newConsumers.includes(m)) {
                    newConsumers.push(m);
                    consumerListChanged = true;
                  }
                });

                removedMembers.forEach(m => {
                  if (newConsumers.includes(m)) {
                    newConsumers = newConsumers.filter(c => c !== m);
                    consumerListChanged = true;
                  }
                });

                if (consumerListChanged) {
                  p.consumers = newConsumers;
                  productsChanged = true;
                }
              }
            });
          }
        }
      });

      // Clear linkedGroupName for deleted groups
      const deletedGroupNames = groups
        .filter(og => !groupsWithIds.some(ng => ng.id === og.id || ng.name === og.name))
        .map(og => og.name);

      if (deletedGroupNames.length > 0) {
        updatedProducts.forEach(p => {
          if (p.linkedGroupName && deletedGroupNames.includes(p.linkedGroupName)) {
            p.linkedGroupName = undefined;
            productsChanged = true;
          }
        });
      }

      // Save groups
      const { saveGroupsToSheet } = await import('../services/sheets');
      await saveGroupsToSheet(groupsWithIds, id!, token!);
      setGroups(groupsWithIds);

      // Save products if changed
      if (productsChanged) {
        setProducts(updatedProducts);
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const docRef = doc(db, 'barbecues', id!);
        await updateDoc(docRef, { products: updatedProducts });
      }
    } catch (err) {
      console.error("Failed to save groups", err);
      dialog.alert("Erro ao Salvar", "Erro ao salvar alterações dos grupos.");
    } finally {
      setIsSyncing(false);
    }
  };

  const totalCost = products.reduce((acc, p) => acc + (p.isPayment || (typeof p.id === 'string' && p.id.startsWith('pay-')) ? 0 : p.price), 0);

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


          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-6 py-3 bg-ember-600 hover:bg-ember-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-ember-900/20 active:scale-95"
          >
            Voltar para o Painel
          </button>
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
            if (targetProduct) {
              updateProductInSheet(targetProduct, result.participants, debugInfo?.sheetName || 'Churrasco', id!)
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
            if (targetProduct) {
              updateProductInSheet(targetProduct, result.participants, debugInfo?.sheetName || 'Churrasco', id!)
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
      if (targetProduct) {
        updateProductInSheet(targetProduct, result.participants, debugInfo?.sheetName || 'Churrasco', id!)
          .then(() => console.log("Updated product consumption"))
          .catch(err => console.error("Failed to update consumption", err));
      }
    });
  };

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(participantSearchQuery.toLowerCase())
  );

  return (
    <Layout onBack={() => navigate('/dashboard')}>
      <div className="min-h-screen bg-charcoal-950 pb-28 md:pb-8 relative">
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
          groups={groups}
          onAdd={handleAddProduct}
          onEdit={handleEditProductSave}
          productToEdit={editingProduct}
        />

        {/* Header Bar com Controles */}
        <div className="bg-charcoal-900 border-b border-white/5 p-4 md:p-6 mb-6 rounded-2xl relative z-40 backdrop-blur-md bg-opacity-95">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Título e Status */}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {debugInfo?.sheetName || 'Carregando Churrasco...'}
                </h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  Firebase
                </div>
              </div>
              <p className="text-xs text-charcoal-500 mt-0.5">ID: {id}</p>
            </div>

            {/* Ações Rápidas no Header */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}#/join/${id}`;
                  navigator.clipboard.writeText(url);
                  showToast("Link de convite copiado!", "success");
                }}
                className="px-3.5 py-2 bg-charcoal-800 hover:bg-charcoal-700 border border-white/5 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
                title="Copiar Link de Convite"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                Convidar
              </button>

              <button
                onClick={handleExportToSheets}
                disabled={exporting}
                className="px-3.5 py-2 bg-charcoal-800 hover:bg-charcoal-700 border border-white/5 text-slate-200 hover:text-white disabled:opacity-50 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
                title="Exportar para Google Planilhas"
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                )}
                Planilha
              </button>

              <button
                onClick={() => {
                  setConfirmation({
                    isOpen: true,
                    title: "Resetar Churrasco",
                    description: "Tem certeza que deseja apagar TODOS os participantes, itens, pagamentos e grupos deste churrasco? Esta ação é irreversível.",
                    variant: 'danger',
                    confirmLabel: 'Sim, resetar',
                    onConfirm: handleResetSpreadsheet
                  });
                }}
                className="px-3.5 py-2 bg-charcoal-800 hover:bg-charcoal-700 border border-white/5 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
                title="Resetar Dados"
              >
                <RefreshCw className="w-3.5 h-3.5 text-red-400" />
                Resetar
              </button>
            </div>
          </div>

          {/* Toast / Alerta de exportação com sucesso */}
          {exportedUrl && (
            <div className="max-w-7xl mx-auto mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 text-xs animate-in slide-in-from-top-2">
              <span>Planilha exportada com sucesso no seu Google Drive!</span>
              <a 
                href={exportedUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
              >
                Abrir Planilha
              </a>
            </div>
          )}
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden md:flex bg-charcoal-900/40 p-1.5 rounded-xl border border-white/5 gap-1.5 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
          >
            📊 Resumo Geral
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'items' ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
          >
            🍖 Itens do Churrasco ({products.filter(p => !p.isPayment && !p.id.toString().startsWith('pay-')).length})
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'participants' ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
          >
            👥 Participantes ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'settlements' ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/20 shadow-inner' : 'text-charcoal-400 hover:text-white hover:bg-white/5'}`}
          >
            💸 Divisão / Acertos ({settlements.length})
          </button>
        </div>

        {/* Dynamic Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-1 glass-panel p-5 md:p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-ember-500/10 rounded-full blur-2xl group-hover:bg-ember-500/20 transition-all" />
                  <div className="p-3 bg-charcoal-800 rounded-xl shrink-0">
                    <DollarSign className="w-6 h-6 text-ember-400" />
                  </div>
                  <div>
                    <p className="text-charcoal-400 text-xs font-bold uppercase tracking-wider mb-1">Custo Total</p>
                    <p className="text-2xl font-bold text-white tracking-tight">
                      {loading ? (
                        <span className="animate-pulse bg-charcoal-700 h-8 w-24 rounded block" />
                      ) : (
                        `R$ ${totalCost.toFixed(2)}`
                      )}
                    </p>
                  </div>
                </div>

                <div className="glass-panel p-5 md:p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                  <div className="p-3 bg-charcoal-800 rounded-xl shrink-0">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-charcoal-400 text-xs font-bold uppercase tracking-wider mb-1">Participantes</p>
                    <p className="text-2xl font-bold text-white tracking-tight">
                      {loading ? <span className="animate-pulse bg-charcoal-700 h-8 w-12 rounded block" /> : participants.length}
                    </p>
                  </div>
                </div>

                <div className="glass-panel p-5 md:p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all" />
                  <div className="p-3 bg-charcoal-800 rounded-xl shrink-0">
                    <ShoppingBag className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-charcoal-400 text-xs font-bold uppercase tracking-wider mb-1">Itens</p>
                    <p className="text-2xl font-bold text-white tracking-tight">
                      {loading ? <span className="animate-pulse bg-charcoal-700 h-8 w-12 rounded block" /> : products.filter(p => !p.isPayment && !p.id.toString().startsWith('pay-')).length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Share / Invitation Card */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Chame seus amigos</h3>
                  <p className="text-sm text-charcoal-400 max-w-xl">
                    Compartilhe o link abaixo para que os participantes possam se cadastrar, adicionar o que consumiram e registrar chaves PIX de forma integrada.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#/join/${id}`;
                    navigator.clipboard.writeText(url);
                    showToast("Link de convite copiado!", "success");
                  }}
                  className="px-5 py-3.5 bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-110 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap self-stretch md:self-auto"
                >
                  <Share2 className="w-4 h-4 text-white" />
                  Copiar Link de Convite
                </button>
              </div>

              {/* Quick Actions Panel */}
              <div className="bg-charcoal-900/40 border border-white/5 rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal-400 mb-4">Gerenciamento da Planilha</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-charcoal-900/50 rounded-xl border border-white/5 flex flex-col justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-white text-sm mb-1">Exportar para o Google Planilhas</h4>
                      <p className="text-xs text-charcoal-400">Gere um backup completo dos seus dados diretamente em uma planilha do Google Sheets.</p>
                    </div>
                    <button
                      onClick={handleExportToSheets}
                      disabled={exporting}
                      className="w-full py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      {exporting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      )}
                      {exporting ? 'Exportando...' : 'Exportar Planilha Agora'}
                    </button>
                  </div>
                  <div className="p-4 bg-charcoal-900/50 rounded-xl border border-white/5 flex flex-col justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-red-400 text-sm mb-1">Resetar Todos os Dados</h4>
                      <p className="text-xs text-charcoal-400">Apague permanentemente todos os participantes, produtos e pagamentos do banco de dados.</p>
                    </div>
                    <button
                      onClick={() => {
                        setConfirmation({
                          isOpen: true,
                          title: "Resetar Churrasco",
                          description: "Tem certeza que deseja apagar TODOS os participantes, itens, pagamentos e grupos deste churrasco? Esta ação é irreversível.",
                          variant: 'danger',
                          confirmLabel: 'Sim, resetar',
                          onConfirm: handleResetSpreadsheet
                        });
                      }}
                      className="w-full py-2.5 bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-500/20 font-semibold text-xs rounded-lg transition-all"
                    >
                      Resetar Banco de Dados
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Lista de Compras</h3>
                    <p className="text-xs text-charcoal-400">Cadastre e edite as carnes, bebidas, acompanhamentos e quem participou do consumo.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingProduct(undefined);
                      setIsProductModalOpen(true);
                    }}
                    className="py-3 px-5 bg-ember-600 hover:bg-ember-500 text-white rounded-xl transition-all shadow-lg shadow-ember-900/20 font-bold flex items-center justify-center gap-2 active:scale-95 group text-sm self-stretch sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item/Bebida
                  </button>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <ProductsTable
                    products={products}
                    onEdit={(p) => {
                      setEditingProduct(p);
                      setIsProductModalOpen(true);
                    }}
                    onDelete={handleDeleteProduct}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Participantes & Grupos</h3>
                    <p className="text-xs text-charcoal-400">Gerencie a galera do churrasco, configure meias-entradas, defina responsáveis pelo pagamento ou crie grupos.</p>
                  </div>
                  <button
                    onClick={() => setIsManageParticipantsOpen(true)}
                    className="py-3 px-5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 hover:text-white rounded-xl transition-colors text-sm font-bold border border-white/10 flex items-center justify-center gap-2 self-stretch sm:self-auto"
                  >
                    <Users className="w-4 h-4 text-ember-400" />
                    Gerenciar Participantes / Grupos
                  </button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-white/5 pt-4">
                  {/* Busca */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500" />
                    <input
                      type="text"
                      placeholder="Buscar participantes..."
                      value={participantSearchQuery}
                      onChange={(e) => setParticipantSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-charcoal-900/50 border border-white/10 focus:border-ember-500 focus:ring-1 focus:ring-ember-500 rounded-xl text-sm text-white placeholder-charcoal-500 outline-none transition-all"
                    />
                    {participantSearchQuery && (
                      <button
                        onClick={() => setParticipantSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-white text-xs font-bold"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {/* Configurações de Exibição e Expansão */}
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-charcoal-300 hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={showAmounts}
                        onChange={(e) => setShowAmounts(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-charcoal-900/50 text-ember-500 focus:ring-ember-500 focus:ring-offset-charcoal-900 cursor-pointer"
                      />
                      Exibir Valores
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const expanded: Record<string, boolean> = {};
                          participants.forEach(p => {
                            expanded[p.name] = true;
                          });
                          setExpandedParticipants(expanded);
                        }}
                        className="px-3 py-2 bg-charcoal-800 hover:bg-charcoal-700 hover:text-white text-charcoal-300 rounded-lg text-xs font-semibold border border-white/5 transition-colors"
                      >
                        Expandir Todos
                      </button>
                      <button
                        onClick={() => setExpandedParticipants({})}
                        className="px-3 py-2 bg-charcoal-800 hover:bg-charcoal-700 hover:text-white text-charcoal-300 rounded-lg text-xs font-semibold border border-white/5 transition-colors"
                      >
                        Colapsar Todos
                      </button>
                    </div>
                  </div>
                </div>

                {filteredParticipants.length === 0 ? (
                  <div className="text-charcoal-500 italic p-8 text-center bg-charcoal-900/20 border border-dashed border-charcoal-800 rounded-xl">
                    <p>Nenhum participante encontrado.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredParticipants.map((participant, index) => (
                      <ParticipantCard
                        key={participant.name}
                        participant={participant}
                        products={products}
                        isExpanded={!!expandedParticipants[participant.name]}
                        onToggle={() => toggleParticipantExpanded(participant.name)}
                        onEdit={() => {
                          setEditingParticipant(participant.name);
                          setIsManageParticipantsOpen(true);
                        }}
                        index={index}
                        showAmounts={showAmounts}
                        isDragging={draggedIndex !== null && participants[draggedIndex]?.name === participant.name}
                        isSearching={!!participantSearchQuery}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        onTouchStart={handleTouchStart}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Acerto de Contas</h3>
                  <p className="text-xs text-charcoal-400">Veja quem deve para quem, registre pagamentos realizados ou copie o resumo completo para o WhatsApp.</p>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <SettlementMatrix
                    settlements={settlements}
                    participants={participants}
                    payments={payments}
                    onAddPayment={handleAddPayment}
                    onDeletePayment={handleDeletePayment}
                    isSyncing={isSyncing}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-charcoal-900/95 backdrop-blur-lg border-t border-white/10 flex items-center justify-around py-3 px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'overview' ? 'text-orange-400' : 'text-charcoal-400'}`}
          >
            <Flame className="w-5 h-5" />
            <span className="text-[10px] font-bold">Resumo</span>
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'items' ? 'text-orange-400' : 'text-charcoal-400'}`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px] font-bold">Itens</span>
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'participants' ? 'text-orange-400' : 'text-charcoal-400'}`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-bold">Pessoas</span>
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'settlements' ? 'text-orange-400' : 'text-charcoal-400'}`}
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-[10px] font-bold">Acertos</span>
          </button>
        </div>

        <ManageParticipantsModal
          isOpen={isManageParticipantsOpen}
          onClose={() => {
            setIsManageParticipantsOpen(false);
            setEditingParticipant(undefined);
            setSearchParams({});
          }}
          participants={participants}
          products={products}
          groups={groups}
          onSaveGroups={handleSaveGroups}
          onUpdate={handleUpdateParticipant}
          onBulkAdd={handleBulkAddParticipants}
          onToggleConsumption={handleToggleConsumption}
          onUpdatePayer={handleUpdatePayerWrapped}
          onRemove={handleRemoveParticipant}
          initialExpandedParticipant={editingParticipant}
        />
      </div>
    </Layout>

  );
}


const ProductsTable = ({ products, onEdit, onDelete }: { products: Product[], onEdit: (p: Product) => void, onDelete: (p: Product) => void }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const cleanProducts = products.filter(p => !p.isPayment && p.name !== 'Pagamento' && !p.id.toString().startsWith('pay-'));

  if (cleanProducts.length === 0) {
    return (
      <div className="text-charcoal-500 italic p-8 text-center bg-charcoal-900/20 border border-dashed border-charcoal-800 rounded-xl">
        <p>Nenhum produto encontrado.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
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
            {cleanProducts.map((p: any) => (
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
                    {p.consumers.slice(0, 5).map((c: string, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-charcoal-700 flex items-center justify-center text-[10px] border border-charcoal-800 shrink-0 select-none" title={c}>
                        {c.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {p.consumers.length > 5 && (
                      <div className="w-6 h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-[10px] border border-charcoal-800 shrink-0">
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {cleanProducts.map((p: any) => (
          <div key={p.id} className="bg-charcoal-900/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3 relative group">
            {/* Top Info */}
            <div className="flex justify-between items-start pr-8">
              <div className="min-w-0">
                <h4 className="font-bold text-white text-base truncate">{p.name}</h4>
                <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs font-semibold text-charcoal-500">Quem pagou:</span>
                  <span className="px-2 py-0.5 bg-charcoal-800 border border-white/5 rounded-md text-[10px] font-bold text-orange-400">{p.payer}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-base text-white">R$ {p.price.toFixed(2)}</span>
              </div>
            </div>

            {/* Consumers list */}
            <div className="border-t border-white/5 pt-3 mt-1">
              <p className="text-[10px] uppercase font-bold tracking-wider text-charcoal-500 mb-1.5">Consumido por ({p.consumers.length}):</p>
              <div className="flex flex-wrap gap-1">
                {p.consumers.slice(0, 8).map((c: string, idx: number) => (
                  <div key={idx} className="w-5 h-5 rounded-full bg-charcoal-800 border border-white/5 flex items-center justify-center text-[9px] font-semibold text-charcoal-300" title={c}>
                    {c.charAt(0).toUpperCase()}
                  </div>
                ))}
                {p.consumers.length > 8 && (
                  <div className="w-5 h-5 rounded-full bg-charcoal-750 border border-white/5 flex items-center justify-center text-[9px] font-bold text-ember-400">
                    +{p.consumers.length - 8}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (absolute top-right) */}
            <div className="absolute top-3 right-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === p.id ? null : p.id);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-charcoal-400 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {openMenuId === p.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-8 z-50 w-32 bg-charcoal-800 border border-charcoal-600 rounded-xl shadow-2xl overflow-hidden"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(p);
                        setOpenMenuId(null);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-charcoal-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" /> Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p);
                        setOpenMenuId(null);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 animate-pulse" /> Excluir
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

