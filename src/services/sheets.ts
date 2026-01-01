import { getAccessToken } from './googleAuth';
import type { Product, Participant, SheetData, Transaction, PaymentRecord } from '../types';

// Default for demo
const DEFAULT_SPREADSHEET_ID = '1PT1PmQJbBQm7U1y7uAKbezZq2PjZrgtF3Cz7ttxBZ20';
const DEFAULT_GID = 113213682;

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
    // Fetch Main, Participantes, AND Pagamentos
    const rangeMain = `'${sheetName}'!A1:Z100`;
    const rangeParticipants = `'Participantes'!A1:D100`;
    const rangePayments = `'Pagamentos'!A:E`; // ID, Date, From, To, Amount

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

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeMain}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch sheet data');
    const data = await response.json();
    const rows = data.values as string[][];

    // Pass sheetName and sheetId for debug/write
    return parseSheetData(rows || [], sheetName, participantRows, paymentRows, sheetId);
}



function parseSheetData(rows: string[][], sheetName: string, participantRows: string[][], paymentRows: string[][], sheetId?: number): SheetData {
    const products: Product[] = [];
    const participantMap = new Map<string, Participant>();

    // Check if effectively empty (no headers found)
    let isEmpty = false;
    // Simple heuristic: If less than 1 row or no "Valor"/"Quem comprou" found ever
    if (!rows || rows.length === 0) {
        isEmpty = true;
    }

    // Parse Participant Meta Data (PIX + Responsible)
    // ... (Existing Parsing Logic) ...
    // Expected: Name (A), Key (B), Type (C), Responsible (D)
    const metaMap = new Map<string, { pix?: { key: string, type: any }, responsible?: string }>();
    participantRows.forEach(row => {
        if (row.length >= 1) {
            const name = row[0]?.trim();
            const key = row[1]?.trim();
            const type = (row[2]?.trim() as any) || 'CPF';
            const responsible = row[3]?.trim(); // Col D

            if (name) {
                const data: any = {};
                if (key) data.pix = { key, type };
                if (responsible) data.responsible = responsible;
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
                            paymentResponsible: meta?.responsible
                        });
                    }
                }
            }
            break;
        }
    }

    if (headerRowIndex === -1 && rows.length > 0) {
        // Rows exist but no header found -> Unknown format, effectively "empty" for our app purposes or invalid
        // Let's mark as empty if really few rows, or just accept logic won't parse products
        // If 0 rows, it's definitely empty.
    }
    if (rows.length === 0) isEmpty = true;
    // If we have rows but COULD NOT find a header, treat as Empty?
    // Dangerous if it's just a different format.
    // Better to only treat as empty if rows.length === 0.
    // User asked: "Vinculado a planilha vazia".

    // 2. Parse Products & Payments (Rows after header)
    if (headerRowIndex !== -1) {
        // ... existing parsing loop ...
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
        // No header found -> Empty
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
                // Determine Payer/Receiver existence
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
                    consumers: [receiver], // Receiver "consumes" the payment (credit logic handled in calculateStats)
                    isPayment: true
                } as any);
            }
        });
    }

    const stats = calculateStats(products, participantMap, sheetName, rows, headerRowIndex, sheetId);
    return { ...stats, isEmpty };
}

export function calculateStats(
    allItems: Product[],
    participantMap: Map<string, Participant>,
    sheetName: string = '',
    rows: string[][] = [],
    headerRowIndex: number = -1,
    sheetId?: number
): SheetData {
    // 3. Reset Totals
    participantMap.forEach(p => {
        p.totalPaid = 0;
        p.totalConsumed = 0;
        p.netBalance = 0;
    });

    const products: Product[] = [];
    const payments: any[] = [];

    // 4. Calculate Totals (INDIVIDUAL)
    allItems.forEach((p: any) => {
        const isPayment = p.isPayment;

        // Credit Payer (Always adds to Total Paid)
        let payer = participantMap.get(p.payer);
        if (!payer) {
            payer = { name: p.payer, totalPaid: 0, totalConsumed: 0, netBalance: 0 };
            participantMap.set(p.payer, payer);
        }
        payer.totalPaid += p.price;

        // Debit Consumers
        if (p.consumers.length > 0) {
            const costPerPerson = p.price / p.consumers.length;
            p.consumers.forEach((cName: string) => {
                const consumer = participantMap.get(cName);
                if (consumer) {
                    // If it's a payment, it counts effectively as "Negative Paid" (or mapped as consumed, which reduces net balance)
                    // Balance = Paid - Consumed.
                    // If I Receive 50 (I am consumer of 'Pagamento'): I want my Balance to go DOWN (less positive) or UP (less negative)?
                    // If I owed 50 (Balance -50). I receive 50. Balance should be 0.
                    // NetBalance = Paid - Consumed.
                    // -50 = 0 - 50.
                    // 0 = 0 - (50 - 50??).
                    // Wait. Received Payment is technically "Negative Consumption"?
                    // OR: It's "Paid" by the OTHER person.
                    // Payer (Debtor) Paid 50. Payer Balance: -50 + 50 = 0.
                    // Consumer (Creditor) Consumed 50? Total Consumed increases.
                    // Creditor Balance = Paid (say 100) - Consumed (say 50). Balance = +50.
                    // Creditor "Consumes" the Payment of 50. Total Consumed = 100. Balance = 100 - 100 = 0.
                    // YES. Treat Payment as standard consumption for the Receiver.
                    consumer.totalConsumed += costPerPerson;
                }
            });
        }

        if (isPayment) {
            // Record as Payment for "Concluídos" list
            // We assume 1 consumer for payments usually
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

    // 5. Calculate INDIVIDUAL Net Balance
    participantMap.forEach(p => {
        p.netBalance = p.totalPaid - p.totalConsumed;
    });

    // 6. Aggregate Family/Group Balances for Settlements
    // We create a "Shadow Balance Map" for the settlement algorithm
    // AND we update the Participant Objects to reflect this for the UI (Consolidated View)
    const shadowBalances = new Map<string, number>();
    participantMap.forEach(p => shadowBalances.set(p.name, p.netBalance));

    // Move sub-balances to responsible
    participantMap.forEach(p => {
        // Normalize Responsible Name Lookup
        if (p.paymentResponsible) {
            const respName = p.paymentResponsible.trim();
            // Find actual key in map (case insensitive potentially, but map keys are usually from header)
            // Let's assume header names are canonical.
            // We check if map has it.
            if (participantMap.has(respName)) {
                // Check if loop (A -> B -> A) - Simple check: strict hierarchy
                if (respName !== p.name) {
                    const currentBalance = shadowBalances.get(p.name) || 0;
                    const responsibleBalance = shadowBalances.get(respName) || 0;

                    // Move debt/credit to responsible
                    shadowBalances.set(respName, responsibleBalance + currentBalance);
                    shadowBalances.set(p.name, 0); // Subordinate is effectively settled via parent
                }
            }
        }
    });

    // UPDATE Participant Objects with Shadow Balances for UI Display (e.g. Card)
    // But KEEP totalPaid/totalConsumed real for reference?
    // The User said: "Somente Joca (Responsible) aparece".
    // So we overwrite netBalance with shadowBalance.
    participantMap.forEach(p => {
        p.netBalance = shadowBalances.get(p.name) || 0;
    });

    // 7. Build Settlements using Shadow Balances (Greedy Algorithm)
    const settlements: Transaction[] = [];

    // Sort logic requires array
    // Filter out 0 balances
    const activeParticipants = Array.from(participantMap.values()).map(p => ({
        name: p.name,
        shadowBalance: shadowBalances.get(p.name) || 0
    })).filter(p => Math.abs(p.shadowBalance) > 0.01);

    let debtors = activeParticipants.filter(p => p.shadowBalance < -0.01).sort((a, b) => a.shadowBalance - b.shadowBalance);
    let creditors = activeParticipants.filter(p => p.shadowBalance > 0.01).sort((a, b) => b.shadowBalance - a.shadowBalance);

    let dIndex = 0;
    let cIndex = 0;

    while (dIndex < debtors.length && cIndex < creditors.length) {
        const debtor = debtors[dIndex];
        const creditor = creditors[cIndex];

        const amount = Math.min(Math.abs(debtor.shadowBalance), creditor.shadowBalance);

        if (amount > 0.009) {
            settlements.push({ from: debtor.name, to: creditor.name, amount });
        }

        debtor.shadowBalance += amount;
        creditor.shadowBalance -= amount;

        if (Math.abs(debtor.shadowBalance) < 0.01) dIndex++;
        if (creditor.shadowBalance < 0.01) cIndex++;
    }

    return {
        products, // Only real products
        payments, // Completed payments
        participants: Array.from(participantMap.values()),
        settlements,
        totalCost: products.reduce((sum, p) => sum + p.price, 0), // Sum only real products
        debugInfo: {
            sheetName: sheetName,
            sheetId: sheetId,
            rawHeader: rows[headerRowIndex] || [],
            firstRows: rows.slice(0, 5)
        }
    };
}

export async function addPaymentToSheet(
    payer: string,
    receiver: string,
    amount: number,
    _sheetName: string, // Kept for interface compatibility but unused for writing
    _sheetId: number, // Unused
    _allParticipants: Participant[], // Unused for dedicated sheet
    customUrl?: string,
    accessToken?: string
) {
    const token = accessToken || await getAccessToken();
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    // New Dedicated 'Pagamentos' Sheet Logic
    // Columns: ID (A), Date (B), From (C), To (D), Amount (E)

    // 1. Check/Create 'Pagamentos' Sheet - Lazy Check via Append attempt or separate check?
    // Let's try to append. If it fails (invalid range), we create it.
    // Actually, safest is to append. If 400, create.

    const timestamp = new Date().toLocaleString('pt-BR');
    const id = Date.now().toString().slice(-6); // Simple short ID

    const values = [[id, timestamp, payer, receiver, amount]];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Pagamentos'!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    try {
        const res = await fetch(appendUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values })
        });

        if (!res.ok) {
            const err = await res.json();
            // If error implies sheet not found (invalid range), create it
            if (err.error?.code === 400 || err.error?.message?.includes('range')) {
                console.log("Creating Pagamentos sheet...");
                await createPagamentosSheet(spreadsheetId, token);
                // Retry append
                await fetch(appendUrl, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values })
                });
            } else {
                throw new Error(err.error?.message || 'Failed to add payment');
            }
        }
    } catch (e) {
        console.error("Error adding payment", e);
        throw e;
    }
    return id;
}

async function createPagamentosSheet(spreadsheetId: string, token: string) {
    // Add Sheet
    const reqAdd = {
        requests: [{
            addSheet: {
                properties: { title: "Pagamentos" }
            }
        }]
    };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqAdd)
    });

    if (res.ok) {
        // Add Headers
        const headers = [['ID', 'Data', 'De', 'Para', 'Valor']];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Pagamentos'!A1:E1?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: headers })
        });
    }
}


// ------------------------------------------------------------------
// WRITE OPERATIONS
// ------------------------------------------------------------------

export async function addProductToSheet(
    product: Omit<Product, 'id' | 'consumers'>,
    consumers: string[],
    sheetName: string,
    sheetId: number,
    allParticipants: Participant[],
    customUrl?: string,
    accessToken?: string
) {
    const token = accessToken || await getAccessToken();

    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    // Insert Row Logic (Same as before)
    const rangeA = `'${sheetName}'!A:A`;
    const resA = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeA}`, { headers: { Authorization: `Bearer ${token}` } });
    const dataA = await resA.json();
    const rows = dataA.values as string[][] || [];

    let totalRowIndex = rows.findIndex(r => r[0] && r[0].toUpperCase().startsWith('TOTAL'));
    let insertIndex = totalRowIndex !== -1 ? totalRowIndex : rows.length;

    const requests: any[] = [
        {
            insertDimension: {
                range: { sheetId: sheetId, dimension: "ROWS", startIndex: insertIndex, endIndex: insertIndex + 1 },
                inheritFromBefore: true
            }
        },
        {
            copyPaste: {
                source: { sheetId: sheetId, startRowIndex: insertIndex - 1, endRowIndex: insertIndex, startColumnIndex: 2, endColumnIndex: 3 },
                destination: { sheetId: sheetId, startRowIndex: insertIndex, endRowIndex: insertIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
                pasteType: "PASTE_FORMULA"
            }
        },
        {
            updateCells: {
                rows: [{ values: [{ userEnteredValue: { stringValue: product.name } }, { userEnteredValue: { numberValue: product.price } }] }],
                fields: "userEnteredValue",
                start: { sheetId: sheetId, rowIndex: insertIndex, columnIndex: 0 }
            }
        }
    ];

    const rowCellsDPlus: any[] = [];
    rowCellsDPlus.push({ userEnteredValue: { stringValue: product.payer } });
    allParticipants.forEach(p => {
        rowCellsDPlus.push({ userEnteredValue: { stringValue: consumers.includes(p.name) ? 'x' : '' } });
    });

    requests.push({
        updateCells: {
            rows: [{ values: rowCellsDPlus }],
            fields: "userEnteredValue",
            start: { sheetId: sheetId, rowIndex: insertIndex, columnIndex: 3 }
        }
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
    });
}

export async function addParticipantToSheet(name: string, sheetName: string, sheetId: number, customUrl?: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    const rangeHeader = `'${sheetName}'!1:1`;
    const resH = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeHeader}`, { headers: { Authorization: `Bearer ${token}` } });
    const dataH = await resH.json();
    const headers = dataH.values?.[0] || [];
    let lastColIndex = headers.length;

    const rangeA = `'${sheetName}'!A:A`;
    const resA = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeA}`, { headers: { Authorization: `Bearer ${token}` } });
    const dataA = await resA.json();
    const rows = dataA.values as string[][] || [];
    let totalRowIndex = rows.findIndex(r => r[0] && r[0].toUpperCase().startsWith('TOTAL'));
    if (totalRowIndex === -1) totalRowIndex = rows.length - 1;

    const requests: any[] = [
        {
            insertDimension: {
                range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: lastColIndex, endIndex: lastColIndex + 1 },
                inheritFromBefore: true
            }
        },
        {
            updateCells: {
                rows: [{ values: [{ userEnteredValue: { stringValue: name } }] }],
                fields: "userEnteredValue",
                start: { sheetId: sheetId, rowIndex: 0, columnIndex: lastColIndex }
            }
        },
        {
            copyPaste: {
                source: { sheetId: sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: lastColIndex - 1, endColumnIndex: lastColIndex },
                destination: { sheetId: sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: lastColIndex, endColumnIndex: lastColIndex + 1 },
                pasteType: "PASTE_FORMULA"
            }
        }
    ];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
    });
}

/**
 * Updates Participant Meta Data: PIX + Responsible
 * Writes to 'Participantes' Tab: A(Name), B(Key), C(Type), D(Responsible)
 */
export async function saveParticipantData(name: string, data: { pix?: { key: string; type: string }, responsible?: string }, customUrl?: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();

    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    const rangeSearch = `'Participantes'!A:A`;
    let existingData: string[][] = [];

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeSearch}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const d = await response.json();
        existingData = d.values || [];
    } catch (e) {
        console.error("Could not read Participantes tab", e);
        return;
    }

    let rowIndex = existingData.findIndex(row => row[0] === name);

    // Values to write: Key, Type, Responsible
    // Note: We need to handle preserving existing data if we only pass partial data?
    // Current app architecture passes full object usually. Let's assume full overwrite of the row for simplicity.
    const pixKey = data.pix?.key || '';
    const pixType = data.pix?.type || '';
    const responsible = data.responsible || '';

    if (rowIndex !== -1) {
        // Update existing
        const rangeToWrite = `'Participantes'!B${rowIndex + 1}:D${rowIndex + 1}`;
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeToWrite}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[pixKey, pixType, responsible]] })
        });
    } else {
        // Append new
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Participantes'!A1:D1:append?valueInputOption=USER_ENTERED`;
        await fetch(appendUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[name, pixKey, pixType, responsible]] })
        });
    }
}

export async function updateProductInSheet(product: Product, allParticipants: Participant[], sheetName: string, customUrl?: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    const rowNumber = product.id;
    const range1 = `'${sheetName}'!A${rowNumber}:B${rowNumber}`;
    const range2 = `'${sheetName}'!D${rowNumber}:Z${rowNumber}`;

    const val1 = [product.name, `R$ ${product.price.toFixed(2).replace('.', ',')}`];
    const val2: string[] = [product.payer];
    allParticipants.forEach(p => val2.push(product.consumers.includes(p.name) ? 'x' : ''));

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    await fetch(batchUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: [{ range: range1, values: [val1] }, { range: range2, values: [val2] }] })
    });
}

export async function deleteProductFromSheet(product: Product, _sheetName: string, sheetId: number, customUrl?: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    const isPayment = product.isPayment || (typeof product.id === 'string' && product.id.startsWith('pay-'));

    if (isPayment) {
        // DELETE FROM PAGAMENTOS TAB
        // 1. We need to find the ROW index. ID is encoded in the product.id as "pay-{sheet_id_col_A}"
        const targetId = product.id.replace('pay-', '');

        // Fetch IDs from Pagamentos to find row
        // Range A:A. Header is Row 0 (ID).
        const resIds = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Pagamentos'!A:A`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!resIds.ok) {
            console.error("Failed to read Pagamentos IDs for deletion");
            return;
        }

        const dataIds = await resIds.json();
        const rowsA = dataIds.values as string[][] || [];

        // Find index. rowsA[i][0] is the ID.
        // Use loose comparison or trim to ensure match
        // Find index. rowsA[i][0] is the ID.
        // Use loose comparison or trim to ensure match. Also handle Number vs String (leading zeros).
        const rowIndex = rowsA.findIndex(r => {
            const rowId = String(r[0]).trim();
            const searchId = targetId.trim();
            return rowId === searchId || Number(rowId) === Number(searchId);
        });

        console.log(`Deleting Payment. Target: ${targetId}, Found Index: ${rowIndex}`);

        if (rowIndex === -1) {
            console.warn("Payment ID Not Found for deletion:", targetId, "Available:", rowsA.map(r => r[0]));
            return;
        }

        // Fetch metadata to find correct sheetId for 'Pagamentos' tab
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, { headers: { Authorization: `Bearer ${token}` } });
        const meta = await metaRes.json();
        const pagamentosSheet = meta.sheets.find((s: any) => s.properties.title === 'Pagamentos');

        if (!pagamentosSheet) {
            console.error("Pagamentos sheet not found during delete");
            return;
        }

        const pagamentosSheetId = pagamentosSheet.properties.sheetId;

        console.log(`Deleting from SheetID: ${pagamentosSheetId}, Row: ${rowIndex}`);

        const delRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{ deleteDimension: { range: { sheetId: pagamentosSheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }]
            })
        });

        if (!delRes.ok) {
            const errBody = await delRes.text();
            console.error("Delete Failed", errBody);
        }

    } else {
        // DELETE FROM MAIN SHEET (Legacy/Products)
        const rowNumber = parseInt(product.id, 10);
        if (isNaN(rowNumber)) return;
        const rowIndex = rowNumber - 1;

        const delRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{ deleteDimension: { range: { sheetId: sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }]
            })
        });

        if (!delRes.ok) {
            const errBody = await delRes.text();
            console.error("Delete Failed", errBody);
        }
    }
}

export async function deleteAllPaymentsFromSheet(spreadsheetId: string | null, customUrl?: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();
    let targetSpreadsheetId = DEFAULT_SPREADSHEET_ID;

    if (spreadsheetId) targetSpreadsheetId = spreadsheetId;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) targetSpreadsheetId = parsedId;
    }

    try {
        // Clear 'Pagamentos' sheet content (keeping header)
        // Check if sheet exists first or just try to clear range A2:E
        const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/'Pagamentos'!A2:E:clear`;

        await fetch(clearUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });

    } catch (e) {
        console.error("Failed to clear all payments", e);
        throw e;
    }
}



export async function initializeSheet(targetUrlOrId: string, _products: Product[], _participants: Participant[], _payments: PaymentRecord[], accessToken?: string) {
    // Basic implementation for export logic if needed in future
    // For now, this function is a placeholder or minimal logic as requested by error logs
    // In a real scenario, this would clear the sheet and writing everything.
    const token = accessToken || await getAccessToken();
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;

    // Check if URL or ID
    if (targetUrlOrId.includes('/d/')) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(targetUrlOrId);
        if (parsedId) spreadsheetId = parsedId;
    } else {
        spreadsheetId = targetUrlOrId;
    }

    // Initialize Headers if empty?
    // For now we just create the 'Participantes' and 'Pagamentos' tabs if missing?
    // We already have logic for that.

    // Actually, createBarbecue creates a BLANK file. We need to add Headers.
    console.log("Initializing sheet", spreadsheetId);

    // Create 'Participantes' sheet if it doesn't exist
    // Create 'Pagamentos' sheet if it doesn't exist
    // Setup Main Sheet Header (Item, Valor, Quem Pagou...)
    // This is complex. For current scope, let's just ensure we can write to it later.
    // The previous logic assumed we are "exporting" existing data.

    // If Products/Participants empty (New Churrasco), we just write headers.

    try {
        // 1. Main Sheet Headers
        // Main sheet is usually 'Sheet1' or 'Página1'. We need to know the name.
        // We fetch metadata.
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const meta = await metaRes.json();
        const mainSheetTitle = meta.sheets?.[0]?.properties?.title || 'Sheet1';

        const headerValues = [['Item', 'Valor', '', 'Quem Pagou']]; // We can add participants later as columns

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${mainSheetTitle}'!A1:D1?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: headerValues })
        });

        // 2. Create Participantes Tab
        if (!meta.sheets.find((s: any) => s.properties.title === 'Participantes')) {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{ addSheet: { properties: { title: "Participantes" } } }]
                })
            });
            // Headers
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Participantes'!A1:D1?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [['Nome', 'Pix Key', 'Pix Type', 'Responsible']] })
            });
        }

        // 3. Create Pagamentos Tab
        if (!meta.sheets.find((s: any) => s.properties.title === 'Pagamentos')) {
            await createPagamentosSheet(spreadsheetId, token);
        }

    } catch (e) {
        console.warn("Initialization warn", e);
    }

    return true;
}

export async function deleteParticipantFromSheet(name: string, sheetName: string, sheetId: number, customUrl?: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    if (customUrl) {
        const { spreadsheetId: parsedId } = parseGoogleSheetUrl(customUrl);
        if (parsedId) spreadsheetId = parsedId;
    }

    // 1. Delete from Main Sheet (Column)
    const rangeHeader = `'${sheetName}'!1:1`;
    const resH = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeHeader}`, { headers: { Authorization: `Bearer ${token}` } });
    const dataH = await resH.json();
    const headers = dataH.values?.[0] || [];

    // Find column index
    const colIndex = headers.findIndex((h: string) => h && h.trim() === name);

    if (colIndex !== -1) {
        console.log(`Deleting participant column for ${name} at index ${colIndex}`);
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: "COLUMNS",
                            startIndex: colIndex,
                            endIndex: colIndex + 1
                        }
                    }
                }]
            })
        });
    } else {
        console.warn(`Participant ${name} not found in main sheet header.`);
    }

    // 2. Delete from Participantes Tab (Row)
    const rangePart = `'Participantes'!A:A`;
    const resP = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangePart}`, { headers: { Authorization: `Bearer ${token}` } });
    const dataP = await resP.json();
    const rowsP = dataP.values as string[][] || [];

    const rowIndex = rowsP.findIndex(row => row[0] && row[0].trim() === name);

    if (rowIndex !== -1) {
        // We need the sheetId of 'Participantes' tab
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, { headers: { Authorization: `Bearer ${token}` } });
        const meta = await metaRes.json();
        const partSheet = meta.sheets.find((s: any) => s.properties.title === 'Participantes');

        if (partSheet) {
            console.log(`Deleting participant row for ${name} at index ${rowIndex} in Participantes tab`);
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: partSheet.properties.sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                })
            });
        }
    }
}

