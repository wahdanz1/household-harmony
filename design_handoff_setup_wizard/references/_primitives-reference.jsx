// Household Harmony — Persimmon refresh
// Mobile-first interactive prototype + design system reference

const { useState, useEffect, useRef, useMemo, Fragment } = React;

// ─────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────
// All values are CSS vars — themes are swapped by setting data-theme on the wrapper
const T = {
  bg:        'var(--bg)',
  bgTrans:   'var(--bg-trans)',
  surface:   'var(--surface)',
  surface2:  'var(--surface-2)',
  ink:       'var(--ink)',
  ink2:      'var(--ink-2)',
  muted:     'var(--muted)',
  line:      'var(--line)',
  line2:     'var(--line-2)',
  accent:    'var(--accent)',     // Chlorophyll green — harmony, growth
  accentDk:  'var(--accent-dk)',
  accentTint:'var(--accent-tint)',
  accentInk: 'var(--accent-ink)', // text color used ON accent fills
  danger:    'var(--danger)',     // reserved for warnings/destructive only
  warn:      'var(--warn)',
  ok:        'var(--accent)',
  shadow:    'var(--shadow)',
};

const sansStack  = '"DM Sans", ui-sans-serif, system-ui, sans-serif';
const monoStack  = '"DM Mono", ui-monospace, "SF Mono", Menlo, monospace';

// SEK formatter
const fmtKr = (n) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.round(n));
  // sv-SE uses non-breaking space as thousand sep
  const s = v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${sign}${s} kr`;
};

// ─────────────────────────────────────────────────────────────
// PRIMITIVE UI
// ─────────────────────────────────────────────────────────────
function Btn({ kind = 'primary', size = 'md', icon, children, onClick, full, disabled, style = {}, ...rest }) {
  const sizes = {
    sm: { h: 36, px: 14, fs: 13, r: 10 },
    md: { h: 44, px: 18, fs: 15, r: 12 },
    lg: { h: 52, px: 22, fs: 16, r: 14 },
  }[size];
  const base = {
    height: sizes.h,
    padding: `0 ${sizes.px}px`,
    borderRadius: sizes.r,
    fontFamily: sansStack,
    fontSize: sizes.fs,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'transform 80ms ease, background 120ms ease, border-color 120ms ease',
    width: full ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
  };
  const variants = {
    primary:    { background: T.accent,   color: T.accentInk, borderColor: T.accentDk },
    secondary:  { background: T.surface,  color: T.ink,       borderColor: T.line },
    ghost:      { background: 'transparent', color: T.ink,    borderColor: 'transparent' },
    destructive:{ background: T.surface,  color: T.danger,    borderColor: T.line },
    accentSoft: { background: T.accentTint, color: T.accentDk, borderColor: 'transparent' },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...variants[kind], ...style }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={e => e.currentTarget.style.transform = ''}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

function Card({ children, padding = 20, style = {} }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 16,
      padding,
      ...style,
    }}>{children}</div>
  );
}

function Badge({ children, tone = 'neutral', style = {} }) {
  const tones = {
    neutral:  { bg: T.surface2,   fg: T.ink2,     bd: T.line },
    accent:   { bg: T.accentTint, fg: T.accentDk, bd: 'transparent' },
    success:  { bg: T.accentTint, fg: T.accentDk, bd: 'transparent' },
    warn:     { bg: 'color-mix(in oklab, var(--surface-2) 55%, oklch(0.78 0.14 75) 45%)', fg: 'var(--warn)', bd: 'transparent' },
    danger:   { bg: 'color-mix(in oklab, var(--surface-2) 60%, oklch(0.62 0.18 25) 40%)', fg: 'var(--danger)', bd: 'transparent' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 22, padding: '0 8px',
      borderRadius: 6, fontFamily: sansStack, fontSize: 11.5,
      fontWeight: 600, letterSpacing: '0.02em',
      background: tones.bg, color: tones.fg,
      border: `1px solid ${tones.bd}`, ...style,
    }}>{children}</span>
  );
}

function Toggle({ on, onChange, size = 'md' }) {
  const W = size === 'sm' ? 36 : 44;
  const H = size === 'sm' ? 22 : 26;
  const D = H - 4;
  return (
    <button
      role="switch" aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: W, height: H, borderRadius: H,
        background: on ? T.accent : 'var(--toggle-off)',
        border: 'none', position: 'relative', cursor: 'pointer',
        transition: 'background 160ms ease', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? W - D - 2 : 2,
        width: D, height: D, borderRadius: D, background: 'var(--toggle-thumb)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        transition: 'left 160ms ease',
      }} />
    </button>
  );
}

function UnderlineInput({ value, onChange, mono, align = 'left', prefix, suffix, autoFocus, onBlur, onKey, placeholder, style = {} }) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) { ref.current.focus(); ref.current.select(); } }, [autoFocus]);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 4,
      borderBottom: `1.5px solid ${T.accent}`,
      padding: '2px 0', minWidth: 40,
    }}>
      {prefix && <span style={{ color: T.muted, fontSize: 13 }}>{prefix}</span>}
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); onKey?.(e); }}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          fontFamily: mono ? monoStack : sansStack,
          fontSize: 'inherit', fontWeight: 'inherit', color: T.ink,
          textAlign: align, padding: 0, width: '100%', minWidth: 60,
          fontVariantNumeric: mono ? 'tabular-nums' : undefined,
          ...style,
        }}
      />
      {suffix && <span style={{ color: T.muted, fontSize: 13 }}>{suffix}</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// ICONS — minimal stroke set
// ─────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = 'currentColor', stroke = 1.7 }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':     return <svg {...p}><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z"/></svg>;
    case 'wallet':   return <svg {...p}><path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v2H5a2 2 0 00-2 2V7z"/><path d="M3 11h17a1 1 0 011 1v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/><circle cx="17" cy="15" r="1.3"/></svg>;
    case 'income':   return <svg {...p}><path d="M12 4v14M6 12l6 6 6-6"/></svg>;
    case 'handCoins':return <svg {...p}><path d="M11 15h2a2 2 0 100-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="M7 21l1.6-1.4c.3-.4.8-.6 1.4-.6h2.6c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 00-2.8-2.8L13 14.2"/><path d="M2 16l6 6"/><circle cx="16" cy="9" r="2.5"/><circle cx="6" cy="5" r="3"/></svg>;
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8L4.2 7a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case 'plus':     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chev':     return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevDown': return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'edit':     return <svg {...p}><path d="M14 4l6 6-10 10H4v-6L14 4z"/></svg>;
    case 'trash':    return <svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>;
    case 'close':    return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'menu':     return <svg {...p}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'search':   return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg>;
    case 'cal':      return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'card':     return <svg {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>;
    case 'shield':   return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>;
    case 'film':     return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 14h4M17 9h4M17 14h4"/></svg>;
    case 'cart':     return <svg {...p}><path d="M3 4h2l3 12h11l2-8H7"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>;
    case 'fork':     return <svg {...p}><path d="M5 3v6a3 3 0 003 3v9M11 3v6M8 3v6M16 3c-1 4-1 6 0 8l-1 10"/></svg>;
    case 'home2':    return <svg {...p}><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>;
    case 'flame':    return <svg {...p}><path d="M12 3s5 5 5 10a5 5 0 01-10 0c0-2 1-3 1-5 0-1-1-2-1-2 2 0 4 2 5-3z"/></svg>;
    case 'leaf':     return <svg {...p}><path d="M5 19c0-9 7-14 14-14 0 8-5 14-14 14zM5 19l7-7"/></svg>;
    case 'phone':    return <svg {...p}><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/></svg>;
    case 'people':   return <svg {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="8" r="2.5"/><path d="M15 20c0-2 2-4 5-4"/></svg>;
    case 'arrowR':   return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrowU':   return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6"/></svg>;
    case 'arrowD':   return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6"/></svg>;
    case 'briefcase':return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3"/></svg>;
    case 'sparkle':  return <svg {...p}><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/></svg>;
    case 'dot':      return <svg {...p}><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>;
    default: return null;
  }
};

// Category → icon + hue mapping (bg is mixed against surface-2 so it adapts to theme)
const CATS = {
  housing:   { icon: 'home2',     hue: 50  },
  food:      { icon: 'cart',      hue: 80  },
  transport: { icon: 'fork',      hue: 200 },
  energy:    { icon: 'flame',     hue: 30  },
  health:    { icon: 'leaf',      hue: 150 },
  phone:     { icon: 'phone',     hue: 260 },
  media:     { icon: 'film',      hue: 320 },
  card:      { icon: 'card',      hue: 240 },
  insurance: { icon: 'shield',    hue: 100 },
  work:      { icon: 'briefcase', hue: 60  },
  family:    { icon: 'people',    hue: 20  },
};

function CatIcon({ cat, size = 36 }) {
  const c = CATS[cat] || CATS.housing;
  const tone = `oklch(0.65 0.16 ${c.hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `color-mix(in oklab, var(--surface-2) 60%, ${tone} 40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.ink, flexShrink: 0,
    }}>
      <Icon name={c.icon} size={size * 0.5} stroke={1.8}/>
    </div>
  );
}

// Make the rest available
Object.assign(window, { T, sansStack, monoStack, fmtKr, Btn, Card, Badge, Toggle, UnderlineInput, Icon, CatIcon, CATS });
