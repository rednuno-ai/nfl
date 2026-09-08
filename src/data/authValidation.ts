/**
 * Browser-side registration guidance. The Worker repeats these rules as the
 * authority, so a client can never bypass account validation by editing the
 * page or calling the API directly.
 */
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 31;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,30}$/;

export interface RegistrationValidation {
  username: string | null;
  password: string | null;
  valid: boolean;
}

export function validateRegistrationInput(usernameRaw: string, password: string, reservedUsername?: string): RegistrationValidation {
  const username = usernameRaw.trim().toLowerCase();
  let usernameError: string | null = null;
  let passwordError: string | null = null;

  if (!username) usernameError = "Enter a username.";
  else if (username === reservedUsername) usernameError = "This username is reserved for the public demo. Choose another one.";
  else if (!USERNAME_PATTERN.test(username)) usernameError = "Use 2–31 lowercase letters, numbers, underscores or hyphens. Start with a letter or number.";

  if (!password) passwordError = "Enter a password.";
  else if (password.length < PASSWORD_MIN_LENGTH) passwordError = `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`;
  else if (password.length > PASSWORD_MAX_LENGTH) passwordError = `Use no more than ${PASSWORD_MAX_LENGTH} characters for your password.`;

  return { username: usernameError, password: passwordError, valid: !usernameError && !passwordError };
}
