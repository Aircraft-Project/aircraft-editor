import { fireEvent, render, screen } from "@testing-library/react";
import { Topbar } from "./Topbar";

const requiredProps = {
  projectName: "Aircraft project",
  devicePresetId: "iphone-15",
  zoom: 100,
  onDeviceChange: jest.fn(),
  onZoomChange: jest.fn(),
  onPreview: jest.fn(),
};

describe("Topbar save controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not present local save controls when no local persistence is configured", () => {
    render(<Topbar {...requiredProps} />);

    expect(
      screen.queryByRole("button", { name: "Guardar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Guardado")).not.toBeInTheDocument();
  });

  it("presents functional save controls for a local project", () => {
    const onSave = jest.fn();
    render(
      <Topbar
        {...requiredProps}
        saveState="DIRTY"
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
