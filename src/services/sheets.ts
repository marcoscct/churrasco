import type { Product, Participant, SheetData, Transaction, PaymentRecord, Group } from '../types';
import { getAccessToken } from './googleAuth';
import { 
    addProductToBarbecue,
    updateProductInBarbecue,
    deleteProductFromBarbecue,
    addParticipantToBarbecue,
    deleteParticipantFromBarbecue,
    saveParticipantDataInBarbecue,
    saveGroupsToBarbecue,
    addPaymentToBarbecue,
    deleteAllPaymentsFromBarbecue,
    resetBarbecueData
} from './firebaseService';

// Helper to extract Firebase Document ID from sheet URL or raw ID
export function getFirebaseId(urlOrId: string): string {
    if (!urlOrId) return '';
    if (urlOrId.includes('/d/')) {
        const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : urlOrId;
    }
    return urlOrId;
}

export function parseGoogleSheetUrl(url: string) {
    try {
        const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const gidMatch = url.match(/[#&?]gid=([0-9]+)/);

        return {
            spreadsheetId: idMatch ? idMatch[1] : null,
            gid: gidMatch ? Number(gidMatch[1]) : null
        };
    } catch (e) {
        return { spreadsheetId: null, gid: null };
    }
}

/**
 * Pure function to parse groups. Used in imports.
 */
export function parseGroups(rows: string[][]): Group[] {
    const groups: Group[] = [];
    if (!rows || rows.length === 0) return groups;

    rows.forEach((row, idx) => {
        if (idx === 0 && row[0]?.toLowerCase().includes('grupo')) return; // Skip header
        if (!row || row.length < 2) return;

        const name = row[0]?.trim();
        const membersStr = row[1];
        const members = membersStr ? membersStr.split(',').map(m => m.trim()).filter(Boolean) : [];

        if (name) {
            groups.push({ name, members });
        }
    });

    return groups;
}

/**
 * Pure function to calculate splits, balances, and settlements.
 */
export function calculateStats(
    allItems: Product[],
    participantMap: Map<string, Participant>,
    _sheetName: string = '',
    _rows: string[][] = [],
    _headerRowIndex: number = -1,
    _sheetId?: number
): SheetData {
    // Reset Totals
    participantMap.forEach(p => {
        p.totalPaid = 0;
        p.totalConsumed = 0;
        p.netBalance = 0;
    });

    const products: Product[] = [];
    const payments: any[] = [];

    // Calculate Totals
    allItems.forEach((p: any) => {
        const isPayment = p.isPayment;

        // Credit Payer
        let payer = participantMap.get(p.payer);
        if (!payer) {
            payer = { name: p.payer, totalPaid: 0, totalConsumed: 0, netBalance: 0 };
            participantMap.set(p.payer, payer);
        }
        payer.totalPaid += p.price;

        // Debit Consumers
        if (p.consumers.length > 0) {
            if (isPayment) {
                const costPerPerson = p.price / p.consumers.length;
                p.consumers.forEach((cName: string) => {
                    const consumer = participantMap.get(cName);
                    if (consumer) {
                        consumer.totalConsumed += costPerPerson;
                    }
                });
            } else {
                let totalWeight = 0;
                p.consumers.forEach((cName: string) => {
                    const consumer = participantMap.get(cName);
                    const weight = consumer?.isHalf ? 0.5 : 1.0;
                    totalWeight += weight;
                });

                if (totalWeight > 0) {
                    const pricePerUnitWeight = p.price / totalWeight;
                    p.consumers.forEach((cName: string) => {
                        const consumer = participantMap.get(cName);
                        if (consumer) {
                            const weight = consumer.isHalf ? 0.5 : 1.0;
                            consumer.totalConsumed += pricePerUnitWeight * weight;
                        }
                    });
                }
            }
        }

        if (isPayment) {
            const to = p.consumers[0] || 'Unknown';
            payments.push({
                id: p.id,
                from: p.payer,
                to: to,
                amount: p.price
            });
        } else {
            products.push(p);
        }
    });

    // Calculate Net Balance
    participantMap.forEach(p => {
        p.netBalance = p.totalPaid - p.totalConsumed;
    });

    // Aggregate balances for Settlements
    const shadowBalances = new Map<string, number>();
    participantMap.forEach(p => shadowBalances.set(p.name, p.netBalance));

    // Move sub-balances to responsible
    participantMap.forEach(p => {
        if (p.paymentResponsible && p.paymentResponsible !== p.name) {
            const resp = participantMap.get(p.paymentResponsible);
            if (resp) {
                resp.netBalance += p.netBalance;
            }
            shadowBalances.set(p.paymentResponsible, (shadowBalances.get(p.paymentResponsible) || 0) + p.netBalance);
            shadowBalances.set(p.name, 0);
        }
    });

    // Run settlement algorithm
    const creditors: { name: string, balance: number }[] = [];
    const debtors: { name: string, balance: number }[] = [];

    shadowBalances.forEach((balance, name) => {
        if (balance > 0.01) {
            creditors.push({ name, balance });
        } else if (balance < -0.01) {
            debtors.push({ name, balance: -balance });
        }
    });

    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => b.balance - a.balance);

    const settlements: Transaction[] = [];
    let cIdx = 0;
    let dIdx = 0;

    while (cIdx < creditors.length && dIdx < debtors.length) {
        const creditor = creditors[cIdx];
        const debtor = debtors[dIdx];

        const amount = Math.min(creditor.balance, debtor.balance);
        if (amount > 0.01) {
            settlements.push({
                from: debtor.name,
                to: creditor.name,
                amount: Number(amount.toFixed(2))
            });

            creditor.balance -= amount;
            debtor.balance -= amount;
        }

        if (creditor.balance <= 0.01) cIdx++;
        if (debtor.balance <= 0.01) dIdx++;
    }

    const totalCost = products.reduce((acc, p) => acc + p.price, 0);

    return {
        products,
        participants: Array.from(participantMap.values()),
        settlements,
        payments,
        totalCost
    };
}

// ------------------------------------------------------------------
// ADAPTER FUNCTIONS REDIRECTING SHEETS API TO FIRESTORE
// ------------------------------------------------------------------

const DEFAULT_SPREADSHEET_ID = '1PT1PmQJbBQm7U1y7uAKbezZq2PjZrgtF3Cz7ttxBZ20';
const DEFAULT_GID = 113213682;

export async function fetchSpreadsheetData(customUrl?: string, accessToken?: string): Promise<SheetData> {
    const token = accessToken || await getAccessToken();

    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    let targetGid = DEFAULT_GID;

    if (customUrl) {
        const { spreadsheetId: parsedId, gid: parsedGid } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
        if (parsedGid) targetGid = parsedGid;
    }

    // 1. Get Sheet Metadata to find the sheet name
    const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaResponse.ok) throw new Error('Failed to fetch spreadsheet metadata. Check access or URL.');
    const meta = await metaResponse.json();

    // Find sheet by GID or default to first
    const sheet = meta.sheets.find((s: any) => s.properties.sheetId === targetGid) || meta.sheets[0];
    const sheetName = sheet.properties.title;
    const sheetId = sheet.properties.sheetId; // We need this for batchUpdate

    // 2. Fetch Data
    // Fetch Main, Participantes, Pagamentos, AND Grupos
    const rangeMain = `'${sheetName}'!A1:Z100`;
    const rangeParticipants = `'Participantes'!A1:E100`;
    const rangePayments = `'Pagamentos'!A:E`; // ID, Date, From, To, Amount
    const rangeGroups = `'Grupos'!A:B`;

    // Fetch Participantes
    let participantRows: string[][] = [];
    try {
        const responsePart = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeParticipants}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (responsePart.ok) {
            const dataPart = await responsePart.json();
            participantRows = dataPart.values as string[][] || [];
        }
    } catch (e) {
        console.warn("Participantes tab not found", e);
    }

    // Fetch Pagamentos
    let paymentRows: string[][] = [];
    try {
        const responsePay = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangePayments}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (responsePay.ok) {
            const dataPay = await responsePay.json();
            paymentRows = dataPay.values as string[][] || [];
        }
    } catch (e) {
        console.warn("Pagamentos tab not found", e);
    }

    // Fetch Grupos
    let groupRows: string[][] = [];
    try {
        const responseGroup = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeGroups}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (responseGroup.ok) {
            const dataGroup = await responseGroup.json();
            groupRows = dataGroup.values as string[][] || [];
        }
    } catch (e) {
        console.warn("Grupos tab not found", e);
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeMain}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch sheet data');
    const data = await response.json();
    const rows = data.values as string[][];

    // Pass sheetName and sheetId for debug/write
    return parseSheetData(rows || [], sheetName, participantRows, paymentRows, groupRows, sheetId);
}

function parseSheetData(rows: string[][], sheetName: string, participantRows: string[][], paymentRows: string[][], groupRows: string[][], sheetId?: number): SheetData {
    const products: Product[] = [];
    const participantMap = new Map<string, Participant>();

    // Check if effectively empty (no headers found)
    let isEmpty = false;
    // Simple heuristic: If less than 1 row or no "Valor"/"Quem comprou" found ever
    if (!rows || rows.length === 0) {
        isEmpty = true;
    }

    // Parse Participant Meta Data (PIX + Responsible + Meia)
    // Expected: Name (A), Key (B), Type (C), Responsible (D), Meia (E)
    const metaMap = new Map<string, { pix?: { key: string, type: any }, responsible?: string, isHalf?: boolean }>();
    participantRows.forEach(row => {
        if (row.length >= 1) {
            const name = row[0]?.trim();
            const key = row[1]?.trim();
            const type = (row[2]?.trim() as any) || 'CPF';
            const responsible = row[3]?.trim(); // Col D
            const isHalf = row[4]?.trim()?.toUpperCase() === 'SIM' || row[4]?.trim()?.toLowerCase() === 'true'; // Col E

            if (name) {
                const data: any = {};
                if (key) data.pix = { key, type };
                if (responsible) data.responsible = responsible;
                if (isHalf) data.isHalf = true;
                metaMap.set(name, data);
            }
        }
    });

    let headerRowIndex = -1;
    let participantNames: string[] = []; // Ordered list of participants from headers

    // 1. Find Header Row
    // Heuristic: Look for "Item" or "Valor" AND "Quem comprou"
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.some(c => c && c.toLowerCase().includes('valor')) &&
            row.some(c => c && c.toLowerCase().includes('quem comprou'))) {
            headerRowIndex = i;

            // Extract Participants (Columns E -> Index 4 onwards)
            for (let j = 4; j < row.length; j++) {
                const pName = row[j]?.trim();
                if (pName && pName.toLowerCase() !== 'total') {
                    participantNames.push(pName);

                    // Initialize participant in map
                    if (!participantMap.has(pName)) {
                        const meta = metaMap.get(pName);
                        participantMap.set(pName, {
                            name: pName,
                            totalPaid: 0,
                            totalConsumed: 0,
                            netBalance: 0,
                            pix: meta?.pix,
                            paymentResponsible: meta?.responsible,
                            isHalf: meta?.isHalf || false
                        });
                    }
                }
            }
            break;
        }
    }

    if (headerRowIndex === -1 && rows.length > 0) {
        // Rows exist but no header found -> Unknown format, effectively "empty" for our app purposes or invalid
    }
    if (rows.length === 0) isEmpty = true;

    // 2. Parse Products & Payments (Rows after header)
    if (headerRowIndex !== -1) {
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const name = row[0]; // Col A
            if (!name || name.toUpperCase().startsWith('TOTAL')) continue; // Skip Total row or empty names

            const priceStr = row[1]; // Col B
            const payerName = row[3]?.trim(); // Col D

            const price = parseFloat(String(priceStr).replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;

            // Determine Consumers based on 'x' in columns 4+
            const consumers: string[] = [];
            for (let j = 0; j < participantNames.length; j++) {
                const colIndex = 4 + j;
                const marker = row[colIndex];
                if (marker && marker.toLowerCase().trim() === 'x') {
                    consumers.push(participantNames[j]);
                }
            }

            // Handle Payer
            const finalPayer = payerName && payerName !== '-' ? payerName : 'Unknown';

            // Ensure payer exists in map
            if (!participantMap.has(finalPayer)) {
                const meta = metaMap.get(finalPayer);
                participantMap.set(finalPayer, {
                    name: finalPayer,
                    totalPaid: 0,
                    totalConsumed: 0,
                    netBalance: 0,
                    pix: meta?.pix,
                    paymentResponsible: meta?.responsible
                });
            }

            // Check if it's a PAYMENT (Settlement)
            const isPayment = name.toLowerCase().includes('pagamento') || name.toLowerCase().includes('acerto');

            products.push({
                id: String(i + 1), // 1-based Row Index
                name,
                price,
                payer: finalPayer,
                consumers,
                isPayment // Internal flag to distinguish in calculateStats
            } as any);
        }
    } else {
        if (rows.length === 0) isEmpty = true;
    }

    // 2b. Parse Dedicated Payments (Pagamentos Tab)
    // Structure: ID (A), Date (B), From (C), To (D), Amount (E)
    if (paymentRows && paymentRows.length > 0) {
        paymentRows.forEach((row, idx) => {
            if (idx === 0 && row[0]?.toLowerCase() === 'id') return; // Skip header
            if (!row || row.length < 5) return;

            const id = row[0];
            const payer = row[2];
            const receiver = row[3];
            const amountStr = row[4];
            const amount = parseFloat(String(amountStr).replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;

            if (payer && receiver && amount > 0) {
                [payer, receiver].forEach(pName => {
                    if (!participantMap.has(pName)) {
                        participantMap.set(pName, {
                            name: pName,
                            totalPaid: 0,
                            totalConsumed: 0,
                            netBalance: 0,
                            pix: undefined,
                            paymentResponsible: undefined
                        });
                    }
                });

                products.push({
                    id: `pay-${id}`,
                    name: 'Pagamento',
                    price: amount,
                    payer: payer,
                    consumers: [receiver],
                    isPayment: true
                } as any);
            }
        });
    }

    const stats = calculateStats(products, participantMap, sheetName, rows, headerRowIndex, sheetId);
    const groups = parseGroups(groupRows);
    return { ...stats, groups, isEmpty };
}

export async function initializeSheet(_targetUrlOrId: string, _products: Product[], _participants: Participant[], _payments: PaymentRecord[], _accessToken?: string) {
    // Firebase barbecue documents are pre-initialized.
    return true;
}

export async function resetSpreadsheetData(sheetUrlOrId: string, _sheetName: string, _accessToken?: string) {
    const id = getFirebaseId(sheetUrlOrId);
    await resetBarbecueData(id);
}

export async function addProductToSheet(
    product: Omit<Product, 'id' | 'consumers'>,
    consumers: string[],
    _sheetName: string,
    _sheetId: number,
    _allParticipants: Participant[],
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await addProductToBarbecue(id, product, consumers);
}

export async function updateProductInSheet(
    product: Product,
    _allParticipants: Participant[],
    _sheetName: string,
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await updateProductInBarbecue(id, product);
}

export async function deleteProductFromSheet(
    product: Product,
    _sheetName: string,
    _sheetId: number,
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await deleteProductFromBarbecue(id, product.id);
}

export async function addParticipantToSheet(
    name: string,
    _sheetName: string,
    _sheetId: number,
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await addParticipantToBarbecue(id, name);
}

export async function deleteParticipantFromSheet(
    name: string,
    _sheetName: string,
    _sheetId: number,
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await deleteParticipantFromBarbecue(id, name);
}

export async function saveParticipantData(
    name: string,
    data: { pix?: { key: string; type: any }; responsible?: string; isHalf?: boolean },
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    // Adapter parameter mapping
    await saveParticipantDataInBarbecue(id, name, {
        pix: data.pix,
        paymentResponsible: data.responsible,
        isHalf: data.isHalf
    });
}

export async function saveGroupsToSheet(
    groups: Group[],
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await saveGroupsToBarbecue(id, groups);
}

export async function addPaymentToSheet(
    from: string,
    to: string,
    amount: number,
    _sheetName: string,
    _sheetId: number,
    _allParticipants: Participant[],
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || '');
    await addPaymentToBarbecue(id, from, to, amount);
}

export async function deleteAllPaymentsFromSheet(
    spreadsheetId: string | null,
    customUrlOrId?: string,
    _accessToken?: string
) {
    const id = getFirebaseId(customUrlOrId || spreadsheetId || '');
    await deleteAllPaymentsFromBarbecue(id);
}
