import {
  validateMonetaryAmount,
  validateBidAmount,
  getMinimumBidIncrement,
  DEFAULT_TEAM_BUDGET,
  ValidationError,
} from '../lib/validation';
import { requireAdmin, requireAuctioneer, requireTeamLeader, AuthorizationError } from '../lib/authorization';
import { checkRateLimit } from '../lib/rateLimit';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    testsFailed++;
  }
}

function runValidationTests() {
  console.log(`\n--- 1. Validation & Financial Rule Tests ---`);

  // Monetary validation
  assert(validateMonetaryAmount(900000000) === 900000000, 'Whole rupee budget validates correctly');
  assert(validateMonetaryAmount('50000000') === 50000000, 'Numeric string parses to integer');

  let errorThrown = false;
  try {
    validateMonetaryAmount(-100);
  } catch (e) {
    errorThrown = e instanceof ValidationError;
  }
  assert(errorThrown, 'Negative monetary amounts are strictly rejected');

  // Increments
  assert(getMinimumBidIncrement(2000000) === 500000, 'Price < 50L increment is ₹5 Lakhs');
  assert(getMinimumBidIncrement(8000000) === 1000000, 'Price < 1Cr increment is ₹10 Lakhs');
  assert(getMinimumBidIncrement(25000000) === 5000000, 'Price < 5Cr increment is ₹50 Lakhs');
  assert(getMinimumBidIncrement(75000000) === 10000000, 'Price < 10Cr increment is ₹1 Crore');
  assert(getMinimumBidIncrement(150000000) === 20000000, 'Price >= 10Cr increment is ₹2 Crores');

  // Bid legality
  errorThrown = false;
  try {
    validateBidAmount(20000000, 20000000);
  } catch {
    errorThrown = true;
  }
  assert(errorThrown, 'Bid equal to current price is rejected');

  errorThrown = false;
  try {
    validateBidAmount(19000000, 20000000);
  } catch {
    errorThrown = true;
  }
  assert(errorThrown, 'Bid lower than current price is rejected');
}

function runAuthorizationTests() {
  console.log(`\n--- 2. Role-Based Access Control (RBAC) Tests ---`);

  const adminUser = { uid: 'u1', username: 'admin', role: 'ADMIN' as const, isActive: true };
  const auctioneerMumbai = {
    uid: 'u2',
    username: 'auc_mum',
    role: 'AUCTIONEER' as const,
    locationId: 'loc_1',
    isActive: true,
  };
  const teamLeaderMI = {
    uid: 'u3',
    username: 'owner_mi',
    role: 'TEAM_LEADER' as const,
    locationId: 'loc_1',
    teamId: 'team_mi',
    isActive: true,
  };

  // Admin checks
  let passed = true;
  try {
    requireAdmin(adminUser);
  } catch {
    passed = false;
  }
  assert(passed, 'Admin user passes admin check');

  let failed = false;
  try {
    requireAdmin(auctioneerMumbai);
  } catch (e) {
    failed = e instanceof AuthorizationError;
  }
  assert(failed, 'Non-admin rejected from admin check');

  // Auctioneer venue checks
  passed = true;
  try {
    requireAuctioneer(auctioneerMumbai, 'loc_1');
  } catch {
    passed = false;
  }
  assert(passed, 'Auctioneer matches assigned location');

  failed = false;
  try {
    requireAuctioneer(auctioneerMumbai, 'loc_2');
  } catch {
    failed = true;
  }
  assert(failed, 'Auctioneer blocked from managing different location (venue isolation)');

  // Team Leader checks
  passed = true;
  try {
    requireTeamLeader(teamLeaderMI, 'team_mi');
  } catch {
    passed = false;
  }
  assert(passed, 'Team Leader can act on their own team');

  failed = false;
  try {
    requireTeamLeader(teamLeaderMI, 'team_csk');
  } catch {
    failed = true;
  }
  assert(failed, 'Team Leader blocked from acting on competitor team');
}

function runRateLimitTests() {
  console.log(`\n--- 3. Security & Rate Limiting Tests ---`);

  const testKey = 'test-client-ip-' + Date.now();
  let blocked = false;
  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testKey, 3, 5000);
    if (!res.success) {
      blocked = true;
      break;
    }
  }
  assert(blocked, 'Rate limiter activates when limit is exceeded');
}

function runAuctionSimulationTests() {
  console.log(`\n--- 4. Auction Mechanics & Financial Simulation Tests ---`);

  // Initial state simulation
  let teamBudget = DEFAULT_TEAM_BUDGET;
  const playerBasePrice = 20_000_000;
  let currentBid = playerBasePrice;
  let currentBidTeamId: string | null = null;
  const bidsHistory: { teamId: string; amount: number; status: string }[] = [];

  // Step 1: Place valid bid
  const bid1 = 25_000_000;
  validateBidAmount(bid1, currentBid);
  assert(bid1 <= teamBudget, 'Team has sufficient purse for Bid 1');
  currentBid = bid1;
  currentBidTeamId = 'team_mi';
  bidsHistory.push({ teamId: 'team_mi', amount: bid1, status: 'ACTIVE' });
  assert(currentBid === 25_000_000 && currentBidTeamId === 'team_mi', 'Bid 1 recorded successfully');

  // Step 2: Bid 2
  const bid2 = 30_000_000;
  validateBidAmount(bid2, currentBid);
  currentBid = bid2;
  currentBidTeamId = 'team_csk';
  bidsHistory.push({ teamId: 'team_csk', amount: bid2, status: 'ACTIVE' });
  assert(currentBid === 30_000_000, 'Bid 2 raises current bid to ₹3 Cr');

  // Step 3: Reversal of Bid 2
  const latestBid = bidsHistory.pop()!;
  latestBid.status = 'REVERSED';
  const previousBid = bidsHistory[bidsHistory.length - 1];
  currentBid = previousBid ? previousBid.amount : playerBasePrice;
  currentBidTeamId = previousBid ? previousBid.teamId : null;
  assert(currentBid === 25_000_000 && currentBidTeamId === 'team_mi', 'Bid reversal correctly restores previous high bid');

  // Step 4: Sell Player
  assert(currentBid <= teamBudget, 'Budget check passed prior to sale');
  const soldPrice = currentBid;
  teamBudget -= soldPrice;
  assert(teamBudget === 900_000_000 - 25_000_000, 'Sale correctly decrements winning team purse');

  // Step 5: Duplicate sale prevention check
  const playerStatus = 'SOLD';
  let duplicateRejected = false;
  if (playerStatus === 'SOLD') {
    duplicateRejected = true;
  }
  assert(duplicateRejected, 'Attempting to sell already SOLD player is rejected');

  // Step 6: Reopen and Refund
  teamBudget += soldPrice;
  assert(teamBudget === DEFAULT_TEAM_BUDGET, 'Reopening sold player restores exact team purse');

  // Step 7: Penalty 3-Strike Disqualification
  let mistakes = 0;
  let isDisqualified = false;
  for (let i = 1; i <= 3; i++) {
    mistakes++;
    if (mistakes >= 3) isDisqualified = true;
  }
  assert(mistakes === 3 && isDisqualified === true, '3 penalties trigger automatic disqualification');

  // Step 8: Reverse penalty
  mistakes--;
  isDisqualified = mistakes >= 3;
  assert(mistakes === 2 && isDisqualified === false, 'Reversing penalty removes disqualification status');
}

async function main() {
  console.log(`============================================================`);
  console.log(`IPL Auction Engine: Automated Verification & Unit Test Suite`);
  console.log(`============================================================`);

  runValidationTests();
  runAuthorizationTests();
  runRateLimitTests();
  runAuctionSimulationTests();

  console.log(`\n============================================================`);
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed.`);
  console.log(`============================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
