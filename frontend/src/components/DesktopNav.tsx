import { Home, Wallet, HandCoins, Settings, LogOut } from "lucide-react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useNavigate } from "react-router-dom";

const DesktopNav = () => {
  const { user, signOut } = useAuth();
  const { members } = useHousehold();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const me = members.find(m => m.user_id === user?.id);
  const fullName = me?.profiles?.full_name || "";
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const initial = firstName.charAt(0).toUpperCase() || "·";

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

      {/* User card */}
      <div className="mt-auto pt-4">
        {fullName && (
          <div className="rounded-[12px] bg-surface-2 p-3 mb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-[13px]">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-ink truncate">{firstName}</div>
              <div className="text-[11px] text-muted truncate">Logged in</div>
            </div>
            <Button
              onClick={() => navigate("/settings")}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hover:bg-accent-tint hover:text-accent-dk"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-3"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </nav>
  );
};

export default DesktopNav;
