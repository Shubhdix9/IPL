export const VALID_CATEGORIES = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const;
export type PlayerCategory = (typeof VALID_CATEGORIES)[number];

export const VALID_STATUSES = ['UPCOMING', 'LIVE', 'SOLD', 'UNSOLD'] as const;
export type PlayerStatus = (typeof VALID_STATUSES)[number];

export const VALID_ROLES = ['ADMIN', 'AUCTIONEER', 'TEAM_LEADER'] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export const DEFAULT_TEAM_BUDGET = 900_000_000; // 90 Crores in INR

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

/**
 * Validates that an amount is a finite, non-negative INR monetary value.
 */
export function validateMonetaryAmount(amount: unknown, fieldName: string = 'amount'): number {
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num) || num < 0) {
    throw new ValidationError(`Invalid ${fieldName}: must be a finite, non-negative number.`);
  }
  return Math.round(num);
}

/**
 * Computes standard IPL bidding increment based on current price level.
 */
export function getMinimumBidIncrement(currentAmount: number): number {
  if (currentAmount < 5_000_000) return 500_000;       // < 50L -> +5L
  if (currentAmount < 10_000_000) return 1_000_000;    // < 1Cr -> +10L
  if (currentAmount < 50_000_000) return 5_000_000;    // < 5Cr -> +50L
  if (currentAmount < 100_000_000) return 10_000_000;  // < 10Cr -> +1Cr
  return 20_000_000;                                   // >= 10Cr -> +2Cr
}

/**
 * Validates that a submitted bid is legal with respect to the current bid / base price.
 */
export function validateBidAmount(proposedAmount: number, currentBidOrBasePrice: number): void {
  validateMonetaryAmount(proposedAmount, 'proposed bid');
  if (proposedAmount <= currentBidOrBasePrice) {
    throw new ValidationError(
      `Bid amount (₹${proposedAmount}) must be strictly higher than current amount (₹${currentBidOrBasePrice}).`
    );
  }
}
