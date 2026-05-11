import {
    SiNetflix, SiSpotify, SiYoutube, SiAppletv, SiApplemusic,
    SiHbo, SiHbomax, SiTwitch, SiCrunchyroll, SiAudible,
    SiAnthropic, SiGithub, SiNotion,
    Si1password, SiBitwarden, SiDiscord, SiZoom,
    SiDropbox, SiIcloud, SiGooglecloud, SiNordvpn, SiExpressvpn,
    SiDuolingo, SiHeadspace, SiPatreon, SiSubstack,
    SiGoogleplay, SiPlaystation, SiSteam,
} from "@icons-pack/react-simple-icons";

export interface BrandIcon {
    Icon: React.ComponentType<{ size?: string | number; color?: string; title?: string }>;
    hex: string;
}

const REGISTRY: Record<string, BrandIcon> = {
    netflix:      { Icon: SiNetflix,     hex: "#E50914" },
    spotify:      { Icon: SiSpotify,     hex: "#1DB954" },
    youtube:      { Icon: SiYoutube,     hex: "#FF0000" },
    appletv:      { Icon: SiAppletv,     hex: "#000000" },
    applemusic:   { Icon: SiApplemusic,  hex: "#FA243C" },
    hbo:          { Icon: SiHbo,         hex: "#000000" },
    hbomax:       { Icon: SiHbomax,      hex: "#002BE7" },
    max:          { Icon: SiHbomax,      hex: "#002BE7" },
    twitch:       { Icon: SiTwitch,      hex: "#9146FF" },
    crunchyroll:  { Icon: SiCrunchyroll, hex: "#F47521" },
    audible:      { Icon: SiAudible,     hex: "#F8991C" },

    claude:       { Icon: SiAnthropic,   hex: "#D97757" },
    anthropic:    { Icon: SiAnthropic,   hex: "#D97757" },

    github:       { Icon: SiGithub,      hex: "#181717" },
    githubcopilot:{ Icon: SiGithub,      hex: "#181717" },
    notion:       { Icon: SiNotion,      hex: "#000000" },
    onepassword:  { Icon: Si1password,   hex: "#0094F5" },
    "1password":  { Icon: Si1password,   hex: "#0094F5" },
    bitwarden:    { Icon: SiBitwarden,   hex: "#175DDC" },
    discord:      { Icon: SiDiscord,     hex: "#5865F2" },
    zoom:         { Icon: SiZoom,        hex: "#0B5CFF" },

    dropbox:      { Icon: SiDropbox,     hex: "#0061FF" },
    icloud:       { Icon: SiIcloud,      hex: "#3693F3" },
    googlecloud:  { Icon: SiGooglecloud, hex: "#4285F4" },
    googleone:    { Icon: SiGooglecloud, hex: "#4285F4" },

    nordvpn:      { Icon: SiNordvpn,     hex: "#4687FF" },
    expressvpn:   { Icon: SiExpressvpn,  hex: "#DA3940" },

    duolingo:     { Icon: SiDuolingo,    hex: "#58CC02" },
    headspace:    { Icon: SiHeadspace,   hex: "#F47D31" },

    patreon:      { Icon: SiPatreon,     hex: "#FF424D" },
    substack:     { Icon: SiSubstack,    hex: "#FF6719" },
    googleplay:   { Icon: SiGoogleplay,  hex: "#414141" },
    playstation:  { Icon: SiPlaystation, hex: "#003791" },
    steam:        { Icon: SiSteam,       hex: "#000000" },
};

const TIER_WORDS = new Set([
    "premium", "pro", "max", "plus", "family", "duo", "free",
    "basic", "standard", "ultra", "lite", "starter", "essential", "personal",
]);

export function matchBrandIcon(serviceName: string | null | undefined): BrandIcon | null {
    if (!serviceName) return null;
    const cleaned = serviceName
        .toLowerCase()
        .replace(/\+/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
    if (!cleaned) return null;

    const collapsed = cleaned.replace(/\s+/g, "");
    if (REGISTRY[collapsed]) return REGISTRY[collapsed];

    const firstMeaningful = cleaned
        .split(/\s+/)
        .filter(w => !TIER_WORDS.has(w))
        .join("");
    if (firstMeaningful && REGISTRY[firstMeaningful]) return REGISTRY[firstMeaningful];

    const firstWord = cleaned.split(/\s+/)[0];
    if (REGISTRY[firstWord]) return REGISTRY[firstWord];

    return null;
}
