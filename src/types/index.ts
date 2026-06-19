export interface Product {
    id: string; // Unique ID or Row Index
    name: string;
    price: number;
    payer: string; // Name of who paid
    consumers: string[]; // List of names
    isPayment?: boolean; // Marker for payment records masquerading as products
    linkedGroupName?: string; // Name of the group this product is linked to
}

export interface Participant {
    name: string;
    totalPaid: number; // Total amount this person actually paid for products
    totalConsumed: number; // Value of products consumed
    netBalance: number; // paid - consumed (positive = receives, negative = pays)
    pix?: {
        key: string;
        type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';
    };
    paymentResponsible?: string; // Name of the person paying for this participant
    preferredRecipient?: string; // Name of the preferred recipient for this participant's payments
    isHalf?: boolean; // If true, this participant has a weight of 0.5 in the division
}

export interface Transaction {
    from: string;
    to: string;
    amount: number;
}

export interface PaymentRecord {
    id: string;
    from: string;
    to: string;
    amount: number;
    date?: string;
}

export interface Group {
    id?: string; // Unique ID for matching during edit/rename
    name: string;
    members: string[]; // List of participant names
    isHalf?: boolean; // If true, all members in this group pay half
    preferredRecipient?: string; // Preferred recipient for payments of members of this group
}

export interface SheetData {
    products: Product[];
    participants: Participant[];
    settlements: Transaction[];
    payments: PaymentRecord[]; // Completed payments ("Pagamento" rows)
    totalCost: number;
    groups?: Group[]; // Custom participant groups
    isEmpty?: boolean; // New flag to indicate virgin sheet
    debugInfo?: {
        sheetName: string;
        sheetId?: number;
        rawHeader: string[];
        firstRows: string[][];
    };
}
