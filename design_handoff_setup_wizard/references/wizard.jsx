// Setup Wizard — 6-step household onboarding shell.
// Composes existing primitives: Btn, Card, Toggle, CatIcon, Icon, T tokens.
// Pattern citizenship: StepIndicator variant + Confirm-with-stakes (DiscardDialog).

const { useState: uW, useMemo: uMW } = React;

// ── Step config — short labels per spec (no "Step N of M") ───────────────
const WIZARD_STEPS = [
  { id: 'welcome',  label: 'Välkommen' },
  { id: 'income',   label: 'Inkomst' },
  { id: 'expenses', label: 'Utgifter' },
  { id: 'subs',     label: 'Prenum.' },
  { id: 'insure',   label: 'Försäkring' },
  { id: 'review',   label: 'Klart' },
];

// ── StepIndicator — wizard variant ───────────────────────────────────────
// 6 uniform nodes: dot + number, accent ring for current, check for done.
// Resolves Q2: nodes stay numeric/uniform; the categorical signal lives on
// item rows below, never in the indicator. Step title also drops its icon.
function WizardStepIndicator({ currentIdx, onJump }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 0,
      padding: '6px 24px 22px',
    }}>
      {WIZARD_STEPS.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        const clickable = !!onJump && (done || current);
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => clickable && onJump(i)}
              disabled={!clickable}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                flexShrink: 0, minWidth: 0, background: 'transparent', border: 'none',
                padding: 0, cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? T.accent : T.surface,
                color: done ? T.accentInk : current ? T.accentDk : T.muted,
                border: current ? `2px solid ${T.accent}` : `1px solid ${T.line}`,
                fontFamily: monoStack, fontVariantNumeric: 'tabular-nums',
                fontSize: 12, fontWeight: 600,
                transition: 'all 160ms ease',
              }}>
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4 10-10"/>
                  </svg>
                ) : (i + 1)}
              </div>
              <span style={{
                fontFamily: sansStack, fontSize: 10.5,
                fontWeight: current ? 600 : 500,
                color: current ? T.ink : done ? T.ink2 : T.muted,
                whiteSpace: 'nowrap', letterSpacing: '-0.005em',
              }}>{s.label}</span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: done ? T.accent : T.line2,
                margin: '12px 4px 0', borderRadius: 1,
                transition: 'background 200ms ease',
              }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step title block — text only, no icon (per Q2 resolution) ────────────
function WizardTitle({ title, sub }) {
  return (
    <div style={{ padding: '6px 24px 16px' }}>
      <h2 style={{
        margin: 0, fontFamily: sansStack, fontSize: 24, fontWeight: 700,
        color: T.ink, letterSpacing: '-0.02em',
      }}>{title}</h2>
      {sub && (
        <p style={{
          margin: '6px 0 0', fontFamily: sansStack, fontSize: 14, lineHeight: 1.55,
          color: T.ink2, maxWidth: 580,
        }}>{sub}</p>
      )}
    </div>
  );
}

// ── Step 1 · Welcome ─────────────────────────────────────────────────────
// Resolves Q6 (tone) via the `tone` prop — 'pragmatic' (default) or 'warm'.
function WelcomeStep({ features, setFeatures, tone = 'pragmatic' }) {
  const copy = tone === 'warm' ? {
    title: 'Välkommen hem',
    sub:   'Vi gör i ordning ditt första hushåll. Tar ungefär 4 minuter — och du kan ändra allt senare.',
  } : {
    title: 'Sätt upp din första månad',
    sub:   'Tar ungefär 4 minuter. Du kan ändra allt senare.',
  };

  return (
    <div>
      <WizardTitle title={copy.title} sub={copy.sub}/>
      <div style={{ padding: '0 24px' }}>
        <div style={{
          background: T.surface, border: `1px solid ${T.line}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          <FeatureRow
            cat="card" title="Kreditkort"
            sub="Spåra köp och gräns per kort"
            on={features.creditCards}
            onChange={v => setFeatures(f => ({ ...f, creditCards: v }))}
            divider
          />
          <FeatureRow
            cat="family" title="Sambo & delning"
            sub="Dela utvalda utgifter med en medlem"
            on={features.sharedExpenses}
            onChange={v => setFeatures(f => ({ ...f, sharedExpenses: v }))}
          />
        </div>
        <p style={{
          margin: '14px 4px 0', fontFamily: sansStack, fontSize: 12,
          color: T.muted, lineHeight: 1.5,
        }}>
          Du kan slå på dessa senare i{' '}
          <strong style={{ color: T.ink2, fontWeight: 600 }}>
            Inställningar → Hushåll → Tilläggsmoduler
          </strong>.
        </p>
      </div>
    </div>
  );
}

function FeatureRow({ cat, title, sub, on, onChange, divider }) {
  return (
    <div style={{
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: divider ? `1px solid ${T.line2}` : 'none',
    }}>
      <CatIcon cat={cat} size={36}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: sansStack, fontSize: 14.5, fontWeight: 500,
          color: T.ink, letterSpacing: '-0.01em',
        }}>{title}</div>
        <div style={{ fontFamily: sansStack, fontSize: 12.5, color: T.muted, marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <Toggle on={on} onChange={onChange}/>
    </div>
  );
}

// ── Steps 2–5 · Generic item-list step ───────────────────────────────────
// Resolves Q4 (empty state) — copy is step-specific, soft nudge, not generic.
const STEP_KIND = {
  income: {
    key: 'income', title: 'Inkomstkällor',
    sub:   'Lön, frilans, hyresintäkter, ersättningar.',
    empty: 'Inga inkomstkällor ännu — börja med din huvudsakliga lön.',
    addLabel: 'Lägg till inkomst',
    nextStub: { name: 'Lön — ny arbetsgivare', amount: 32000, cat: 'work' },
  },
  expenses: {
    key: 'expenses', title: 'Fasta utgifter',
    sub:   'Hyra, el, bredband, mat, drivmedel. Lägg till en åt gången.',
    empty: 'Inga utgifter ännu — börja med hyra eller bostadslån.',
    addLabel: 'Lägg till utgift',
    nextStub: { name: 'Ny utgift', amount: 0, cat: 'housing', isBudgeted: false },
  },
  subs: {
    key: 'subs', title: 'Prenumerationer',
    sub:   'Streaming, mjukvara, gym, tidningar.',
    empty: 'Inga prenumerationer ännu — Spotify, Netflix, Storytel…',
    addLabel: 'Lägg till prenumeration',
    nextStub: { name: 'Ny prenumeration', amount: 0, freq: 'monthly', cat: 'media' },
  },
  insurance: {
    key: 'insurance', title: 'Försäkringar',
    sub:   'Hem, bil, hälsa, liv. Lägg till per försäkringsbolag.',
    empty: 'Inga försäkringar ännu — börja med hemförsäkring.',
    addLabel: 'Lägg till försäkring',
    nextStub: { name: 'Ny försäkring', amount: 0, freq: 'monthly', cat: 'insurance' },
  },
};

function ItemListStep({ kind, items, onAdd, onEdit, emptyMode = 'nudge' }) {
  const cfg = STEP_KIND[kind];
  const emptyCopy = emptyMode === 'generic'
    ? 'Inget tillagt ännu.'
    : cfg.empty;
  return (
    <div>
      <WizardTitle title={cfg.title} sub={cfg.sub}/>
      <div style={{ padding: '0 24px' }}>
        {items.length === 0 ? (
          <div style={{
            padding: 28, border: `1px dashed ${T.line}`, borderRadius: 14,
            textAlign: 'center', background: T.surface,
          }}>
            <div style={{
              fontFamily: sansStack, fontSize: 13.5, color: T.muted,
              lineHeight: 1.55, marginBottom: 14,
              maxWidth: 360, marginLeft: 'auto', marginRight: 'auto',
            }}>{emptyCopy}</div>
            <Btn kind="accentSoft" size="md" icon={<Icon name="plus" size={16}/>} onClick={onAdd}>
              {cfg.addLabel}
            </Btn>
          </div>
        ) : (
          <>
            <div style={{
              background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: 14, overflow: 'hidden', marginBottom: 12,
            }}>
              {items.map((it, idx) => (
                <ItemRow
                  key={it.id} kind={kind} item={it}
                  last={idx === items.length - 1}
                  onEdit={() => onEdit(it)}
                />
              ))}
            </div>
            <Btn kind="secondary" size="md" full icon={<Icon name="plus" size={16}/>} onClick={onAdd}>
              Lägg till till
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function ItemRow({ kind, item, last, onEdit }) {
  const [hover, setHover] = uW(false);
  const isBudget = kind === 'expenses' && item.isBudgeted;
  const unit = (kind === 'subs' || kind === 'insurance') && item.freq === 'yearly'
    ? 'kr/år' : 'kr';
  return (
    <button
      type="button"
      onClick={onEdit}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px',
        background: hover ? T.surface2 : 'transparent',
        border: 'none',
        borderBottom: last ? 'none' : `1px solid ${T.line2}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 100ms ease',
      }}
    >
      <CatIcon cat={item.cat} size={36}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: sansStack, fontSize: 14.5, fontWeight: 500,
          color: T.ink, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{item.name}</div>
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 2,
        fontFamily: monoStack, fontVariantNumeric: 'tabular-nums',
        fontSize: 14.5, fontWeight: isBudget ? 500 : 600,
        color: isBudget ? T.ink2 : T.ink,
        whiteSpace: 'nowrap',
      }}>
        {isBudget && (
          <span style={{
            fontFamily: sansStack, fontSize: 16, fontWeight: 500,
            color: T.accentDk, marginRight: 3, lineHeight: 1,
            transform: 'translateY(1px)',
          }}>~</span>
        )}
        {fmtKr(item.amount).replace(/\s?kr$/, '')}
        <span style={{
          fontFamily: sansStack, fontSize: 12.5, fontWeight: 400,
          color: T.muted, marginLeft: 2,
        }}>{unit}</span>
      </span>
    </button>
  );
}

// ── Step 6 · Review ──────────────────────────────────────────────────────
// Resolves Q5 — no confetti. Satisfaction comes from the math resolving.
function ReviewStep({ state, onJumpToStep }) {
  const inc = state.income.reduce((s, x) => s + x.amount, 0);
  const exp = state.expenses.reduce((s, x) => s + x.amount, 0);
  const sub = state.subs.reduce((s, x) => s + (x.freq === 'yearly' ? x.amount / 12 : x.amount), 0);
  const ins = state.insurance.reduce((s, x) => s + (x.freq === 'yearly' ? x.amount / 12 : x.amount), 0);
  const out = exp + sub + ins;
  const bal = inc - out;
  const hasAnyBudget = state.expenses.some(e => e.isBudgeted);

  return (
    <div>
      <WizardTitle
        title="Allt på plats"
        sub="Din första månad projiceras nedan. Du kan justera när som helst."
      />
      <div style={{ padding: '0 24px' }}>
        {/* Hero math — mirrors the Dashboard summary card pattern */}
        <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${T.line2}` }}>
            <div style={{
              fontFamily: sansStack, fontSize: 12, color: T.muted,
              fontWeight: 500, letterSpacing: '0.04em',
            }}>
              Kvar att spara i maj
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {hasAnyBudget && (
                <span style={{
                  fontFamily: sansStack, fontSize: 28, fontWeight: 500,
                  color: T.accentDk, lineHeight: 1, transform: 'translateY(2px)',
                }}>~</span>
              )}
              <span style={{
                fontFamily: monoStack, fontVariantNumeric: 'tabular-nums',
                fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em',
                color: bal >= 0 ? T.accent : T.danger,
              }}>
                {bal >= 0 ? '+' : '−'}{fmtKr(Math.abs(bal)).replace(/\s?kr$/, '')}
                <span style={{
                  fontFamily: sansStack, fontSize: 18, fontWeight: 500,
                  color: T.muted, marginLeft: 4,
                }}>kr</span>
              </span>
            </div>
            <div style={{
              marginTop: 8, fontFamily: sansStack, fontSize: 12.5, color: T.muted,
            }}>
              <span style={{ fontFamily: monoStack, fontVariantNumeric: 'tabular-nums' }}>
                {fmtKr(inc).replace(/\s?kr$/, '')}
              </span> kr in · <span style={{ fontFamily: monoStack, fontVariantNumeric: 'tabular-nums' }}>
                {fmtKr(out).replace(/\s?kr$/, '')}
              </span> kr ut
            </div>
          </div>
          <div style={{
            padding: '12px 20px',
            fontFamily: sansStack, fontSize: 12.5, color: T.accentDk,
            fontWeight: 500, background: T.accentTint,
          }}>
            Klart att börja maj — tryck <strong style={{ fontWeight: 700 }}>Klar</strong> för att stänga uppsättningen.
          </div>
        </Card>

        <ReviewSection title="Inkomstkällor"   count={state.income.length}    total={inc} onJump={() => onJumpToStep(1)}/>
        <ReviewSection title="Fasta utgifter"  count={state.expenses.length}  total={exp} onJump={() => onJumpToStep(2)}/>
        <ReviewSection title="Prenumerationer" count={state.subs.length}      total={sub} onJump={() => onJumpToStep(3)}/>
        <ReviewSection title="Försäkringar"    count={state.insurance.length} total={ins} onJump={() => onJumpToStep(4)} last/>
      </div>
    </div>
  );
}

function ReviewSection({ title, count, total, onJump, last }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14,
      padding: '12px 12px 12px 18px', marginBottom: last ? 0 : 8,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: sansStack, fontSize: 14, fontWeight: 600,
          color: T.ink, letterSpacing: '-0.01em',
        }}>{title}</div>
        <div style={{ fontFamily: sansStack, fontSize: 11.5, color: T.muted, marginTop: 2 }}>
          <span style={{ fontFamily: monoStack, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          {' '}{count === 1 ? 'post' : 'poster'}
        </div>
      </div>
      <span style={{
        fontFamily: monoStack, fontVariantNumeric: 'tabular-nums',
        fontSize: 15, fontWeight: 600, color: T.ink,
      }}>
        {fmtKr(total).replace(/\s?kr$/, '')}
        <span style={{
          fontFamily: sansStack, fontSize: 12, color: T.muted,
          marginLeft: 2, fontWeight: 400,
        }}>kr/mån</span>
      </span>
      <button onClick={onJump} style={{
        height: 30, padding: '0 10px', borderRadius: 8,
        border: `1px solid ${T.line}`, background: T.surface, cursor: 'pointer',
        fontFamily: sansStack, fontSize: 12, fontWeight: 600, color: T.ink2,
      }}>Lägg till fler</button>
    </div>
  );
}

// ── DiscardDialog — composes the Confirm-with-stakes pattern ─────────────
function DiscardDialog({ state, onCancel, onConfirm }) {
  const counts = [
    { l: 'Inkomstkällor',   n: state.income.length },
    { l: 'Fasta utgifter',  n: state.expenses.length },
    { l: 'Prenumerationer', n: state.subs.length },
    { l: 'Försäkringar',    n: state.insurance.length },
  ].filter(x => x.n > 0);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'rgba(20,15,10,0.32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'hh-fade 180ms ease',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, background: T.surface, border: `1px solid ${T.line}`,
        borderRadius: 20, overflow: 'hidden', animation: 'hh-pop 220ms ease',
      }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <h3 style={{
            margin: 0, fontFamily: sansStack, fontSize: 17, fontWeight: 600,
            color: T.ink, letterSpacing: '-0.01em',
          }}>Avsluta uppsättningen?</h3>
          <p style={{
            margin: '6px 0 0', fontFamily: sansStack, fontSize: 13,
            color: T.ink2, lineHeight: 1.5,
          }}>
            Det du har lagt till sparas inte. Du kan börja om när som helst från Inställningar.
          </p>
        </div>
        {counts.length > 0 && (
          <div style={{
            margin: '0 20px', padding: '12px 14px',
            background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10,
          }}>
            <span style={{
              fontFamily: sansStack, fontSize: 10.5, fontWeight: 600,
              color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Detta kastas</span>
            <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
              {counts.map(c => (
                <li key={c.l} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  padding: '3px 0', fontFamily: sansStack, fontSize: 13,
                }}>
                  <span style={{ color: T.ink2 }}>{c.l}</span>
                  <span style={{
                    fontFamily: monoStack, fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600, color: T.ink,
                  }}>{c.n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{
          padding: '16px 20px 18px', display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <Btn kind="secondary" onClick={onCancel}>Avbryt</Btn>
          <Btn kind="destructive" onClick={onConfirm}>Avsluta</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Wizard shell ─────────────────────────────────────────────────────────
// Desktop: centered modal at configurable width (default 840px — Q1).
// Mobile:  full-screen sheet (Q3 — flow, not glance).
function SetupWizard({
  initialStep = 0,
  initialState,
  isDesktop = true,
  height = 760,
  dialogWidth = 840,
  welcomeTone = 'pragmatic',  // Q6
  skipWeight = 'ghost',       // Q7
  emptyMode = 'nudge',        // Q4
}) {
  const [step, setStep] = uW(initialStep);
  const [state, setState] = uW(initialState || {
    features: { creditCards: false, sharedExpenses: false },
    income: [], expenses: [], subs: [], insurance: [],
  });
  const [confirmClose, setConfirmClose] = uW(false);

  const hasContent =
    state.income.length || state.expenses.length ||
    state.subs.length || state.insurance.length;

  const tryClose = () => {
    if (hasContent) setConfirmClose(true);
    else closeNow();
  };
  const closeNow = () => setConfirmClose(false); // mock — would dispatch close

  // Mock "Add" — append a stub item so the list state changes visibly.
  const stubAdd = (key) => {
    const stub = STEP_KIND[key === 'subs' ? 'subs' : key].nextStub;
    setState(s => ({
      ...s,
      [key]: [...s[key], { ...stub, id: key + '-' + Date.now() }],
    }));
  };
  const noop = () => {};

  const SkipBtn = ({ children, onClick }) =>
    skipWeight === 'secondary'
      ? <Btn kind="secondary" onClick={onClick}>{children}</Btn>
      : <Btn kind="ghost"     onClick={onClick}>{children}</Btn>;

  return (
    <div style={{
      width: '100%', height,
      background: isDesktop ? T.bg : T.surface,
      position: 'relative', overflow: 'hidden',
      fontFamily: sansStack, color: T.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Desktop scrim hint — a subtle wash to suggest "modal over app" */}
      {isDesktop && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 30%, oklch(0.94 0.01 75) 0%, var(--bg) 70%)',
          pointerEvents: 'none',
        }}/>
      )}

      <div style={isDesktop ? {
        width: dialogWidth, maxWidth: 'calc(100% - 40px)',
        maxHeight: 'calc(100% - 40px)',
        background: T.surface, border: `1px solid ${T.line}`,
        borderRadius: 20, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(20,15,10,0.18)',
        position: 'relative',
      } : {
        width: '100%', height: '100%',
        background: T.surface,
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Header strip — eyebrow + X */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: isDesktop ? '14px 18px 0' : '12px 16px 0',
        }}>
          <span style={{
            fontFamily: sansStack, fontSize: 10.5, fontWeight: 600,
            color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Sätt upp · Maj 2026</span>
          <button onClick={tryClose} style={{
            marginLeft: 'auto', width: 32, height: 32, borderRadius: 999,
            border: 'none', background: T.surface2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink2,
          }}>
            <Icon name="close" size={16}/>
          </button>
        </div>

        <WizardStepIndicator currentIdx={step} onJump={(i) => i < step && setStep(i)}/>

        <div style={{ flex: 1, overflow: 'auto', paddingBottom: 10 }}>
          {step === 0 && (
            <WelcomeStep
              tone={welcomeTone}
              features={state.features}
              setFeatures={(updater) => setState(s => ({
                ...s,
                features: typeof updater === 'function' ? updater(s.features) : updater,
              }))}
            />
          )}
          {step === 1 && <ItemListStep kind="income"    items={state.income}    onAdd={() => stubAdd('income')}    onEdit={noop} emptyMode={emptyMode}/>}
          {step === 2 && <ItemListStep kind="expenses"  items={state.expenses}  onAdd={() => stubAdd('expenses')}  onEdit={noop} emptyMode={emptyMode}/>}
          {step === 3 && <ItemListStep kind="subs"      items={state.subs}      onAdd={() => stubAdd('subs')}      onEdit={noop} emptyMode={emptyMode}/>}
          {step === 4 && <ItemListStep kind="insurance" items={state.insurance} onAdd={() => stubAdd('insurance')} onEdit={noop} emptyMode={emptyMode}/>}
          {step === 5 && <ReviewStep state={state} onJumpToStep={setStep}/>}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px 18px',
          borderTop: `1px solid ${T.line2}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {step === 0 ? (
            <>
              <SkipBtn onClick={closeNow}>
                {isDesktop ? "Hoppa över — jag lägger till manuellt" : 'Hoppa över'}
              </SkipBtn>
              <div style={{ flex: 1 }}/>
              <Btn kind="primary" onClick={() => setStep(1)}>Fortsätt →</Btn>
            </>
          ) : step === 5 ? (
            <>
              <Btn kind="ghost" onClick={() => setStep(step - 1)}>← Tillbaka</Btn>
              <div style={{ flex: 1 }}/>
              <Btn kind="primary" onClick={closeNow}>Klar — börja maj</Btn>
            </>
          ) : (
            <>
              <Btn kind="ghost" onClick={() => setStep(step - 1)}>← Tillbaka</Btn>
              <div style={{ flex: 1 }}/>
              <Btn kind="primary" onClick={() => setStep(step + 1)}>Fortsätt →</Btn>
            </>
          )}
        </div>

        {confirmClose && (
          <DiscardDialog state={state} onCancel={() => setConfirmClose(false)} onConfirm={closeNow}/>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SetupWizard, WizardStepIndicator, DiscardDialog, WIZARD_STEPS });
