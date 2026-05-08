/**
 * Dev-only "fake today" override. Lets us simulate different points in
 * time without waiting for the real clock — useful for testing the
 * Monthly Review flow across financial-month boundaries.
 *
 * Disabled outside dev builds: getNow() always returns the real date in
 * production, so there is no risk of a stale localStorage value bleeding
 * into a deployed app.
 */

const STORAGE_KEY = "dev_today_override";

export function isDev(): boolean {
    return import.meta.env.DEV;
}

/**
 * Returns the current "now" — respecting a dev override in development,
 * always the real clock in production. Use this anywhere the answer to
 * "what month/day is it?" should be substitutable for testing.
 */
export function getNow(): Date {
    if (!isDev()) return new Date();
    try {
        const override = localStorage.getItem(STORAGE_KEY);
        if (override) {
            const d = new Date(override);
            if (!isNaN(d.getTime())) return d;
        }
    } catch {
        // localStorage may be unavailable; fall through to real clock.
    }
    return new Date();
}

/** Get the currently set override (yyyy-MM-dd string), or null if none. */
export function getDevToday(): string | null {
    if (!isDev()) return null;
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Set or clear the dev override. Pass null/empty to clear.
 * Accepts ISO date strings ("2026-05-25") or full ISO timestamps.
 */
export function setDevToday(value: string | null): void {
    if (!isDev()) return;
    try {
        if (value && value.length > 0) {
            localStorage.setItem(STORAGE_KEY, value);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // localStorage unavailable — silently no-op.
    }
}
