const adjectives = [
    "Cozy", "Golden", "Silver", "Emerald", "Crimson",
    "Starlit", "Moonlit", "Misty", "Thunder", "Crystal",
    "Velvet", "Jade", "Amber", "Azure", "Copper",
    "Twilight", "Dawn", "Frost", "Neon", "Radiant"
];

const nouns = [
    "Haven", "Nest", "Castle", "Manor", "Cottage",
    "Lodge", "Palace", "Sanctuary", "Fortress", "Villa",
    "Hideaway", "Retreat", "Estate", "Quarters", "Keep",
    "Dwelling", "Homestead", "Abode", "Residence", "Domain"
];

export function generateHouseholdName(): string {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective} ${noun}`;
}
