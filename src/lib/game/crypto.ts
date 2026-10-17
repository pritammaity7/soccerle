import crypto from 'crypto';

// Secret key for encryption - in production, this should be in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'footballer-wordle-secret-key-2024';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a 32-byte key from the secret
function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

// Encrypt data
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(ENCRYPTION_KEY);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

// Decrypt data
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts[1];
  const key = deriveKey(ENCRYPTION_KEY);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Generate a deterministic but unpredictable daily answer index
export function getDailyAnswerIndex(date: Date, totalCount: number, secretSeed: string): number {
  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const seedString = `${secretSeed}:${dateString}`;
  
  // Create SHA-256 hash of the seed
  const hash = crypto.createHash('sha256').update(seedString).digest();
  
  // Convert first 4 bytes to a number
  const number = hash.readUInt32BE(0);
  
  // Modulo to get index within bounds
  return number % totalCount;
}

// Generate a secure hash for verification
export function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Generate a short ID for custom games
export function generateShortId(): string {
  return crypto.randomBytes(6).toString('base64url');
}

// Obfuscate the answer for client-side verification
export function obfuscateAnswer(answer: string, date: string): string {
  const combined = `${answer}:${date}:${ENCRYPTION_KEY}`;
  return generateHash(combined).substring(0, 16);
}
