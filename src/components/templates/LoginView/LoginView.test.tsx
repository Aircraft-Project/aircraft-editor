import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthSession } from "@/modules/auth/types";
import { AuthServiceError, type AuthService } from "@/services/auth";
import { LoginView } from "./LoginView";

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("LoginView", () => {
  beforeEach(() => {
    replace.mockClear();
    window.sessionStorage.clear();
  });

  it("shows field validation errors for an empty submit", async () => {
    const user = userEvent.setup();
    const service: AuthService = { login: jest.fn() };

    render(<LoginView service={service} />);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByText("El usuario es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La contraseña es obligatoria.")).toBeInTheDocument();
    expect(service.login).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    const service: AuthService = { login: jest.fn() };

    render(<LoginView service={service} />);
    const passwordInput = screen.getByLabelText("Contraseña");

    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("disables submit while authenticating and redirects after success", async () => {
    const user = userEvent.setup();
    let resolveLogin: ((session: AuthSession) => void) | undefined;
    const service: AuthService = {
      login: jest.fn(
        () =>
          new Promise<AuthSession>((resolve) => {
            resolveLogin = resolve;
          }),
      ),
    };

    render(<LoginView service={service} />);

    await user.type(screen.getByLabelText("Usuario"), " admin ");
    await user.type(screen.getByLabelText("Contraseña"), "admin");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("button", { name: "Iniciando sesión..." })).toBeDisabled();
    expect(service.login).toHaveBeenCalledWith({ username: "admin", password: "admin" });

    await act(async () => {
      resolveLogin?.({ username: "admin", displayName: "Administrador" });
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/projects"));
    expect(window.sessionStorage.getItem("aircraft.auth.session")).not.toContain("password");
  });

  it("submits with Enter and renders authentication errors without alerts", async () => {
    const user = userEvent.setup();
    const service: AuthService = {
      login: jest.fn(async () => {
        throw new AuthServiceError(
          "Usuario o contraseña incorrectos.",
          "INVALID_CREDENTIALS",
          401,
        );
      }),
    };

    render(<LoginView service={service} />);

    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "incorrecta{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuario o contraseña incorrectos.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("exposes the future registration callback without navigating to a missing route", async () => {
    const user = userEvent.setup();
    const service: AuthService = { login: jest.fn() };
    const onCreateAccount = jest.fn();

    render(<LoginView service={service} onCreateAccount={onCreateAccount} />);
    await user.click(screen.getByRole("button", { name: "Creá tu cuenta." }));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
