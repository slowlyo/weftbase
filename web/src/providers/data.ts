import type { BaseRecord, DataProvider, GetManyParams } from "@refinedev/core";
import PocketBase from "pocketbase";
import { dataProvider as createPocketBaseDataProvider } from "refine-pocketbase";

const configuredURL = import.meta.env.VITE_POCKETBASE_URL;

export const pb = new PocketBase(configuredURL || window.location.origin);

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
