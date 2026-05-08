import { ReactNode } from "react";
import MobileNav from "./MobileNav";
import DesktopNav from "./DesktopNav";
import { DemoBanner } from "./shared/DemoBanner";
import { GuidedTour } from "./shared/GuidedTour";
import { OutageBanner } from "./shared/OutageBanner";
import { DevTimeTravel } from "./dev/DevTimeTravel";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
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
      <DevTimeTravel />
    </div>
  );
};

export default Layout;