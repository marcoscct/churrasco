export interface Product {
    id: string; // Unique ID or Row Index
    name: string;
    price: number;
    consumers: string[]; // List of names
}

export interface Participant {
    name: string;
    totalToPay: number;
    productsConsumed: {
        productName: string;
        shareCost: number; // Cost of this product divided by number of consumers
    }[];
}

export interface SheetData {
    products: Product[];
    participants: Participant[];
    totalCost: number;
}
