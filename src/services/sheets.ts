import { getAccessToken } from './googleAuth';
import type { Product, Participant, SheetData } from '../types';

const SPREADSHEET_ID = '1PT1PmQJbBQm7U1y7uAKbezZq2PjZrgtF3Cz7ttxBZ20';
const TARGET_GID = 113213682;

export async function fetchSpreadsheetData(): Promise<SheetData> {
    const token = await getAccessToken();

    // 1. Get Sheet Metadata to find the sheet name
    const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaResponse.ok) throw new Error('Failed to fetch spreadsheet metadata');
    const meta = await metaResponse.json();

    // Find sheet by GID or default to first
    const sheet = meta.sheets.find((s: any) => s.properties.sheetId === TARGET_GID) || meta.sheets[0];
    const sheetName = sheet.properties.title;

    // 2. Fetch Data
    const range = `'${sheetName}'!A1:E100`; // Quote sheet name
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch sheet data');
    const data = await response.json();
    const rows = data.values as string[][];

    if (!rows || rows.length === 0) return { products: [], participants: [], totalCost: 0 };

    // 3. Parse Data
    return parseSheetData(rows);
}

function parseSheetData(rows: string[][]): SheetData {
    const products: Product[] = [];

    let productHeaderRowIndex = -1;

    // Heuristic: Start scanning for headers
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Check for presence of "Nome" AND "Valor" AND ("Quem via consumir" OR "Consumidor" etc)
        // Being looser with the match
        if (row.some(c => c && c.toLowerCase().includes('nome')) &&
            row.some(c => c && c.toLowerCase().includes('valor'))) {
            productHeaderRowIndex = i;
            break;
        }
    }

    if (productHeaderRowIndex !== -1) {
        // Read products until empty line
        for (let i = productHeaderRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows

            const name = row[0];
            const priceStr = row[1];
            const consumersStr = row[2]; // Assuming 3rd column is consumer

            if (!name || (!priceStr && !consumersStr)) continue; // Skip totally empty row

            const price = parseFloat(String(priceStr).replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;

            let consumers: string[] = [];
            if (consumersStr) {
                consumers = consumersStr.split(',').map(s => s.trim()).filter(s => s);
            }

            products.push({
                id: String(i + 1), // Row number as ID
                name,
                price,
                consumers
            });
        }
    }

    // Calculate Participants
    const participantMap = new Map<string, Participant>();

    products.forEach(p => {
        // If no consumers listed, maybe Everyone? Or No one.
        // Assuming if empty, cost is 0 or unassigned.
        // Logic: if consumers > 0, split.
        if (p.consumers.length > 0) {
            const costPerPerson = p.price / p.consumers.length;

            p.consumers.forEach(name => {
                if (!participantMap.has(name)) {
                    participantMap.set(name, {
                        name,
                        totalToPay: 0,
                        productsConsumed: []
                    });
                }
                const person = participantMap.get(name)!;
                person.totalToPay += costPerPerson;
                person.productsConsumed.push({
                    productName: p.name,
                    shareCost: costPerPerson
                });
            });
        }
    });

    return {
        products,
        participants: Array.from(participantMap.values()),
        totalCost: products.reduce((sum, p) => sum + p.price, 0)
    };
}

export async function addProductToSheet(product: Omit<Product, 'id' | 'consumers'>, consumers: string[]) {
    console.log('Adding product: ', product, consumers);
    // TODO: Implement append logic
}
