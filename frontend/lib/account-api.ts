export type Account = { id: string; name: string; email: string };

export async function accountApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method, credentials: "include", cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("账户服务不可用，请检查后端服务。");
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "请检查邮箱、密码和输入内容。");
  return data;
}
