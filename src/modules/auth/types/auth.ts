export const LOGIN_USERNAME_MAX_LENGTH = 64;

export type LoginCredentials = {
  username: string;
  password: string;
};

export type LoginErrors = {
  username?: string;
  password?: string;
};

export type AuthSession = {
  username: string;
  displayName: string;
};

export type LoginSuccessResponse = {
  success: true;
  user: AuthSession;
};

export type LoginErrorResponse = {
  success: false;
  message: string;
  errors?: LoginErrors;
};

export type LoginApiResponse = LoginSuccessResponse | LoginErrorResponse;
