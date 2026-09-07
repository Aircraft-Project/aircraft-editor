import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RegistrationServiceError, type RegistrationService } from "../client";
import { RegistrationView } from "./RegistrationView";

const replace = jest.fn();
const mockRouter = { replace };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const contacts = { emailMasked: "ad***@example.com", phoneMasked: "+57 300 *** 4567" };

function createService(overrides: Partial<RegistrationService> = {}): RegistrationService {
  return {
    checkUsername: jest.fn(async (username) => ({ username, available: true })),
    startRegistration: jest.fn(async () => ({ registrationId: "reg-1", status: "PENDING_VERIFICATION" as const, contacts })),
    getStatus: jest.fn(async () => ({ stage: "DETAILS" as const })),
    sendVerificationCode: jest.fn(async ({ channel }) => ({ channel, maskedDestination: channel === "EMAIL" ? contacts.emailMasked : contacts.phoneMasked, expiresInSeconds: 300, resendAvailableInSeconds: 60, debugCode: "123456" })),
    verifyCode: jest.fn(async () => ({ user: { id: "usr-1", username: "ada.dev", displayName: "Ada Lovelace", initials: "AL", role: "DEVELOPER" as const } })),
    cancel: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function fillValidDetails(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText("Ingresa tu nombre"), "Ada");
  await user.type(screen.getByPlaceholderText("Ingresa tu apellido"), "Lovelace");
  await user.type(screen.getByLabelText(/^Correo electrónico/), "ada@example.com");
  await user.type(screen.getByLabelText(/^Número telefónico/), "+573001234567");
  fireEvent.change(screen.getByLabelText(/^Fecha de nacimiento/), { target: { value: "1990-12-10" } });
  await user.type(screen.getByLabelText(/^Nombre de usuario/), "ada.dev");
  await user.type(screen.getByPlaceholderText("Crea una contraseña"), "Secure#123");
  await user.type(screen.getByLabelText(/^Confirmar contraseña/), "Secure#123");
  await user.click(screen.getByText(/Acepto los/));
}

describe("RegistrationView", () => {
  beforeEach(() => replace.mockClear());

  it("shows public Step 1, creates pending state without OTP, then verifies after EMAIL selection", async () => {
    const user = userEvent.setup();
    const service = createService();
    render(<RegistrationView service={service} initialStatus={{ stage: "DETAILS" }} />);

    expect(screen.getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();

    await fillValidDetails(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Verifica tu cuenta" })).toBeInTheDocument();
    expect(service.startRegistration).toHaveBeenCalledWith(expect.objectContaining({ username: "ada.dev", password: "Secure#123" }));
    expect(service.sendVerificationCode).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Código de verificación" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Correo electrónico/ }));
    await waitFor(() => expect(service.sendVerificationCode).toHaveBeenCalledWith({ registrationId: "reg-1", channel: "EMAIL" }));
    expect(await screen.findByText(/Código de desarrollo:/)).toHaveTextContent("123456");

    await user.click(screen.getByLabelText("Dígito 1"));
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Verificar cuenta" }));

    await waitFor(() => expect(service.verifyCode).toHaveBeenCalledWith({ registrationId: "reg-1", channel: "EMAIL", code: "123456" }));
    expect(replace).toHaveBeenCalledWith("/?registered=1");
  });

  it("sends OTP through SMS only after the user explicitly selects SMS", async () => {
    const user = userEvent.setup();
    const service = createService();
    render(<RegistrationView service={service} initialStatus={{ stage: "DETAILS" }} />);
    await fillValidDetails(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("radio", { name: /Mensaje de texto/ })).not.toBeChecked();
    expect(service.sendVerificationCode).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: /Mensaje de texto/ }));
    await waitFor(() => expect(service.sendVerificationCode).toHaveBeenCalledWith({ registrationId: "reg-1", channel: "SMS" }));
  });

  it("shows the exact existing-username error without creating pending state", async () => {
    const user = userEvent.setup();
    const service = createService({
      checkUsername: jest.fn(async (username) => ({ username, available: false })),
    });
    render(<RegistrationView service={service} initialStatus={{ stage: "DETAILS" }} />);

    await user.type(screen.getByLabelText(/^Nombre de usuario/), "admin");
    await user.tab();

    expect(await screen.findByText("El nombre de usuario ya existe.")).toBeInTheDocument();
    expect(service.startRegistration).not.toHaveBeenCalled();
  });

  it("restores Step 2 from pending status and cancels it before returning to Step 1", async () => {
    const user = userEvent.setup();
    const service = createService();
    render(
      <RegistrationView
        service={service}
        initialStatus={{
          stage: "VERIFICATION",
          registrationId: "reg-1",
          contacts,
          selectedChannel: "EMAIL",
          resendAvailableInSeconds: 0,
          codeExpiresInSeconds: 250,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Verifica tu cuenta" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Volver al paso anterior/ }));

    await waitFor(() => expect(service.cancel).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Crea una contraseña")).toHaveValue("");
    expect(screen.getByLabelText(/^Confirmar contraseña/)).toHaveValue("");
  });

  it("keeps client and server on Step 2 when cancellation fails", async () => {
    const user = userEvent.setup();
    const service = createService({
      cancel: jest.fn(async () => {
        throw new RegistrationServiceError("No fue posible cancelar el registro.", "NETWORK_ERROR");
      }),
    });
    render(
      <RegistrationView
        service={service}
        initialStatus={{
          stage: "VERIFICATION",
          registrationId: "reg-1",
          contacts,
          resendAvailableInSeconds: 0,
          codeExpiresInSeconds: 0,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Volver al paso anterior/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cancelar el registro.");
    expect(screen.getByRole("heading", { name: "Verifica tu cuenta" })).toBeInTheDocument();
  });
});
