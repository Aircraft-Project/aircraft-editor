import {
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserMenu } from "./UserMenu";

const userCases = [
  {
    role: "ADMIN",
    displayName: "Ada Admin",
    roleLabel: "Administrador",
    initials: "AA",
  },
  {
    role: "DEVELOPER",
    displayName: "Dev User",
    roleLabel: "Desarrollador",
    initials: "DU",
  },
] as const;

describe.each(userCases)(
  "UserMenu for $role",
  ({ displayName, roleLabel, initials }) => {
    const renderMenu = (onLogout = jest.fn()) => {
      render(
        <UserMenu
          displayName={displayName}
          roleLabel={roleLabel}
          initials={initials}
          onLogout={onLogout}
        />,
      );

      return {
        onLogout,
        trigger: screen.getByRole("button", {
          name: `Abrir menú de usuario de ${displayName}`,
        }),
      };
    };

    it("starts closed without duplicating user data", () => {
      const { trigger } = renderMenu();

      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(screen.getAllByText(displayName)).toHaveLength(1);
      expect(screen.getAllByText(roleLabel)).toHaveLength(1);
    });

    it("opens exactly one action and toggles closed", async () => {
      const user = userEvent.setup();
      const { trigger } = renderMenu();

      await user.click(trigger);

      const menu = screen.getByRole("menu");
      const actions = within(menu).getAllByRole("menuitem");

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toHaveAccessibleName("Cerrar sesión");
      expect(within(menu).queryByText(displayName)).not.toBeInTheDocument();
      expect(within(menu).queryByText(roleLabel)).not.toBeInTheDocument();
      expect(within(menu).queryByText("Mi perfil")).not.toBeInTheDocument();
      expect(within(menu).queryByText("Mi cuenta")).not.toBeInTheDocument();
      expect(within(menu).queryByText("Configuración")).not.toBeInTheDocument();

      await user.click(trigger);

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("closes when clicking outside", async () => {
      const user = userEvent.setup();
      const { trigger } = renderMenu();

      await user.click(trigger);
      expect(screen.getByRole("menu")).toBeInTheDocument();

      await user.click(document.body);

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes with Escape and restores trigger focus", async () => {
      const user = userEvent.setup();
      const { trigger } = renderMenu();

      await user.click(trigger);
      expect(
        screen.getByRole("menuitem", { name: "Cerrar sesión" }),
      ).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it("closes and invokes the public logout callback", async () => {
      const user = userEvent.setup();
      const onLogout = jest.fn();
      const { trigger } = renderMenu(onLogout);

      await user.click(trigger);
      await user.click(
        screen.getByRole("menuitem", { name: "Cerrar sesión" }),
      );

      expect(onLogout).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  },
);
