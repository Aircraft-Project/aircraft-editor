import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthSession } from "@/modules/session";
import { AuthServiceError, type AuthService } from "@/modules/auth/client";
import { LoginView } from "./LoginView";

const replace = jest.fn();
const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

const adminSession: AuthSession = {
  user: {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
describe("LoginView", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

    const submittingButton = screen.getByRole("button", { name: "Iniciando sesión..." });
    expect(submittingButton).toBeDisabled();
    expect(screen.getByRole("dialog", { name: "Iniciando sesión..." })).toBeInTheDocument();
    await user.click(submittingButton);
    expect(service.login).toHaveBeenCalledWith({ username: "admin", password: "admin" });
    expect(service.login).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLogin?.(adminSession);
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/projects"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
  });

  it("supports a custom create-account callback without navigation", async () => {
    const user = userEvent.setup();
    const onCreateAccount = jest.fn();
    const service: AuthService = { login: jest.fn() };

    render(<LoginView service={service} onCreateAccount={onCreateAccount} />);
    await user.click(screen.getByRole("button", { name: "Creá tu cuenta." }));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates directly to public registration and shows the completion message", async () => {
    const user = userEvent.setup();
    const service: AuthService = { login: jest.fn() };

    render(<LoginView service={service} registrationSucceeded />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cuenta creada correctamente. Ya puedes iniciar sesión.",
    );

    await user.click(screen.getByRole("button", { name: "Creá tu cuenta." }));

    expect(push).toHaveBeenCalledWith("/register");
    expect(screen.queryByText(/No fue posible iniciar el registro/)).not.toBeInTheDocument();
  });

  it("closes the overlay and preserves the existing error UI after a failed login", async () => {
    const user = userEvent.setup();
    const request = deferred<AuthSession>();
    const service: AuthService = {
      login: jest.fn(() => request.promise),
    };

    render(<LoginView service={service} />);
    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("dialog", { name: "Iniciando sesión..." })).toBeInTheDocument();

    await act(async () => {
      request.reject(
        new AuthServiceError(
          "Usuario o contraseña incorrectos.",
          "INVALID_CREDENTIALS",
          401,
        ),
      );
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuario o contraseña incorrectos.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });});
