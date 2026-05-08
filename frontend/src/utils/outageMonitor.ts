/**
 * Lightweight outage detector for Supabase / backend connectivity.
 *
 * Counts consecutive infrastructure-level failures (network errors, 5xx).
 * Once the threshold is exceeded, the monitor "trips" and exposes that
 * state via subscribe() so the UI can:
 *   - show a single persistent banner instead of spamming toasts
 *   - pause non-essential polling and refetches
 *
 * Recovery is automatic: any reportSuccess() resets the counter and
 * un-trips the monitor. The user can also call retry() to actively probe.
 *
 * Auth and RLS errors are NOT counted — they mean "you can't do this",
 * not "server is down".
 */

import { supabase } from "@/integrations/supabase/client";

type Status = "ok" | "down";

const FAILURE_THRESHOLD = 3;
const listeners = new Set<(s: Status) => void>();

let status: Status = "ok";
let consecutiveFailures = 0;
let retryInFlight = false;

/** Heuristic: does this error look like an outage rather than a permission/validation issue? */
export function isInfrastructureError(err: any): boolean {
    if (!err) return false;

    // Supabase errors with a numeric `status`
    const httpStatus =
        typeof err.status === "number"
            ? err.status
            : typeof err.statusCode === "number"
                ? err.statusCode
                : null;
    if (httpStatus !== null) {
        if (httpStatus >= 500) return true; // 500, 502, 503, 504
        return false; // 4xx is not an outage
    }

    // Network-layer errors (no response received)
    const msg = String(err?.message ?? err ?? "").toLowerCase();
    if (!msg) return false;
    if (msg.includes("failed to fetch")) return true;
    if (msg.includes("networkerror")) return true;
    if (msg.includes("network error")) return true;
    if (msg.includes("err_failed")) return true;
    if (msg.includes("err_internet_disconnected")) return true;
    if (msg.includes("insufficient resources")) return true;
    if (msg.includes("load failed")) return true; // Safari fetch failure

    return false;
}

function notify() {
    for (const fn of listeners) fn(status);
}

/** Report any successful Supabase / backend response. Resets the counter. */
export function reportSuccess(): void {
    consecutiveFailures = 0;
    if (status !== "ok") {
        status = "ok";
        notify();
    }
}

/** Report a failed call. Trips the monitor only if it looks like infra. */
export function reportFailure(err: any): void {
    if (!isInfrastructureError(err)) return;
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD && status === "ok") {
        status = "down";
        notify();
    }
}

export function getStatus(): Status {
    return status;
}

export function isDown(): boolean {
    return status === "down";
}

export function subscribe(fn: (s: Status) => void): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

/**
 * Probe Supabase with a cheap read. Resolves true when reachable.
 * Uses households table because every authenticated user is a member of
 * at least one — RLS short-circuits without scanning.
 */
export async function retry(): Promise<boolean> {
    if (retryInFlight) return status === "ok";
    retryInFlight = true;
    try {
        const { error } = await supabase.from("households").select("id").limit(1);
        if (error && isInfrastructureError(error)) {
            // Still down — don't reset the counter, but don't add to it either.
            return false;
        }
        // Anything that's not an infra error means the server is reachable.
        // Even an RLS denial (403) tells us Supabase is up.
        reportSuccess();
        return true;
    } catch (err) {
        if (isInfrastructureError(err)) return false;
        // Non-infra exception means we got *some* response — server is up.
        reportSuccess();
        return true;
    } finally {
        retryInFlight = false;
    }
}

/** Wrap a Supabase result tuple and auto-report success/failure. */
export function track<T extends { error: any }>(result: T): T {
    if (result.error) {
        reportFailure(result.error);
    } else {
        reportSuccess();
    }
    return result;
}
