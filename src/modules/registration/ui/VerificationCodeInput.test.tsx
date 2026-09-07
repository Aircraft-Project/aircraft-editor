import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VerificationCodeInput } from "./VerificationCodeInput";

describe("VerificationCodeInput", () => {
  it("accepts digits, advances focus, supports paste and backspace", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(<VerificationCodeInput value="" onChange={onChange} />);
    const first = screen.getByLabelText("Dígito 1");

    await user.type(first, "1");
    expect(onChange).toHaveBeenLastCalledWith("1");
    rerender(<VerificationCodeInput value="1" onChange={onChange} />);

    await user.click(first);
    await user.paste("123456");
    expect(onChange).toHaveBeenLastCalledWith("123456");
    rerender(<VerificationCodeInput value="123456" onChange={onChange} error="Código incorrecto" />);

    const last = screen.getByLabelText("Dígito 6");
    last.focus();
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith("12345");
    expect(screen.getByRole("alert")).toHaveTextContent("Código incorrecto");
  });

  it("ignores non-numeric input and exposes disabled state", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<VerificationCodeInput value="" onChange={onChange} disabled />);
    expect(screen.getByLabelText("Dígito 1")).toBeDisabled();
    await user.click(screen.getByLabelText("Dígito 1"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
