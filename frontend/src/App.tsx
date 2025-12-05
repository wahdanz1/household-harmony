import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import Savings from "./pages/Savings";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/income" element={<ProtectedRoute><Layout><Income /></Layout></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Layout><Expenses /></Layout></ProtectedRoute>} />
            <Route path="/savings" element={<ProtectedRoute><Layout><Savings /></Layout></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><Layout><History /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
