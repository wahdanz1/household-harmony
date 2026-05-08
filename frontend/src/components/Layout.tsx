import { ReactNode } from "react";
import MobileNav from "./MobileNav";
import DesktopNav from "./DesktopNav";
import { DemoBanner } from "./shared/DemoBanner";
import { GuidedTour } from "./shared/GuidedTour";
import { DevTimeTravel } from "./dev/DevTimeTravel";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen relative">
      <div className="gradient-background" />
      <DesktopNav />
      <main className="pb-20 md:pb-8 md:pl-64 relative z-10">
        <div className="container max-w-6xl mx-auto px-3 md:px-4 py-4">
          <DemoBanner />
          {children}
        </div>
      </main>
      <MobileNav />
      <GuidedTour />
      <DevTimeTravel />
    </div>
  );
};

export default Layout;