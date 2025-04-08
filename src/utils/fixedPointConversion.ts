/**
 * Converts a regular number to USDC fixed-point representation (multiplies by 10^6)
 * @param amount The regular number to convert (e.g., 1.23)
 * @returns The USDC fixed-point representation (e.g., 1230000)
 */
export function toUSDC(amount: number): number {
    return Math.round(amount * 1_000_000);
}

/**
 * Converts from USDC fixed-point representation to a regular number (divides by 10^6)
 * @param amount The USDC fixed-point amount (e.g., 1230000)
 * @returns The regular number representation (e.g., 1.23)
 */
export function fromUSDC(amount: number): number {
    return amount / 1_000_000;
}
