import type { AuthSession } from "@/modules/session";

export const LOGIN_USERNAME_MAX_LENGTH = 64;

export type LoginCredentials = {
  username: string;
  password: string;
};

export type LoginErrors = {
  username?: string;
  password?: string;
};

export type LoginSuccessResponse = {
  success: true;
  data: {
    session: AuthSession;
  };
};

export type LoginErrorResponse = {
  success: false;
  message: string;
  errors?: LoginErrors;
};

export type LoginApiResponse = LoginSuccessResponse | LoginErrorResponse;

export type { AuthSession } from "@/modules/session";
