import { useEffect, useState } from "react";
import { getStatus, subscribe } from "@/utils/outageMonitor";

/**
 * Subscribe to the global outage monitor. Returns 'ok' or 'down' and
 * re-renders the consumer whenever the status flips.
 */
export function useOutageStatus(): "ok" | "down" {
    const [status, setStatus] = useState(getStatus);

    useEffect(() => {
        return subscribe(setStatus);
    }, []);

    return status;
}
