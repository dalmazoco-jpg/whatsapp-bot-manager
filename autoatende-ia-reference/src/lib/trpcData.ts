export function unwrapTrpcData<T>(value: unknown): T | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first !== "object") return value as T | undefined;

  const result = (first as any).result;
  if (result && typeof result === "object") {
    const data = result.data;
    if (data && typeof data === "object" && "json" in data) return data.json as T;
    return data as T;
  }

  const data = (first as any).data;
  if (data && typeof data === "object" && "json" in data) return data.json as T;

  return value as T;
}

export function unwrapTrpcArray<T>(value: unknown): T[] {
  const unwrapped = unwrapTrpcData<unknown>(value);
  return Array.isArray(unwrapped) ? (unwrapped as T[]) : [];
}
