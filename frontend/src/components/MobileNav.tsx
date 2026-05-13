import { Home, Wallet, HandCoins } from "lucide-react";
import { NavLink } from "./NavLink";

const MobileNav = () => {
  const navItems = [
    { icon: Home, label: "Overview", path: "/" },
    { icon: HandCoins, label: "Income", path: "/income" },
    { icon: Wallet, label: "Expenses", path: "/expenses" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-line"
      style={{
        background: "var(--bg-trans)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-3 h-[58px]">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center gap-0.5 text-muted transition-colors"
            activeClassName="text-accent font-semibold"
          >
            <item.icon className="h-[22px] w-[22px]" strokeWidth={1.6} />
            <span className="text-[10.5px] font-medium tracking-[0.01em]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
