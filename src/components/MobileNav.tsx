import { Home, TrendingUp, TrendingDown, Target, CreditCard, BarChart3, Settings } from "lucide-react";
import { NavLink } from "./NavLink";

const MobileNav = () => {
  const navItems = [
    { icon: Home, label: "Dashboard", path: "/" },
    { icon: TrendingUp, label: "Income", path: "/income" },
    { icon: TrendingDown, label: "Expenses", path: "/expenses" },
    { icon: Target, label: "Savings", path: "/savings" },
    { icon: CreditCard, label: "Subscriptions", path: "/subscriptions" },
    { icon: BarChart3, label: "History", path: "/history" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-white/5 z-50 md:hidden">
      <div className="grid grid-cols-7 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-all"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;