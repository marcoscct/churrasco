export interface Product {
    id: string; // Unique ID or Row Index
    name: string;
    price: number;
    payer: string; // Name of who paid
    consumers: string[]; // List of names
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

export interface SheetData {
    products: Product[];
    participants: Participant[];
    settlements: Transaction[];
    payments: PaymentRecord[]; // Completed payments ("Pagamento" rows)
    totalCost: number;
    isEmpty?: boolean; // New flag to indicate virgin sheet
    debugInfo?: {
        sheetName: string;
        sheetId?: number;
        rawHeader: string[];
        firstRows: string[][];
    };
}
