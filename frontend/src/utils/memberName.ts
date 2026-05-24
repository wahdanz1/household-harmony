/** "Daniel Wahlgren" → "Daniel W". Single-word names are returned unchanged.
 *  Members only — subjects (e.g. "Nya bilen") keep their full entered name. */
export const shortMemberName = (full: string): string => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] ?? "";
    return `${parts[0]} ${parts[parts.length - 1][0]}`;
};
