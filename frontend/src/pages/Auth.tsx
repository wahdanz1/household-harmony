import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useToast } from "@/hooks/use-toast";
import { JoinHouseholdWizard } from "@/components/JoinHouseholdWizard";
import { RecoverPasswordDialog } from "@/components/auth/RecoverPasswordDialog";
import { UserPlus, Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";
import { PLACEHOLDERS } from "@/constants/ui";
import { isEmailAllowed } from "@/config/emailWhitelist";
import { passwordSchema } from "@/config/passwordSchema";
import { setDemoMode } from "@/utils/demoMode";
import { supabase } from "@/integrations/supabase/client";

// Feature flag: demo mode is hidden until the monthly review flow is rebuilt
const DEMO_ENABLED = false;

type Mode = "login" | "signup";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  confirmPassword: z.string(),
  fullName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Auth = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoLoadingMessage, setDemoLoadingMessage] = useState("");

  const { signIn, signUp, user } = useAuth();
  const { unlockWithPassword, initializeEncryption } = useEncryption();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ─── Demo mode ─────────────────────────────────────────────
  const handleTryDemo = async () => {
    setDemoLoading(true);
    const startTime = Date.now();

    const wakingTimeout = setTimeout(() => {
      setDemoLoadingMessage("Waking up backend...");
    }, 500);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/demo/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      clearTimeout(wakingTimeout);
      const elapsed = Date.now() - startTime;

      if (elapsed < 5000) {
        setDemoLoadingMessage("Creating demo user...");
      } else {
        setDemoLoadingMessage("Backend ready! Creating demo...");
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create demo');
      }

      const { email, password, user_id } = await response.json();

      setDemoLoadingMessage("Setting up household...");

      const { error: signInError } = await signIn(email, password);
      if (signInError) throw new Error(signInError.message);

      setDemoLoadingMessage("Unlocking encrypted vault...");

      const vaultUnlocked = await unlockWithPassword(password, user_id);
      if (!vaultUnlocked) {
        console.warn("Demo vault unlock failed - may not have encrypted data yet");
      }

      setDemoMode(true);
      sessionStorage.setItem('demo_password', password);
      localStorage.setItem('demo_tour_active', 'true');

      toast({
        title: "Welcome to the Demo!",
        description: "Vault unlocked with real AES-256 encryption. Explore all features!",
      });

      navigate('/');
    } catch (error: any) {
      clearTimeout(wakingTimeout);
      console.error('Demo creation failed:', error);
      toast({
        title: "Demo Creation Failed",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
      setDemoLoadingMessage("");
    }
  };

  // ─── Auto-redirect + email confirm hash handling ──────────
  useEffect(() => {
    // The join wizard makes `user` truthy mid-flow; wait for it to finish.
    if (user && !showJoinDialog) navigate("/", { replace: true });
  }, [user, navigate, showJoinDialog]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=signup') || hash.includes('type=email')) {
      toast({
        title: "Email Confirmed!",
        description: "Your account has been confirmed. You can now log in.",
      });
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [toast]);

  // ─── Submit handlers ──────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      const { error, data } = await signIn(email, password);
      if (error) {
        toast({
          title: "Login Failed",
          description: error.message.includes("Invalid login credentials")
            ? "Invalid email or password. Please try again."
            : error.message,
          variant: "destructive",
        });
        return;
      }

      if (data?.user) {
        localStorage.removeItem('is_demo_mode');
        localStorage.removeItem('demo_tour_active');
        localStorage.removeItem('demo_banner_dismissed');

        const vaultUnlocked = await unlockWithPassword(password, data.user.id);
        if (!vaultUnlocked) {
          console.warn("Failed to unlock encryption vault - user may have legacy unencrypted data");
        }
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validation = signupSchema.safeParse({ email, password, confirmPassword, fullName });
      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      const isAllowed = await isEmailAllowed(email);
      if (!isAllowed) {
        toast({
          title: "Access Restricted",
          description: "This application is currently in private beta. Your email is not on the approved list.",
          variant: "destructive",
        });
        return;
      }

      const { error, data } = await signUp(email, password, fullName);
      if (error) {
        toast({
          title: error.message.includes("User already registered") ? "Account Exists" : "Signup Failed",
          description: error.message.includes("User already registered")
            ? "An account with this email already exists. Please log in instead."
            : error.message,
          variant: "destructive",
        });
        return;
      }

      if (data?.user) {
        // The signup trigger's household insert can briefly trail the auth response — poll until visible.
        let householdId: string | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: membership } = await supabase
            .from("household_members")
            .select("household_id")
            .eq("user_id", data.user.id)
            .limit(1)
            .maybeSingle();
          if (membership?.household_id) {
            householdId = membership.household_id;
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        const encryptionInitialized = householdId
          ? await initializeEncryption(password, data.user.id, householdId)
          : false;
        if (encryptionInitialized) {
          toast({
            title: "Account Created & Secured!",
            description: "Your encryption vault has been set up. Your data is protected.",
          });
          navigate("/");
        } else {
          toast({
            title: "Account Created!",
            description: "Please check your email to confirm your account before logging in.",
          });
        }
      } else {
        toast({
          title: "Account Created!",
          description: "Please check your email to confirm your account. Your encryption vault will be set up on first login.",
        });
      }

      // Clear form on successful signup
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setFullName("");
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    // Keep email if filled (likely the user wants to use the same one); clear passwords for hygiene.
    setPassword("");
    setConfirmPassword("");
    if (next === "login") setFullName("");
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <Card className="w-full max-w-md p-6 sm:p-8">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-7">
          <img
            src="/household-harmony-logo.svg"
            alt=""
            aria-hidden="true"
            className="w-12 h-12 mb-3"
          />
          <h1 className="text-2xl sm:text-2xl font-bold tracking-tight">Household Harmony</h1>
          <p className="text-sm text-muted mt-1.5">
            {mode === "login"
              ? "Sign in to your household"
              : "Create your account"}
          </p>
        </div>

        {/* Form */}
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder={PLACEHOLDERS.EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowRecoverDialog(true)}
                  className="text-xs font-medium text-accent-dk hover:underline focus:outline-none focus-visible:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullname">Full name <span className="text-muted font-normal">(optional)</span></Label>
              <Input
                id="fullname"
                type="text"
                placeholder="Anna Andersson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder={PLACEHOLDERS.EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        )}

        {/* Mode switcher */}
        <p className="text-sm text-center text-muted mt-6">
          {mode === "login" ? "New to Household Harmony?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="font-semibold text-accent-dk hover:underline focus:outline-none focus-visible:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>

        {/* Join household / Demo */}
        <div className="mt-6 pt-6 border-t border-line-2 space-y-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowJoinDialog(true)}
          >
            <UserPlus className="h-4 w-4" />
            Join with invite code
          </Button>

          {DEMO_ENABLED && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleTryDemo}
              disabled={demoLoading}
            >
              {demoLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {demoLoadingMessage || "Starting..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Try demo
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      <JoinHouseholdWizard open={showJoinDialog} onOpenChange={setShowJoinDialog} />

      <RecoverPasswordDialog
        open={showRecoverDialog}
        onOpenChange={setShowRecoverDialog}
        defaultEmail={email}
        onRecovered={async (recoveredEmail, newPassword) => {
          setIsLoading(true);
          try {
            const { error, data } = await signIn(recoveredEmail, newPassword);
            if (error || !data?.user) {
              toast({ title: "Sign-in failed", description: error?.message ?? "Try logging in manually.", variant: "destructive" });
              return;
            }
            const unlocked = await unlockWithPassword(newPassword, data.user.id);
            if (!unlocked) {
              console.warn("Vault unlock failed after recovery — user may need to re-enter credentials");
            }
            navigate("/");
          } finally {
            setIsLoading(false);
          }
        }}
      />
    </div>
  );
};

export default Auth;
