import { Toaster } from "sonner";

import { TopBar } from "../components/top-bar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      {/* Per-type colours are themed in globals.css via [data-sonner-toast][data-type=…]. */}
      <Toaster position="bottom-right" />
    </div>
  );
}
