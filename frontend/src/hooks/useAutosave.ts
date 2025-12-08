import { useRef, useCallback, useEffect } from "react";

/**
 * Hook that provides debounced autosave functionality
 * 
 * @param saveFn - The async save function to call
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 * @returns Object with trigger function and pending state
 */
export function useAutosave<T>(
    saveFn: (value: T) => Promise<void>,
    debounceMs: number = 500
) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingRef = useRef(false);
    const lastValueRef = useRef<T | null>(null);

    const trigger = useCallback((value: T) => {
        lastValueRef.current = value;
        pendingRef.current = true;

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(async () => {
            try {
                await saveFn(value);
                pendingRef.current = false;
            } catch (error) {
                console.error("Autosave failed:", error);
                pendingRef.current = false;
            }
        }, debounceMs);
    }, [saveFn, debounceMs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Save immediately (skip debounce)
    const saveNow = useCallback(async () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (lastValueRef.current !== null) {
            await saveFn(lastValueRef.current);
            pendingRef.current = false;
        }
    }, [saveFn]);

    return {
        trigger,
        saveNow,
        isPending: () => pendingRef.current,
    };
}
