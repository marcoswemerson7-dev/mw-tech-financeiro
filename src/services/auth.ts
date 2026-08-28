import { account } from "../lib/appwrite";

export const authService = {
  login: (email: string, password: string) =>
    account.createEmailPasswordSession({ email, password }),
  current: () => account.get(),
  logout: () => account.deleteSession({ sessionId: "current" }),
};
