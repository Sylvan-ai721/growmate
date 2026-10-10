export async function requestJson<T>(baseUrl: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = path === "/api/script/generate" ? 900_000 : 240_000;
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(response.status === 502 || response.status === 504
        ? "后端暂时不可用或生成超时，请稍后重试。"
        : "接口返回格式异常，请检查后端服务和 /api 路由配置。");
    }
    const data = await response.json();
    if (!response.ok) {
      const detail = data.detail;
      throw new Error(typeof detail === "string" ? detail : Array.isArray(detail)
        ? "输入不符合要求，请检查回答、时长和数据是否完整。" : "请求失败，请稍后重试。");
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("本次请求已取消，请重新生成。");
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("生成超时，请重试；长视频需要更长时间，也可以先尝试较短时长。");
    }
    if (error instanceof TypeError) {
      throw new Error("无法连接后端，请确认后端服务已启动。");
    }
    throw error;
  }
}
