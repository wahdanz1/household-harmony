/**
 * Client-Side Encryption Service
 * 
 * Uses Web Crypto API for all cryptographic operations.
 * Implements two-tier key architecture:
 * - DEK (Data Encryption Key): Random key that encrypts user data
 * - KEK (Key Encryption Key): Derived from password, encrypts the DEK
 */

// Constants
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derive a Key Encryption Key (KEK) from password using PBKDF2
 */
export async function deriveKEK(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // Derive the KEK using PBKDF2
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Generate a new random Data Encryption Key (DEK)
 */
export async function generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: KEY_LENGTH },
        true, // extractable so we can export/encrypt it
        ['encrypt', 'decrypt']
    );
}

/**
 * Export DEK to raw bytes (for encryption with KEK)
 */
export async function exportDEK(dek: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey('raw', dek);
}

/**
 * Import raw bytes as DEK
 */
export async function importDEK(rawKey: ArrayBuffer): Promise<CryptoKey> {
    // Extractable so the DEK can be re-wrapped under a new KEK (password change, recovery code).
    return crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM', length: KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt the DEK with the KEK for storage
 * Returns: { encryptedDEK: base64, iv: base64 }
 */
export async function encryptDEK(
    dek: CryptoKey,
    kek: CryptoKey
): Promise<{ encryptedDEK: string; iv: string }> {
    const iv = generateRandomBytes(IV_LENGTH);
    const rawDEK = await exportDEK(dek);

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        kek,
        rawDEK
    );

    return {
        encryptedDEK: arrayBufferToBase64(encryptedBuffer),
        iv: arrayBufferToBase64(iv.buffer),
    };
}

/**
 * Decrypt the DEK using the KEK
 */
export async function decryptDEK(
    encryptedDEK: string,
    iv: string,
    kek: CryptoKey
): Promise<CryptoKey> {
    const encryptedBuffer = base64ToArrayBuffer(encryptedDEK);
    const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));

    const rawDEK = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        kek,
        encryptedBuffer
    );

    return importDEK(rawDEK);
}

/**
 * Encrypt a string value with the DEK
 * Returns: base64 encoded ciphertext (iv prepended)
 */
export async function encrypt(plaintext: string, dek: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = generateRandomBytes(IV_LENGTH);

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        dek,
        data
    );

    // Prepend IV to ciphertext (IV is not secret, just needs to be unique)
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt a ciphertext string with the DEK
 * Returns: decrypted plaintext
 */
export async function decrypt(ciphertext: string, dek: CryptoKey): Promise<string> {
    const combined = new Uint8Array(base64ToArrayBuffer(ciphertext));

    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        dek,
        encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}

/**
 * Generate a new salt for key derivation
 */
export function generateSalt(): Uint8Array {
    return generateRandomBytes(SALT_LENGTH);
}

/**
 * Create encryption keys for a new user
 * Returns all the data needed to store in the user's profile
 */
export async function createUserEncryptionKeys(password: string): Promise<{
    encryptedDEK: string;
    dekSalt: string;
    dekIV: string;
    dek: CryptoKey; // Keep in memory, don't store!
}> {
    const salt = generateSalt();
    const kek = await deriveKEK(password, salt);
    const dek = await generateDEK();
    const { encryptedDEK, iv } = await encryptDEK(dek, kek);

    return {
        encryptedDEK,
        dekSalt: arrayBufferToBase64(salt.buffer),
        dekIV: iv,
        dek, // Return the raw DEK for immediate use in memory
    };
}

/**
 * Unlock user's vault by decrypting their DEK
 */
export async function unlockVault(
    password: string,
    encryptedDEK: string,
    dekSalt: string,
    dekIV: string
): Promise<CryptoKey> {
    const salt = new Uint8Array(base64ToArrayBuffer(dekSalt));
    const kek = await deriveKEK(password, salt);
    return decryptDEK(encryptedDEK, dekIV, kek);
}

/**
 * Re-encrypt DEK with a new password (for password change)
 */
export async function reEncryptDEK(
    dek: CryptoKey,
    newPassword: string
): Promise<{
    encryptedDEK: string;
    dekSalt: string;
    dekIV: string;
}> {
    const salt = generateSalt();
    const newKEK = await deriveKEK(newPassword, salt);
    const { encryptedDEK, iv } = await encryptDEK(dek, newKEK);

    return {
        encryptedDEK,
        dekSalt: arrayBufferToBase64(salt.buffer),
        dekIV: iv,
    };
}

export async function generateRecoveryCode(): Promise<string> {
    const { generateMnemonic } = await import('@scure/bip39');
    const { wordlist } = await import('@scure/bip39/wordlists/english.js');
    return generateMnemonic(wordlist, 128);
}

export function normalizeRecoveryCode(code: string): string {
    return code.trim().toLowerCase().split(/\s+/).join(' ');
}

export async function isValidRecoveryCode(code: string): Promise<boolean> {
    const { validateMnemonic } = await import('@scure/bip39');
    const { wordlist } = await import('@scure/bip39/wordlists/english.js');
    return validateMnemonic(normalizeRecoveryCode(code), wordlist);
}

export async function wrapDEKWithRecoveryCode(
    dek: CryptoKey,
    code: string
): Promise<{ encryptedDEK: string; salt: string; iv: string }> {
    const salt = generateSalt();
    const kek = await deriveKEK(normalizeRecoveryCode(code), salt);
    const { encryptedDEK, iv } = await encryptDEK(dek, kek);
    return {
        encryptedDEK,
        salt: arrayBufferToBase64(salt.buffer),
        iv,
    };
}

export async function unwrapDEKWithRecoveryCode(
    encryptedDEK: string,
    saltB64: string,
    iv: string,
    code: string
): Promise<CryptoKey> {
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const kek = await deriveKEK(normalizeRecoveryCode(code), salt);
    return decryptDEK(encryptedDEK, iv, kek);
}

function normalizeInviteCode(code: string): string {
    return code.trim().toUpperCase();
}

// Excludes I, L, O, 0 and 1 — these codes get read aloud and retyped.
const SPACE_INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SPACE_INVITE_LENGTH = 20;

/**
 * Invite code for a co-parenting space. Unlike a household invite code this is
 * the secret that wraps the space DEK, so it must come from a CSPRNG and carry
 * real entropy — 20 chars over a 31-symbol alphabet is ~99 bits.
 *
 * Returns the canonical, ungrouped form. This is the exact string the KEK is
 * derived from; use formatSpaceInviteCode() when showing it to someone.
 */
export function generateSpaceInviteCode(): string {
    const alphabet = SPACE_INVITE_ALPHABET;
    // Largest multiple of the alphabet size that fits in a byte; values at or
    // above it are discarded so every symbol stays equally likely.
    const limit = 256 - (256 % alphabet.length);
    const out: string[] = [];

    while (out.length < SPACE_INVITE_LENGTH) {
        for (const byte of generateRandomBytes(SPACE_INVITE_LENGTH)) {
            if (byte >= limit) continue;
            out.push(alphabet[byte % alphabet.length]);
            if (out.length === SPACE_INVITE_LENGTH) break;
        }
    }

    return out.join('');
}

/** Group into blocks of five for display. Never feed the result to the crypto. */
export function formatSpaceInviteCode(code: string): string {
    return normalizeSpaceInviteCode(code).replace(/(.{5})(?=.)/g, '$1-');
}

/** Canonical form: strips display grouping and any stray whitespace or case. */
export function normalizeSpaceInviteCode(code: string): string {
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export async function wrapDEKWithInviteCode(
    dek: CryptoKey,
    inviteCode: string,
): Promise<{ encryptedDEK: string; salt: string; iv: string }> {
    const salt = generateSalt();
    const kek = await deriveKEK(normalizeInviteCode(inviteCode), salt);
    const { encryptedDEK, iv } = await encryptDEK(dek, kek);
    return { encryptedDEK, salt: arrayBufferToBase64(salt.buffer), iv };
}

export async function unwrapDEKWithInviteCode(
    encryptedDEK: string,
    saltB64: string,
    iv: string,
    inviteCode: string,
): Promise<CryptoKey> {
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const kek = await deriveKEK(normalizeInviteCode(inviteCode), salt);
    return decryptDEK(encryptedDEK, iv, kek);
}

export async function rewrapDEKWithPassword(
    dek: CryptoKey,
    password: string,
): Promise<{ encryptedDEK: string; dekSalt: string; dekIV: string }> {
    return reEncryptDEK(dek, password);
}
