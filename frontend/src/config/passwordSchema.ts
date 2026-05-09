import { z } from "zod";

/**
 * Single source of truth for new-account password strength.
 *
 * The same string is used as the KEK passphrase for the AES-256-GCM vault,
 * so a weak password directly weakens the encryption — every signup path
 * (regular signup, invite-join) must use this schema.
 */
export const passwordSchema = z
    .string()
    .min(12, "Password must be at least 12 characters for encryption security")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");
