import { TopBar } from "../components/top-bar";

export default function QueueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
