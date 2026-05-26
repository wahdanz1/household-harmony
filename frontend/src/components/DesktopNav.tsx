import { Home, Wallet, HandCoins } from "lucide-react";
import { NavLink } from "./NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { UserMenu } from "./shared/UserMenu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/utils/memberName";

const DesktopNav = () => {
  const { user } = useAuth();
  const { members } = useHousehold();

  const me = members.find(m => m.user_id === user?.id);
  const fullName = me?.profiles?.full_name || "";
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const avatarUrl = me?.profiles?.avatar_url || null;
  const initials = initialsOf(fullName);

  const navItems = [
    { icon: Home, label: "Overview", path: "/" },
    { icon: HandCoins, label: "Income", path: "/income" },
    { icon: Wallet, label: "Expenses", path: "/expenses" },
  ];

  return (
    <nav className="hidden md:flex md:flex-col w-64 border-r border-line bg-surface fixed left-0 top-0 bottom-0 p-5 z-20">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-5 mb-2">
        <img
          src="/household-harmony-logo.svg"
          alt=""
          aria-hidden="true"
          className="w-8 h-8"
        />
        <div>
          <div className="text-sm font-bold text-ink leading-tight tracking-tight">Household</div>
          <div className="text-[11px] text-muted leading-tight">Harmony</div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 px-3 h-10 rounded-[10px] text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
            activeClassName="bg-accent-tint text-accent-dk hover:bg-accent-tint hover:text-accent-dk font-semibold"
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* User card — opens UserMenu */}
      {fullName && (
        <div className="mt-auto pt-4">
          <UserMenu
            side="top"
            align="start"
            trigger={
              <button
                type="button"
                className="w-full rounded-[12px] bg-surface-2 p-3 flex items-center gap-2.5 hover:bg-accent-tint hover:text-accent-dk transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Account menu"
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={avatarUrl || undefined} alt={fullName || "User"} />
                  <AvatarFallback className="bg-accent text-accent-ink font-bold text-[13px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[13px] font-semibold text-ink truncate">{firstName}</span>
                </span>
              </button>
            }
          />
        </div>
      )}
    </nav>
  );
};

export default DesktopNav;
