import type { BaseRecord, DataProvider, GetManyParams } from "@refinedev/core";
import PocketBase, { isTokenExpired } from "pocketbase";
import { dataProvider as createPocketBaseDataProvider } from "refine-pocketbase";

// 之前未勾选记住我会把令牌放进 sessionStorage。登录态改回只走 localStorage，关掉标签不再退出。
const sessionAuth = sessionStorage.getItem("pocketbase_auth");
if (sessionAuth) {
  // 已经有长期登录态时不覆盖，只丢掉标签里的那份。
  if (!localStorage.getItem("pocketbase_auth")) {
    localStorage.setItem("pocketbase_auth", sessionAuth);
  }
  sessionStorage.removeItem("pocketbase_auth");
}

const configuredURL = import.meta.env.VITE_POCKETBASE_URL;

export const pb = new PocketBase(configuredURL || window.location.origin);

let hidingEmail = false;

// 认证集合必须保留 email，但界面和本地登录态都不展示它。
function hideEmailField(): void {
  if (hidingEmail) {
    return;
  }
  const record = pb.authStore.record;
  // 未登录，或这份记录里已经没有邮箱。
  if (!record || !("email" in record)) {
    return;
  }
  const { email: _email, ...rest } = record;
  hidingEmail = true;
  pb.authStore.save(pb.authStore.token, rest);
  hidingEmail = false;
}

pb.authStore.onChange(() => {
  hideEmailField();
});
hideEmailField();

// 超级用户 token 只有 1 天。剩余不到 30 分钟时先换发，过期后服务端不再接受刷新。
const REFRESH_AHEAD_SECONDS = 30 * 60;

let refreshTask: Promise<void> | null = null;

// 并发请求共用一次换发，避免同时打出多条 auth-refresh。
function refreshAuthIfNeeded(): Promise<void> {
  // 还没登录，或离过期还早，直接用当前令牌。
  if (!pb.authStore.isValid || !isTokenExpired(pb.authStore.token, REFRESH_AHEAD_SECONDS)) {
    return Promise.resolve();
  }
  // 已经有换发在进行时，后面的请求等同一次结果。
  if (!refreshTask) {
    refreshTask = pb
      .collection("_superusers")
      .authRefresh()
      .then(() => undefined)
      .catch(() => {
        // 换发失败时继续用当前令牌，避免还没过期的请求被拦住。
        return undefined;
      })
      .finally(() => {
        refreshTask = null;
      });
  }
  return refreshTask;
}

// 换发发生在请求头写好之后，这里把旧令牌换成新的。
function replaceAuthorization(
  headers: Record<string, string> | undefined,
  previous: string,
  current: string,
): Record<string, string> | undefined {
  // 没有旧令牌，或换发没改掉令牌时，请求头保持原样。
  if (!headers || !previous || previous === current) {
    return headers;
  }
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    // 只替换和换发前相同的 Authorization，避免改掉调用方自己带的头。
    if (key.toLowerCase() === "authorization" && next[key] === previous) {
      next[key] = current;
    }
  }
  return next;
}

// 每次请求前检查令牌。页面刷新后仍然有效，不依赖登录那一次的内存状态。
pb.beforeSend = async (url, options) => {
  // 登录和换发自己的请求再进来会循环。
  if (url.includes("/auth-refresh") || url.includes("/auth-with-password")) {
    return { url, options };
  }
  const previous = pb.authStore.token;
  await refreshAuthIfNeeded();
  return {
    url,
    options: {
      ...options,
      headers: replaceAuthorization(options.headers, previous, pb.authStore.token),
    },
  };
};

// Refine 会并发请求同一集合，SDK 默认取消前一条，列表会偶发失败。
pb.autoCancellation(false);

const pocketBaseDataProvider = createPocketBaseDataProvider(pb);

// getMany 用一次 in 查询补齐。官方示例列表会批量取分类，refine-pocketbase 没有这个方法。
export const dataProvider: DataProvider = {
  ...pocketBaseDataProvider,
  getMany: async <TData extends BaseRecord = BaseRecord>({
    resource,
    ids,
    meta,
  }: GetManyParams) => {
    // 空 id 不再打接口，避免 PocketBase 收到空 in 条件。
    if (ids.length === 0) {
      return { data: [] as TData[] };
    }

    const result = await pocketBaseDataProvider.getList<TData>({
      resource,
      pagination: { mode: "off" },
      filters: [{ field: "id", operator: "in", value: ids }],
      meta,
    });

    return { data: result.data };
  },
};
