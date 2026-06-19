import { 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Product, Participant, PaymentRecord, Group, SheetData } from '../types';
import { calculateStats } from './sheets';

export interface FirestoreBarbecue {
    id: string;
    name: string;
    ownerId: string;
    ownerName: string;
    createdAt: any;
    products: Product[];
    participants: Participant[];
    payments: PaymentRecord[];
    groups: Group[];
}

/**
 * Lists all barbecues owned by a specific user (by email or user ID).
 */
export async function listBarbecues(ownerId: string): Promise<Omit<FirestoreBarbecue, 'products' | 'participants' | 'payments' | 'groups'>[]> {
    try {
        const q = query(
            collection(db, 'barbecues'), 
            where('ownerId', '==', ownerId), 
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const list: any[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            list.push({
                id: doc.id,
                name: data.name,
                ownerId: data.ownerId,
                ownerName: data.ownerName,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null
            });
        });
        return list;
    } catch (error) {
        console.error('Failed to list barbecues from Firestore:', error);
        // Fallback: if we just created a query, Firestore might require an index. 
        // Let's try to query without ordering first to avoid blocking the user if index isn't ready.
        try {
            const q = query(collection(db, 'barbecues'), where('ownerId', '==', ownerId));
            const querySnapshot = await getDocs(q);
            const list: any[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                list.push({
                    id: doc.id,
                    name: data.name,
                    ownerId: data.ownerId,
                    ownerName: data.ownerName,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
                });
            });
            return list;
        } catch (innerError) {
            console.error('Failed to query without order:', innerError);
            throw error;
        }
    }
}

/**
 * Creates a new barbecue in Firestore.
 */
export async function createBarbecue(name: string, ownerEmail: string, ownerName: string): Promise<string> {
    const docRef = await addDoc(collection(db, 'barbecues'), {
        name,
        ownerId: ownerEmail,
        ownerName,
        createdAt: serverTimestamp(),
        products: [],
        participants: [
            {
                name: ownerName,
                totalPaid: 0,
                totalConsumed: 0,
                netBalance: 0
            }
        ],
        payments: [],
        groups: []
    });
    return docRef.id;
}

/**
 * Creates a barbecue in Firestore with pre-populated data (e.g., during Google Sheets Import).
 */
export async function createBarbecueWithData(
    name: string, 
    ownerEmail: string, 
    ownerName: string,
    data: Omit<SheetData, 'totalCost' | 'settlements'>
): Promise<string> {
    // Generate clean IDs for imported products and payments
    const products = (data.products || []).map((p, idx) => ({
        ...p,
        id: p.id || `prod_${idx}_${Math.random().toString(36).substring(2, 9)}`
    }));

    const payments = (data.payments || []).map((p, idx) => ({
        ...p,
        id: p.id || `pay_${idx}_${Math.random().toString(36).substring(2, 9)}`
    }));

    const docRef = await addDoc(collection(db, 'barbecues'), {
        name,
        ownerId: ownerEmail,
        ownerName,
        createdAt: serverTimestamp(),
        products,
        participants: data.participants || [],
        payments,
        groups: data.groups || []
    });
    return docRef.id;
}

/**
 * Deletes a barbecue from Firestore.
 */
export async function deleteBarbecue(id: string): Promise<void> {
    await deleteDoc(doc(db, 'barbecues', id));
}

/**
 * Subscribes to changes in a barbecue document and returns computed statistics in real time.
 */
export function subscribeToBarbecue(id: string, callback: (data: SheetData) => void, onError?: (err: any) => void) {
    const docRef = doc(db, 'barbecues', id);
    return onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) {
            if (onError) onError(new Error('Churrasco não encontrado.'));
            return;
        }
        
        const data = docSnap.data();
        const products = (data.products || []) as Product[];
        const participants = (data.participants || []) as Participant[];
        const payments = (data.payments || []) as PaymentRecord[];
        const groups = (data.groups || []) as Group[];
        
        // Build participant map
        const participantMap = new Map<string, Participant>();
        participants.forEach(p => {
            const pGroups = groups.filter(g => g.members?.includes(p.name));
            const groupIsHalf = pGroups.some(g => g.isHalf);
            const groupPreferredRecipient = pGroups.find(g => g.preferredRecipient)?.preferredRecipient;

            participantMap.set(p.name, {
                name: p.name,
                totalPaid: 0,
                totalConsumed: 0,
                netBalance: 0,
                pix: p.pix,
                paymentResponsible: p.paymentResponsible,
                preferredRecipient: p.preferredRecipient || groupPreferredRecipient,
                isHalf: p.isHalf || groupIsHalf
            });
        });
        
        // Build dummy items for payments so calculateStats knows about them
        const paymentItems = payments.map(pay => ({
            id: pay.id,
            name: 'Pagamento',
            price: pay.amount,
            payer: pay.from,
            consumers: [pay.to],
            isPayment: true
        }));
        
        const allItems = [...products, ...paymentItems];
        
        // Calculate statistics
        const stats = calculateStats(allItems, participantMap);
        
        callback({
            ...stats,
            groups,
            isEmpty: products.length === 0 && participants.length === 0,
            debugInfo: {
                sheetName: data.name || 'Churrasco',
                sheetId: 0,
                rawHeader: [],
                firstRows: []
            }
        });
    }, (err) => {
        console.error('Subscription error:', err);
        if (onError) onError(err);
    });
}

/**
 * Gets a single snapshot of the barbecue data (without real-time subscription).
 */
export async function getBarbecueData(id: string): Promise<SheetData> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');

    const data = docSnap.data();
    const products = (data.products || []) as Product[];
    const participants = (data.participants || []) as Participant[];
    const payments = (data.payments || []) as PaymentRecord[];
    const groups = (data.groups || []) as Group[];

    const participantMap = new Map<string, Participant>();
    participants.forEach(p => {
        const pGroups = groups.filter(g => g.members?.includes(p.name));
        const groupIsHalf = pGroups.some(g => g.isHalf);
        const groupPreferredRecipient = pGroups.find(g => g.preferredRecipient)?.preferredRecipient;

        participantMap.set(p.name, {
            name: p.name,
            totalPaid: 0,
            totalConsumed: 0,
            netBalance: 0,
            pix: p.pix,
            paymentResponsible: p.paymentResponsible,
            preferredRecipient: p.preferredRecipient || groupPreferredRecipient,
            isHalf: p.isHalf || groupIsHalf
        });
    });

    const paymentItems = payments.map(pay => ({
        id: pay.id,
        name: 'Pagamento',
        price: pay.amount,
        payer: pay.from,
        consumers: [pay.to],
        isPayment: true
    }));

    const allItems = [...products, ...paymentItems];
    const stats = calculateStats(allItems, participantMap);

    return {
        ...stats,
        groups,
        isEmpty: products.length === 0 && participants.length === 0,
        debugInfo: {
            sheetName: data.name || 'Churrasco',
            sheetId: 0,
            rawHeader: [],
            firstRows: []
        }
    };
}

/**
 * Adds a product to a barbecue.
 */
export async function addProductToBarbecue(
    id: string,
    productData: Omit<Product, 'id' | 'consumers'>,
    consumers: string[]
): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const newProduct: Product = {
        name: productData.name,
        price: productData.price,
        payer: productData.payer,
        id: 'prod_' + Math.random().toString(36).substring(2, 9),
        consumers,
        linkedGroupName: productData.linkedGroupName
    };
    
    const data = docSnap.data();
    const products = [...(data.products || []), newProduct];
    
    await updateDoc(docRef, { products });
}

/**
 * Updates an existing product in a barbecue.
 */
export async function updateProductInBarbecue(id: string, updatedProduct: Product): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const data = docSnap.data();
    const products = [...(data.products || [])] as Product[];
    const index = products.findIndex(p => p.id === updatedProduct.id);
    
    if (index !== -1) {
        products[index] = updatedProduct;
        await updateDoc(docRef, { products });
    }
}

/**
 * Deletes a product from a barbecue.
 */
export async function deleteProductFromBarbecue(id: string, productId: string): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const data = docSnap.data();
    const products = ((data.products || []) as Product[]).filter(p => p.id !== productId);
    
    await updateDoc(docRef, { products });
}

/**
 * Adds a participant to a barbecue.
 */
export async function addParticipantToBarbecue(id: string, name: string): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const data = docSnap.data();
    const participants = [...(data.participants || [])] as Participant[];
    
    if (participants.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
        return; // Already exists
    }
    
    const newParticipant: Participant = {
        name: name.trim(),
        totalPaid: 0,
        totalConsumed: 0,
        netBalance: 0
    };
    
    participants.push(newParticipant);
    await updateDoc(docRef, { participants });
}

/**
 * Deletes a participant and removes their associations from products, payments, and groups.
 */
export async function deleteParticipantFromBarbecue(id: string, name: string): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const data = docSnap.data();
    
    const participants = ((data.participants || []) as Participant[]).filter(p => p.name !== name);
    
    const products = ((data.products || []) as Product[]).map(p => ({
        ...p,
        consumers: p.consumers.filter(c => c !== name),
        payer: p.payer === name ? 'Unknown' : p.payer
    }));
    
    const payments = ((data.payments || []) as PaymentRecord[]).filter(p => p.from !== name && p.to !== name);
    
    const groups = ((data.groups || []) as Group[]).map(g => ({
        ...g,
        members: g.members.filter(m => m !== name)
    })).filter(g => g.members.length > 0);
    
    await updateDoc(docRef, {
        participants,
        products,
        payments,
        groups
    });
}

/**
 * Saves specific participant data (PIX, responsible, isHalf).
 */
export async function saveParticipantDataInBarbecue(
    id: string, 
    name: string, 
    updatedData: { pix?: { key: string; type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM' }; paymentResponsible?: string; preferredRecipient?: string; isHalf?: boolean }
): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const data = docSnap.data();
    const participants = [...(data.participants || [])] as Participant[];
    const index = participants.findIndex(p => p.name === name);
    
    if (index !== -1) {
        participants[index] = {
            ...participants[index],
            ...updatedData
        };
        await updateDoc(docRef, { participants });
    } else {
        const newPart: Participant = {
            name,
            totalPaid: 0,
            totalConsumed: 0,
            netBalance: 0,
            ...updatedData
        };
        participants.push(newPart);
        await updateDoc(docRef, { participants });
    }
}

/**
 * Adds a payment record to a barbecue.
 */
export async function addPaymentToBarbecue(id: string, from: string, to: string, amount: number): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Churrasco não encontrado');
    
    const newPayment: PaymentRecord = {
        id: 'pay_' + Math.random().toString(36).substring(2, 9),
        from,
        to,
        amount,
        date: new Date().toISOString()
    };
    
    const data = docSnap.data();
    const payments = [...(data.payments || []), newPayment];
    
    await updateDoc(docRef, { payments });
}

/**
 * Deletes all payment records.
 */
export async function deleteAllPaymentsFromBarbecue(id: string): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    await updateDoc(docRef, { payments: [] });
}

/**
 * Resets a barbecue, clearing all products, participants, and payments.
 */
export async function resetBarbecueData(id: string): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    await updateDoc(docRef, {
        products: [],
        participants: [],
        payments: [],
        groups: []
    });
}

/**
 * Saves groups.
 */
export async function saveGroupsToBarbecue(id: string, groups: Group[]): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    await updateDoc(docRef, { groups });
}

/**
 * Updates the complete list of participants (useful for reordering).
 */
export async function saveParticipantsOrderInBarbecue(id: string, participants: Participant[]): Promise<void> {
    const docRef = doc(db, 'barbecues', id);
    await updateDoc(docRef, { participants });
}
