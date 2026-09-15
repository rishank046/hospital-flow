// Dynamic Credential & Run ID Generator
// Strictly isolated to apps/web/src/simulation/engine/

/**
 * Generates a unique Simulation Run ID.
 * Format: SIM-YYYYMMDD-HHMMSS-xxxx
 * Example: SIM-20260915-071422-a83f
 */
export function generateRunId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // 4 hex characters of cryptographic entropy
  const entropyBytes = new Uint8Array(2);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(entropyBytes);
  } else {
    entropyBytes[0] = Math.floor(Math.random() * 256);
    entropyBytes[1] = Math.floor(Math.random() * 256);
  }
  const entropyHex = Array.from(entropyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `SIM-${year}${month}${day}-${hours}${minutes}${seconds}-${entropyHex}`;
}

/**
 * Generates a high-entropy, unique password at runtime using window.crypto.getRandomValues().
 * Fulfills the minimum length (>= 6) and complexity constraints.
 *
 * NOTE: The generated password is kept in volatile simulation runtime memory ONLY
 * for the moment required to register & log in the actor, and is NEVER written to:
 * - logs
 * - GUI
 * - localStorage / sessionStorage
 * - scenario JSON
 */
export function generateDynamicPassword(): string {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~';
  const randomValues = new Uint8Array(length);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  // Guarantee at least one uppercase, lowercase, digit, and special char
  result += 'A';
  result += 'a';
  result += '9';
  result += '!';

  for (let i = 4; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  // Shuffle the result
  return result
    .split('')
    .sort(() => (Math.random() > 0.5 ? 1 : -1))
    .join('');
}

/**
 * Generates a unique, non-colliding email for a simulated actor.
 * Incorporates run ID, actor type, index, and runtime entropy.
 *
 * Examples:
 * sim-user-SIM-20260915-071422-a83f-001@example.test
 * sim-doctor-SIM-20260915-071422-a83f-001@example.test
 */
export function generateDynamicEmail(
  runId: string,
  actorType: string,
  index: number
): string {
  const indexStr = String(index).padStart(3, '0');
  const shortEntropy = Math.random().toString(36).substring(2, 6);
  return `sim-${actorType.toLowerCase()}-${runId.toLowerCase()}-${indexStr}-${shortEntropy}@example.test`;
}

/**
 * Generates realistic human names for simulated actors with clear designation.
 */
const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
  'Lucas', 'Harper', 'Alexander', 'Evelyn', 'Henry', 'Aria', 'Daniel'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

export function generateActorName(
  actorRole: string,
  index: number,
  prefix?: string
): string {
  const firstName = FIRST_NAMES[(index + 3) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index * 7 + 1) % LAST_NAMES.length];

  if (prefix) {
    return `${prefix} ${firstName} ${lastName}`;
  }
  if (actorRole === 'DOCTOR') {
    return `Dr. ${firstName} ${lastName}`;
  }
  return `${firstName} ${lastName}`;
}
