import { Home, TrendingUp, TrendingDown, Target, CreditCard, BarChart3, Settings, LogOut } from "lucide-react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const DesktopNav = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

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
    <nav className="hidden md:block w-64 border-r border-white/5 bg-card/60 backdrop-blur-xl fixed left-0 top-0 bottom-0 p-6 z-20">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Economy Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">Household finances</p>
      </div>
      
      <div className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
            activeClassName="bg-primary/20 text-primary hover:bg-primary/25 shadow-lg shadow-primary/10"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full flex items-center gap-3 justify-start border-white/10 bg-white/5 hover:bg-white/10 text-foreground"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Logout</span>
        </Button>
      </div>
    </nav>
  );
};

export default DesktopNav;