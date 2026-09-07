import { LoginView } from "@/components/templates";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginView registrationSucceeded={params.registered === "1"} />;
}
