import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export const metadata = {
  title: "Вхід · ФОП Документи",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  return (
    <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <header className="mb-6 text-center">
        <h1 className="text-heading-2 text-foreground">Вхід</h1>
        <p className="mt-2 text-sm text-muted-foreground">Доступ лише для адміністратора.</p>
      </header>
      <LoginForm next={next} />
    </section>
  );
}
