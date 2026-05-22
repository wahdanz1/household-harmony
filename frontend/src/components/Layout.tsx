import { ReactNode, useEffect } from "react";
import MobileNav from "./MobileNav";
import DesktopNav from "./DesktopNav";
import { DemoBanner } from "./shared/DemoBanner";
import { GuidedTour } from "./shared/GuidedTour";
import { OutageBanner } from "./shared/OutageBanner";
import { DevTools } from "./dev/DevTools";
import { RecoveryCodeGate } from "./auth/RecoveryCodeGate";
import { MultiHouseholdExitDialog } from "./auth/MultiHouseholdExitDialog";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      document.documentElement.style.setProperty("--vv-inset", `${inset}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="min-h-screen relative bg-bg">
      <DesktopNav />
      <main className="pb-20 md:pb-8 md:pl-64 relative z-10">
        <div className="container max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-5 md:py-8">
          <DemoBanner />
          {children}
        </div>
      </main>
      <MobileNav />
      <GuidedTour />
      <OutageBanner />
      <DevTools />
      <RecoveryCodeGate />
      <MultiHouseholdExitDialog />
    </div>
  );
};

export default Layout;