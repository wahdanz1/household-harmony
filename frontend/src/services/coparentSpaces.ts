/**
 * Co-Parenting Space Service
 *
 * A co-parenting space is a shared container with its own DEK, so someone
 * outside the household can see the kid schedule and the costs published to
 * them, and nothing else.
 *
 * Key handling mirrors households: one DEK per space, wrapped per member under
 * a password-derived KEK, handed to a new member through an invite whose code
 * wraps the DEK and never reaches the server.
 *
 * Creating a space takes a wrapping function rather than a password. The vault
 * caches the key-encryption key at unlock, so a new space key can be wrapped
 * for its owner without re-prompting for a password they already proved this
 * session.
 */

import { supabase } from '@/integrations/supabase/client';
import {
    generateDEK,
    normalizeSpaceInviteCode,
    hashSpaceInviteCode,
    unwrapDEKWithInviteCode,
    decryptDEK,
    rewrapDEKWithPassword,
    unlockVault,
} from './encryption';

/** Wraps a key so only this user can reopen it. Supplied by the encryption context. */
export type WrapForSelf = (
    key: CryptoKey,
) => Promise<{ encryptedDEK: string; dekSalt: string; dekIV: string } | null>;

const INVITE_TTL_HOURS = 72;

export interface CoParentSpace {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
}

export interface CoParentSpaceInvitePreview {
    spaceId: string;
    spaceName: string;
    invitedBy: string | null;
    invitedEmail: string;
}

export interface LoadedSpaceKey {
    spaceId: string;
    dek: CryptoKey;
}

/** Errors raised by redeem_coparent_invite, surfaced verbatim for the UI to map. */
export type RedeemErrorCode =
    | 'not_authenticated'
    | 'invite_not_found'
    | 'email_mismatch'
    | 'already_member';

export class CoParentInviteError extends Error {
    constructor(public code: RedeemErrorCode | 'unwrap_failed' | 'unknown', message?: string) {
        super(message ?? code);
        this.name = 'CoParentInviteError';
    }
}

function toRedeemError(message: string): CoParentInviteError {
    const known: RedeemErrorCode[] = [
        'not_authenticated',
        'invite_not_found',
        'email_mismatch',
        'already_member',
    ];
    const hit = known.find(code => message.includes(code));
    return new CoParentInviteError(hit ?? 'unknown', message);
}

/**
 * Create a space, seed the creator's membership, and store their wrap of the
 * new DEK. Returns the DEK so the caller can load it into the keyring.
 */
export async function createCoParentSpace(params: {
    name: string;
    userId: string;
    wrapForSelf: WrapForSelf;
}): Promise<{ space: CoParentSpace; dek: CryptoKey }> {
    const { name, userId, wrapForSelf } = params;

    const dek = await generateDEK();
    const wrap = await wrapForSelf(dek);
    if (!wrap) throw new Error('Vault is locked; cannot create a co-parenting space.');

    const { data: space, error: spaceError } = await supabase
        .from('coparent_spaces')
        .insert({ name, created_by: userId })
        .select()
        .single();

    if (spaceError || !space) {
        throw new Error(`Failed to create co-parenting space: ${spaceError?.message}`);
    }

    // Membership and key are separate rows; unwind the space if either fails so
    // a half-built space can't linger and shadow a retry.
    const { error: memberError } = await supabase
        .from('coparent_space_members')
        .insert({ space_id: space.id, user_id: userId, role: 'owner' });

    if (memberError) {
        await supabase.from('coparent_spaces').delete().eq('id', space.id);
        throw new Error(`Failed to join own co-parenting space: ${memberError.message}`);
    }

    const { error: keyError } = await supabase
        .from('coparent_space_vault_keys')
        .insert({
            space_id: space.id,
            user_id: userId,
            encrypted_dek: wrap.encryptedDEK,
            dek_salt: wrap.dekSalt,
            dek_iv: wrap.dekIV,
        });

    if (keyError) {
        await supabase.from('coparent_spaces').delete().eq('id', space.id);
        throw new Error(`Failed to store co-parenting space key: ${keyError.message}`);
    }

    return { space: space as CoParentSpace, dek };
}

/**
 * Create a space for an existing co-parent label and link the two.
 *
 * Deliberately independent of inviting: a schedule is useful on its own, and
 * the co-parent may never hold an account. Inviting later reuses whatever
 * space is already here.
 */
export async function createSpaceForCoParent(params: {
    coParentId: string;
    name: string;
    userId: string;
    wrapForSelf: WrapForSelf;
}): Promise<{ spaceId: string; dek: CryptoKey }> {
    const { coParentId, name, userId, wrapForSelf } = params;

    const { space, dek } = await createCoParentSpace({ name, userId, wrapForSelf });

    const { error } = await supabase
        .from('co_parents')
        .update({ space_id: space.id })
        .eq('id', coParentId);

    if (error) {
        await supabase.from('coparent_spaces').delete().eq('id', space.id);
        throw new Error('Failed to link the co-parent to the shared space.');
    }

    return { spaceId: space.id, dek };
}

/**
 * Invite someone to a space. Takes the already-wrapped key rather than the DEK
 * so the raw key never leaves the encryption context. The code is the only
 * thing that unwraps it and is never stored in plaintext, so it has to be shown
 * to the inviter now — it cannot be recovered later.
 */
export async function createCoParentSpaceInvite(params: {
    spaceId: string;
    householdId: string;
    invitedEmail: string;
    createdBy: string;
    code: string;
    wrapped: { encryptedDEK: string; salt: string; iv: string };
}): Promise<{ code: string; expiresAt: string }> {
    const { spaceId, householdId, invitedEmail, createdBy, code, wrapped } = params;
    const email = invitedEmail.trim().toLowerCase();

    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    // Only the hash is stored: the code itself derives the key that unwraps the
    // space DEK, so keeping it in the same row would defeat the encryption.
    const codeHash = await hashSpaceInviteCode(code);

    // Retire any outstanding invite for the same person so an older code can't
    // still be redeemed once a new one is issued.
    await supabase
        .from('coparent_space_invites')
        .update({ is_active: false, status: 'expired' })
        .eq('space_id', spaceId)
        .eq('invited_email', email)
        .eq('is_active', true);

    const { error } = await supabase
        .from('coparent_space_invites')
        .insert({
            space_id: spaceId,
            household_id: householdId,
            invite_code_hash: codeHash,
            invited_email: email,
            created_by: createdBy,
            encrypted_dek: wrapped.encryptedDEK,
            dek_salt: wrapped.salt,
            dek_iv: wrapped.iv,
            expires_at: expiresAt,
        });

    if (error) {
        throw new Error(`Failed to create co-parent invite: ${error.message}`);
    }

    return { code, expiresAt };
}

/** Placeholder until the invitee accepts and their first name replaces it. */
export const PLACEHOLDER_COPARENT_NAME = 'Other parent';

/**
 * Invite someone who is not tracked as a co-parent yet: creates the label, the
 * space, and the invite in one step. The label is named generically because the
 * real name arrives with the acceptance.
 */
export async function inviteNewCoParent(params: {
    householdId: string;
    userId: string;
    invitedEmail: string;
    wrapForSelf: WrapForSelf;
    loadKey: (spaceId: string, dek: CryptoKey) => void;
    wrapForInvite: (spaceId: string, code: string) =>
        Promise<{ encryptedDEK: string; salt: string; iv: string } | null>;
    generateCode: () => string;
}): Promise<{ code: string; coParentId: string }> {
    const { householdId, userId, invitedEmail, wrapForSelf, loadKey, wrapForInvite, generateCode } = params;

    const { data: row, error } = await supabase
        .from('co_parents')
        .insert({ household_id: householdId, name: PLACEHOLDER_COPARENT_NAME })
        .select('id')
        .single();
    if (error || !row) throw new Error('Could not create the co-parent.');

    const { spaceId, dek } = await createSpaceForCoParent({
        coParentId: row.id,
        name: PLACEHOLDER_COPARENT_NAME,
        userId,
        wrapForSelf,
    });
    loadKey(spaceId, dek);

    const code = generateCode();
    const wrapped = await wrapForInvite(spaceId, code);
    if (!wrapped) throw new Error('Could not prepare the shared key. Try unlocking again.');

    await createCoParentSpaceInvite({
        spaceId,
        householdId,
        invitedEmail,
        createdBy: userId,
        code,
        wrapped,
    });

    return { code, coParentId: row.id };
}

/**
 * Preview an invite before joining. Safe to call while signed out — the RPC is
 * SECURITY DEFINER and matches on the code alone.
 */
export async function lookupCoParentInvite(
    code: string,
): Promise<CoParentSpaceInvitePreview | null> {
    const { data, error } = await supabase.rpc('lookup_coparent_invite', {
        invite_code_in: normalizeSpaceInviteCode(code),
    });

    if (error || !data) return null;

    const row = data as Record<string, string | null>;
    if (!row.space_id) return null;

    return {
        spaceId: row.space_id,
        spaceName: row.space_name ?? '',
        invitedBy: row.invited_by ?? null,
        invitedEmail: row.invited_email ?? '',
    };
}

/**
 * Redeem an invite: join the space, unwrap the DEK with the code, then re-wrap
 * it under this user's password so future unlocks can reach it.
 */
export async function redeemCoParentInvite(params: {
    code: string;
    userId: string;
    wrapForSelf: WrapForSelf;
}): Promise<{ spaceId: string; dek: CryptoKey }> {
    const { userId, wrapForSelf } = params;
    const code = normalizeSpaceInviteCode(params.code);

    const { data, error } = await supabase.rpc('redeem_coparent_invite', {
        invite_code_in: code,
    });

    if (error) throw toRedeemError(error.message);
    if (!data) throw new CoParentInviteError('invite_not_found');

    const row = data as Record<string, string | null>;
    const spaceId = row.space_id;
    if (!spaceId || !row.encrypted_dek || !row.dek_salt || !row.dek_iv) {
        throw new CoParentInviteError('invite_not_found');
    }

    let dek: CryptoKey;
    try {
        dek = await unwrapDEKWithInviteCode(row.encrypted_dek, row.dek_salt, row.dek_iv, code);
    } catch {
        // Membership already exists at this point; without the key the space is
        // unreadable, so surface it rather than leaving a silent broken join.
        throw new CoParentInviteError('unwrap_failed');
    }

    const wrap = await wrapForSelf(dek);
    if (!wrap) throw new CoParentInviteError('unknown', 'Vault is locked.');

    const { error: keyError } = await supabase
        .from('coparent_space_vault_keys')
        .upsert({
            space_id: spaceId,
            user_id: userId,
            encrypted_dek: wrap.encryptedDEK,
            dek_salt: wrap.dekSalt,
            dek_iv: wrap.dekIV,
        });

    if (keyError) {
        throw new Error(`Failed to store co-parenting space key: ${keyError.message}`);
    }

    return { spaceId, dek };
}

/**
 * Unwrap every space key this user holds. Called during unlock, while the
 * password is in hand. A key that fails to unwrap is skipped rather than
 * failing the unlock — the household vault must still open.
 */
export async function loadCoParentSpaceKeys(params: {
    userId: string;
    password: string;
    /** KEK just derived for the household vault, with the salt it came from. */
    kek?: CryptoKey;
    kekSalt?: string;
}): Promise<LoadedSpaceKey[]> {
    const { userId, password, kek, kekSalt } = params;

    const { data, error } = await supabase
        .from('coparent_space_vault_keys')
        .select('space_id, encrypted_dek, dek_salt, dek_iv')
        .eq('user_id', userId);

    if (error || !data?.length) return [];

    const keys = await Promise.all(
        data.map(async row => {
            try {
                // Wraps made since the vault cached its KEK share the same salt,
                // so they open without another 100k-iteration derivation.
                const dek = kek && kekSalt && row.dek_salt === kekSalt
                    ? await decryptDEK(row.encrypted_dek, row.dek_iv, kek)
                    : await unlockVault(password, row.encrypted_dek, row.dek_salt, row.dek_iv);
                return { spaceId: row.space_id, dek };
            } catch (err) {
                console.error(`Failed to unwrap key for space ${row.space_id}:`, err);
                return null;
            }
        }),
    );

    return keys.filter((k): k is LoadedSpaceKey => k !== null);
}

/**
 * Re-wrap every space key under a new password. Must run whenever the vault
 * password changes, or the space keys stay wrapped under the old one and every
 * space silently becomes unreadable at the next unlock.
 *
 * Returns the space ids that could not be re-wrapped. A failure here is
 * recoverable — the member can be re-invited, which issues a fresh wrap — but
 * it must not pass silently.
 */
export async function rewrapCoParentSpaceKeys(params: {
    userId: string;
    oldPassword: string;
    newPassword: string;
}): Promise<{ rewrapped: number; failed: string[] }> {
    const { userId, oldPassword, newPassword } = params;

    const keys = await loadCoParentSpaceKeys({ userId, password: oldPassword });
    const failed: string[] = [];
    let rewrapped = 0;

    for (const { spaceId, dek } of keys) {
        try {
            const wrap = await rewrapDEKWithPassword(dek, newPassword);
            const { error } = await supabase
                .from('coparent_space_vault_keys')
                .update({
                    encrypted_dek: wrap.encryptedDEK,
                    dek_salt: wrap.dekSalt,
                    dek_iv: wrap.dekIV,
                })
                .eq('space_id', spaceId)
                .eq('user_id', userId);

            if (error) {
                failed.push(spaceId);
            } else {
                rewrapped++;
            }
        } catch {
            failed.push(spaceId);
        }
    }

    return { rewrapped, failed };
}

/** Spaces this user belongs to. */
export async function listCoParentSpaces(userId: string): Promise<CoParentSpace[]> {
    const { data, error } = await supabase
        .from('coparent_space_members')
        .select('coparent_spaces(id, name, created_by, created_at)')
        .eq('user_id', userId);

    if (error || !data) return [];

    return data
        .map(row => row.coparent_spaces as unknown as CoParentSpace | null)
        .filter((s): s is CoParentSpace => s !== null);
}
