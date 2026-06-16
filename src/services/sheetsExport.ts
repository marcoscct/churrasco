import type { SheetData } from '../types';

/**
 * Exports Firestore Barbecue Data to a new Google Spreadsheet in the user's Google Drive.
 * 
 * @param name The name of the barbecue.
 * @param data The computed SheetData (products, participants, payments, groups).
 * @param token The user's Google OAuth access token.
 * @returns The spreadsheetId and spreadsheetUrl of the newly created sheet.
 */
export async function exportBarbecueToGoogleSheets(
    name: string,
    data: SheetData,
    token: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
        // 1. Create a new Spreadsheet with the four worksheets in a single API call
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    title: `[Churrasco] ${name}`
                },
                sheets: [
                    { properties: { title: 'Churrasco' } },
                    { properties: { title: 'Participantes' } },
                    { properties: { title: 'Pagamentos' } },
                    { properties: { title: 'Grupos' } }
                ]
            })
        });

        if (!createResponse.ok) {
            const errData = await createResponse.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Falha ao criar planilha no Google Drive.');
        }

        const spreadsheet = await createResponse.json();
        const spreadsheetId = spreadsheet.spreadsheetId;
        const spreadsheetUrl = spreadsheet.spreadsheetUrl;

        // 2. Prepare Data to write to worksheets
        const participantNames = data.participants.map(p => p.name);
        const participantMap = new Map(data.participants.map(p => [p.name, p]));

        // --- Churrasco (Main) Sheet ---
        const mainHeader = ['Item', 'Valor', '', 'Quem comprou', ...participantNames];
        const mainRows = (data.products || []).map(p => [
            p.name,
            p.price,
            '',
            p.payer,
            ...participantNames.map(name => p.consumers.includes(name) ? 'x' : '')
        ]);
        const mainTotal = [
            'TOTAL',
            data.totalCost || 0,
            '',
            '',
            ...participantNames.map(name => participantMap.get(name)?.totalConsumed || 0)
        ];
        const mainValues = [mainHeader, ...mainRows, mainTotal];

        // --- Participantes Sheet ---
        const partHeader = ['Nome', 'Pix Key', 'Pix Type', 'Responsible', 'Meia'];
        const partRows = (data.participants || []).map(p => [
            p.name,
            p.pix?.key || '',
            p.pix?.type || '',
            p.paymentResponsible || '',
            p.isHalf ? 'SIM' : 'NÃO'
        ]);
        const partValues = [partHeader, ...partRows];

        // --- Pagamentos Sheet ---
        const payHeader = ['ID', 'Data', 'De', 'Para', 'Valor'];
        const payRows = (data.payments || []).map((p, idx) => [
            p.id || `pay_${idx}`,
            p.date || new Date().toISOString(),
            p.from,
            p.to,
            p.amount
        ]);
        const payValues = [payHeader, ...payRows];

        // --- Grupos Sheet ---
        const groupHeader = ['Grupo', 'Participantes'];
        const groupRows = (data.groups || []).map(g => [
            g.name,
            g.members.join(', ')
        ]);
        const groupValues = [groupHeader, ...groupRows];

        // 3. Write all values in a single batchUpdate API request
        const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                valueInputOption: 'USER_ENTERED',
                data: [
                    {
                        range: "'Churrasco'!A1:Z100",
                        values: mainValues
                    },
                    {
                        range: "'Participantes'!A1:E100",
                        values: partValues
                    },
                    {
                        range: "'Pagamentos'!A1:E100",
                        values: payValues
                    },
                    {
                        range: "'Grupos'!A1:B100",
                        values: groupValues
                    }
                ]
            })
        });

        if (!writeResponse.ok) {
            const errData = await writeResponse.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Falha ao preencher dados na planilha.');
        }

        return { spreadsheetId, spreadsheetUrl };
    } catch (error) {
        console.error('Failed to export barbecue to Sheets:', error);
        throw error;
    }
}
