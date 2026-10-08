import type { AuthProvider } from "@refinedev/core";
import { authProvider as createAuthProvider } from "refine-pocketbase";
import { pb } from "./data";

const LOGIN_KEY = "weftbase_login";

export type SavedLogin = {
  account: string;
  password: string;
};

const provider = createAuthProvider(pb, {
  collection: "_superusers",
  loginRedirectTo: "/",
});

const signIn = provider.login.bind(provider);
const clearSession = provider.logout.bind(provider);

// 登录成功后按勾选结果保存或清掉账号密码，供下次打开登录页回填。
const login: AuthProvider["login"] = async (params) => {
  const fields = readLoginFields(params);
  // 登录接口仍把身份放在 email 参数里，这里改成提交的账号。
  const result = await signIn(
    fields && typeof params === "object" && params !== null
      ? { ...params, email: fields.account }
      : params,
  );
  // 失败时不改已记住的账号，避免一次输错把原来的覆盖掉。
  if (!result?.success) {
    return result;
  }
  // 没带齐账号密码时无法记住。
  if (!fields) {
    return result;
  }
  // 勾选才写入；取消勾选则清掉，下次登录页留空。
  if (fields.remember) {
    localStorage.setItem(
      LOGIN_KEY,
      JSON.stringify({ account: fields.account, password: fields.password }),
    );
  } else {
    localStorage.removeItem(LOGIN_KEY);
  }
  return result;
};

// 读出上次勾选记住我时留下的账号密码。
export function readSavedLogin(): SavedLogin | null {
  const raw = localStorage.getItem(LOGIN_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SavedLogin> & { email?: string };
    const account = normalizeAccount(parsed.account || parsed.email || "");
    // 缺字段时不当作已记住，避免回填半截内容。
    if (!account || !parsed.password) {
      return null;
    }
    return { account, password: parsed.password };
  } catch {
    // 内容损坏时当作没有记住。
    return null;
  }
}

// 旧版记住的是邮箱，登录已改成账号。
function normalizeAccount(value: string): string {
  if (value === "admin@weftbase.local") {
    return "admin";
  }
  return value;
}

function readLoginFields(
  params: unknown,
): (SavedLogin & { remember: boolean }) | null {
  // 不是登录表单提交的结构。
  if (typeof params !== "object" || params === null) {
    return null;
  }
  const record = params as {
    account?: unknown;
    email?: unknown;
    password?: unknown;
    remember?: unknown;
  };
  const rawAccount =
    typeof record.account === "string"
      ? record.account
      : typeof record.email === "string"
        ? record.email
        : "";
  // 没有账号或密码不是字符串时无法登录。
  if (!rawAccount || typeof record.password !== "string") {
    return null;
  }
  return {
    account: normalizeAccount(rawAccount),
    password: record.password,
    remember: Boolean(record.remember),
  };
}

provider.login = login;

// 清掉本地登录态后立刻离开。Refine 会在 logout 返回后刷新全部活跃查询，当前列表还会再打一次接口。
const logout: AuthProvider["logout"] = async (params) => {
  await clearSession(params);
  window.location.replace("/login");
  return new Promise(() => {});
};

provider.logout = logout;

export const authProvider = provider;
