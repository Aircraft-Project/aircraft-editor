import { fireEvent, render, screen } from "@testing-library/react";

import { AircraftLoadingOverlay } from "./AircraftLoadingOverlay";

describe("AircraftLoadingOverlay", () => {
  it("does not render when closed", () => {
    render(<AircraftLoadingOverlay open={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders custom accessible status content when open", () => {
    render(
      <AircraftLoadingOverlay
        open
        title="Iniciando sesión..."
        description="Preparando tu espacio de trabajo."
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Iniciando sesión...",
    });
    const status = screen.getByRole("status");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Iniciando sesión...");
    expect(status).toHaveTextContent("Preparando tu espacio de trabajo.");
    expect(dialog.querySelector('img[src*="aircraft-mark.svg"]')).toBeInTheDocument();
  });

  it("uses the default messages", () => {
    render(<AircraftLoadingOverlay open />);

    expect(screen.getByText("Procesando...")).toBeInTheDocument();
    expect(screen.getByText("Por favor espera un momento.")).toBeInTheDocument();
  });

  it("cannot be dismissed with Escape and restores previous focus on close", () => {
    const { rerender } = render(
      <>
        <button type="button">Acción previa</button>
        <AircraftLoadingOverlay open={false} />
      </>,
    );
    const previousAction = screen.getByRole("button", { name: "Acción previa" });
    previousAction.focus();

    rerender(
      <>
        <button type="button">Acción previa</button>
        <AircraftLoadingOverlay open />
      </>,
    );

    const dialog = screen.getByRole("dialog");
    const cancelEvent = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog, cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog).toBeInTheDocument();

    rerender(
      <>
        <button type="button">Acción previa</button>
        <AircraftLoadingOverlay open={false} />
      </>,
    );

    expect(previousAction).toHaveFocus();
  });
});
