import { AuthenticatedUser } from './auth';

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string = 'Forbidden: Insufficient permissions', statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

/**
 * Asserts that the user is authenticated and has the ADMIN role.
 */
export function requireAdmin(user: AuthenticatedUser | null): asserts user is AuthenticatedUser {
  if (!user) {
    throw new AuthorizationError('Unauthorized: Missing or invalid token', 401);
  }
  if (user.role !== 'ADMIN') {
    throw new AuthorizationError('Forbidden: Administrator privileges required', 403);
  }
}

/**
 * Asserts that the user is an AUCTIONEER for the given location, or an ADMIN.
 */
export function requireAuctioneer(
  user: AuthenticatedUser | null,
  locationId?: string | number | null
): asserts user is AuthenticatedUser {
  if (!user) {
    throw new AuthorizationError('Unauthorized: Missing or invalid token', 401);
  }
  if (user.role === 'ADMIN') {
    return;
  }
  if (user.role !== 'AUCTIONEER') {
    throw new AuthorizationError('Forbidden: Auctioneer privileges required', 403);
  }
  if (locationId && String(user.locationId) !== String(locationId)) {
    throw new AuthorizationError('Forbidden: You are not assigned to this auction location', 403);
  }
}

/**
 * Asserts that the user is a TEAM_LEADER for the given team, or an ADMIN.
 */
export function requireTeamLeader(
  user: AuthenticatedUser | null,
  teamId?: string | number | null
): asserts user is AuthenticatedUser {
  if (!user) {
    throw new AuthorizationError('Unauthorized: Missing or invalid token', 401);
  }
  if (user.role === 'ADMIN') {
    return;
  }
  if (user.role !== 'TEAM_LEADER') {
    throw new AuthorizationError('Forbidden: Team Leader privileges required', 403);
  }
  if (teamId && String(user.teamId) !== String(teamId)) {
    throw new AuthorizationError('Forbidden: You cannot act on behalf of another team', 403);
  }
}
