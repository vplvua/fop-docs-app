import { TopBar } from "../components/top-bar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
