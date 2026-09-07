jest.mock("server-only", () => ({}));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

import { render, screen } from "@testing-library/react";
import { cookies } from "next/headers";
import RegisterPage from "./page";

describe("RegisterPage", () => {
  it("renders public Registration Step 1 without a prior cookie", async () => {
    jest.mocked(cookies).mockResolvedValue({
      get: jest.fn(() => undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    render(await RegisterPage());

    expect(screen.getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 2")).toBeInTheDocument();
  });
});

