import { DollarSign, Receipt, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Income",
      icon: DollarSign,
      path: "/income",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      hoverBg: "hover:bg-green-500/20",
      borderColor: "border-green-500/30",
    },
    {
      label: "Expenses",
      icon: Receipt,
      path: "/expenses",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      hoverBg: "hover:bg-red-500/20",
      borderColor: "border-red-500/30",
    },
    {
      label: "Savings",
      icon: Target,
      path: "/savings",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      hoverBg: "hover:bg-blue-500/20",
      borderColor: "border-blue-500/30",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className={`flex items-center gap-3 p-4 rounded-lg border ${action.borderColor} ${action.bgColor} ${action.hoverBg} transition-all duration-200 group`}
        >
          <div className={`p-2 rounded-lg ${action.bgColor}`}>
            <action.icon className={`h-5 w-5 ${action.color}`} />
          </div>
          <span className="font-medium text-foreground group-hover:translate-x-1 transition-transform">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;