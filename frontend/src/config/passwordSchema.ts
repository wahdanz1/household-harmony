import { z } from "zod";

/** Password requirements for new accounts. Doubles as the vault KEK passphrase. */
export const passwordSchema = z
    .string()
    .min(12, "Password must be at least 12 characters for encryption security")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");
