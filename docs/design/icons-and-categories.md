# Icons & categories reference

All icons are from [lucide-react](https://lucide.dev/). Source of truth:

- Nav: [`frontend/src/components/DesktopNav.tsx`](../../frontend/src/components/DesktopNav.tsx), [`frontend/src/components/MobileNav.tsx`](../../frontend/src/components/MobileNav.tsx)
- Categories: [`frontend/src/constants/`](../../frontend/src/constants/)

---

## Nav surfaces

| Surface | Icon (lucide) | Notes |
|---|---|---|
| Overview | `Home` | |
| Income | `HandCoins` | |
| Expenses | `Wallet` | |
| Settings | `Settings` | Desktop: ghost-icon button in user-card. Mobile: 4th bottom tab. |
| Logout | `LogOut` | Desktop: user-card. Mobile: lives inside Settings page. |
| Forecast (planned) | *(none yet — see suggestions below)* | |

### Forecast icon — open question

No canonical choice yet. Candidates from lucide:

- `LineChart` — strongest "forecast/projection" association.
- `CalendarRange` — emphasizes time-frame planning (per-month/per-year view).
- `Compass` — orientation/planning.
- `Telescope` — looking ahead (cute but maybe too literal).

`TrendingUp` is already used for `business_income`, so it's off the table.

---

## Expense categories

Source: [`expenseCategories.ts`](../../frontend/src/constants/expenseCategories.ts)

| ID | Label | Icon | Hue | isBudgeted (proposed) |
|---|---|---|---|---|
| `rent` | Rent | `Home` | 50 | false |
| `internet` | Internet | `Wifi` | 200 | false |
| `phone_plan` | Phone Plan | `Smartphone` | 260 | false |
| `electricity` | Electricity | `Zap` | 30 | false |
| `groceries` | Groceries | `ShoppingCart` | 80 | true |
| `dining_out` | Dining Out | `UtensilsCrossed` | 80 | true |
| `entertainment` | Entertainment | `Film` | 320 | true |
| `shopping` | Shopping | `ShoppingBag` | 320 | true |
| `fuel` | Fuel | `Fuel` | 200 | true |
| `travel` | Travel | `Plane` | 200 | true |
| `car_repairs` | Car Repairs | `Wrench` | 200 | false (edge case) |
| `credit_card` | Credit Card | `CreditCard` | 240 | false (edge case) |
| `healthcare` | Healthcare | `Heart` | 150 | false (edge case) |
| `memberships` | Memberships & dues | `Users2` | 100 | false |
| `other` | Other | `Sparkles` | — | false (default) |

**Hue palette** (from chlorophyll design language):
housing 50 · food 80 · transport 200 · energy 30 · health 150 · phone 260 · media 320 · card 240 · insurance 100 · work 60 · family 20

---

## Subscription categories

Source: [`subscriptionCategories.ts`](../../frontend/src/constants/subscriptionCategories.ts)

| ID | Label | Icon | Hue |
|---|---|---|---|
| `streaming` | Streaming | `Tv` | 320 |
| `software` | Software & Apps | `Code` | 240 |
| `music` | Music | `Music` | 320 |
| `gaming` | Gaming | `Gamepad2` | 30 |
| `gym` | Gym & Fitness | `Dumbbell` | 150 |
| `news` | News & Media | `Newspaper` | 240 |
| `storage` | Cloud Storage | `Cloud` | 240 |
| `education` | Education & Learning | `GraduationCap` | 60 |
| `other` | Other | `MoreHorizontal` | — |

---

## Insurance types

Source: [`insuranceTypes.ts`](../../frontend/src/constants/insuranceTypes.ts)

| ID | Label | Icon | Hue |
|---|---|---|---|
| `home` | Home | `Home` | 50 |
| `car` | Car | `Car` | 200 |
| `health` | Health | `Heart` | 150 |
| `child` | Child | `Baby` | 340 |
| `life` | Life | `User` | 100 |
| `pet` | Pet | `PawPrint` | 20 |
| `travel` | Travel | `Plane` | 200 |
| `liability` | Liability | `Scale` | 320 |
| `other` | Other | `MoreHorizontal` | — |

---

## Income categories

Source: [`incomeCategories.ts`](../../frontend/src/constants/incomeCategories.ts)

| ID | Label | Icon | Hue |
|---|---|---|---|
| `salary` | Salary | `Briefcase` | 60 |
| `business_income` | Business | `TrendingUp` | 60 |
| `government_benefits` | Government Benefits | `HandCoins` | 100 |
| `investment_income` | Investments | `PiggyBank` | 240 |
| `gift` | Gift | `Gift` | 20 |
| `other` | Other | `Sparkles` | — |

---

## Credit categories (credit-card statement parser)

Source: [`creditCategories.ts`](../../frontend/src/constants/creditCategories.ts) — used by the credit-card statement upload flow to tag parsed transactions. Overlaps with expense categories.

| ID | Label | Icon | Hue |
|---|---|---|---|
| `groceries` | Groceries | `ShoppingCart` | 80 |
| `fuel` | Fuel | `Fuel` | 200 |
| `shopping` | Shopping | `ShoppingBag` | 320 |
| `dining_out` | Dining Out | `UtensilsCrossed` | 80 |
| `entertainment` | Entertainment | `Film` | 320 |
| `car_repairs` | Car Repairs | `Wrench` | 200 |
| `travel` | Travel | `Plane` | 200 |
| `healthcare` | Healthcare | `Heart` | 150 |
| `other` | Other | `MoreHorizontal` | — |
