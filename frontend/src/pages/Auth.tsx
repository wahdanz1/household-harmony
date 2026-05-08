import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useToast } from "@/hooks/use-toast";
import { JoinHouseholdWizard } from "@/components/JoinHouseholdWizard";
import { UserPlus, Lock, Shield, Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";
import { PLACEHOLDERS } from "@/constants/ui";
import { isEmailAllowed } from "@/config/emailWhitelist";
import { setDemoMode } from "@/utils/demoMode";

// Feature flag: demo mode is hidden until the monthly review flow is rebuilt
const DEMO_ENABLED = false;

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Strong password requirements for new accounts (encryption security)
const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters for encryption security")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");

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
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoLoadingMessage, setDemoLoadingMessage] = useState("");

  const { signIn, signUp, user } = useAuth();
  const { unlockWithPassword, initializeEncryption, isLoading: encryptionLoading } = useEncryption();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle demo mode creation with progressive loading states
  const handleTryDemo = async () => {
    setDemoLoading(true);
    const startTime = Date.now();

    // Start with "Waking up" message - will be replaced if response is fast
    const wakingTimeout = setTimeout(() => {
      setDemoLoadingMessage("Waking up backend...");
    }, 500); // Small delay before showing first message

    try {
      // Call backend to create demo user
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/demo/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(wakingTimeout);
      const elapsed = Date.now() - startTime;

      // If response was fast (<5s), user didn't see "Waking up" long
      // If slow (>5s), they've been waiting - acknowledge progress
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

      // Auto-login with demo credentials
      const { error: signInError, data } = await signIn(email, password);

      if (signInError) {
        throw new Error(signInError.message);
      }

      setDemoLoadingMessage("Unlocking encrypted vault...");

      // Unlock vault using REAL encryption flow (backend created encrypted vault)
      const vaultUnlocked = await unlockWithPassword(password, user_id);
      if (!vaultUnlocked) {
        console.warn("Demo vault unlock failed - may not have encrypted data yet");
      }

      // Set demo mode flag and store password for auto-unlock on refresh
      setDemoMode(true);
      sessionStorage.setItem('demo_password', password); // For auto-unlock
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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // Check for email confirmation success
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=signup') || hash.includes('type=email')) {
      toast({
        title: "Email Confirmed!",
        description: "Your account has been confirmed. You can now log in.",
      });
      // Clear the hash
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Sign in with Supabase
      const { error, data } = await signIn(loginEmail, loginPassword);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Login Failed",
            description: "Invalid email or password. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data?.user) {
        // Clear any demo mode flags on normal login
        localStorage.removeItem('is_demo_mode');
        localStorage.removeItem('demo_tour_active');
        localStorage.removeItem('demo_banner_dismissed');

        // Unlock encryption vault with the same password
        const vaultUnlocked = await unlockWithPassword(loginPassword, data.user.id);

        if (!vaultUnlocked) {
          console.warn("Failed to unlock encryption vault - user may have legacy unencrypted data");
          // Don't block login, just warn - vault will be initialized later if needed
        }

        toast({
          title: "Welcome back!",
          description: vaultUnlocked ? "Vault unlocked. Your data is protected." : "You've successfully logged in.",
        });
        navigate("/");
      }
    } catch (error: any) {
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
      const validation = signupSchema.safeParse({
        email: signupEmail,
        password: signupPassword,
        confirmPassword: signupConfirm,
        fullName: signupFullName,
      });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check email whitelist
      const isAllowed = await isEmailAllowed(signupEmail);
      if (!isAllowed) {
        toast({
          title: "Access Restricted",
          description: "This application is currently in private beta. Your email is not on the approved list.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error, data } = await signUp(signupEmail, signupPassword, signupFullName);

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Account Exists",
            description: "An account with this email already exists. Please login instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Signup Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        // If user was auto-signed in (no email confirmation required), initialize encryption
        if (data?.user) {
          const encryptionInitialized = await initializeEncryption(signupPassword, data.user.id);
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
        // Clear form
        setSignupEmail("");
        setSignupPassword("");
        setSignupConfirm("");
        setSignupFullName("");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Household Harmony</CardTitle>
          <CardDescription>Plan and manage all your household finances, together!</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList>
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={PLACEHOLDERS.EMAIL}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-fullname">Full Name (Optional)</Label>
                  <Input
                    id="signup-fullname"
                    type="text"
                    placeholder="John Doe"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder={PLACEHOLDERS.EMAIL}
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            {/* Join Existing Household - part of actual app flow */}
            <Separator className="my-4" />
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Already have an invite code?
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowJoinDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Join Existing Household
              </Button>
            </div>

            {/* Demo Mode - temporarily disabled while monthly review flow is being rebuilt */}
            {DEMO_ENABLED && (
              <>
                <div className="relative mt-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={handleTryDemo}
                  disabled={demoLoading}
                >
                  {demoLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {demoLoadingMessage || "Starting..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Try Demo
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-2">
                  No signup needed. Backend on free tier - first load may take ~20s
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <JoinHouseholdWizard open={showJoinDialog} onOpenChange={setShowJoinDialog} />
    </div>
  );
};

export default Auth;