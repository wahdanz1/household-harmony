import { Home, TrendingUp, TrendingDown, Target, BarChart3, Settings, LogOut } from "lucide-react";
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
    { icon: BarChart3, label: "History", path: "/history" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <nav className="hidden md:block w-64 border-r border-white/5 bg-card/60 backdrop-blur-xl fixed left-0 top-0 bottom-0 p-6 z-20">
      <div className="mb-8">
        <h2>Economy Tracker</h2>
        <p className="text-sm text-muted-foreground mt-1">Household finances</p>
      </div>

      <div className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="nav-item"
            activeClassName="nav-item-active"
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