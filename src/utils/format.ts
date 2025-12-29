
export function formatCurrency(value: number): string {
    const abs = Math.abs(value);
    const str = abs.toFixed(2).replace('.', ',');
    // Check strict negative with epsilon to avoid -0.00
    const prefix = value < -0.005 ? '- ' : '';
    return `${prefix}R$ ${str}`;
}
