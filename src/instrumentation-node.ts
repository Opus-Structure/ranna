import { appendFile, mkdir, stat, truncate } from "node:fs/promises";
import { dirname, join } from "node:path";

type RequestInfo = { path: string; method: string };
type ErrorContext = { routerKind: string; routePath: string; routeType: string };

/** Appends one JSON line per server error to `<app>/tmp/app-errors.log` (override: APP_ERROR_LOG). */
export async function logRequestError(error: unknown, request: RequestInfo, context: ErrorContext) {
  const file = process.env.APP_ERROR_LOG ?? join(process.cwd(), "tmp", "app-errors.log");
  const err = error as { message?: string; stack?: string; digest?: string };
  const line = JSON.stringify({
    at: new Date().toISOString(),
    method: request.method,
    path: request.path,
    route: context.routePath,
    type: context.routeType,
    digest: err.digest,
    message: err.message,
    stack: err.stack?.split("\n").slice(0, 12).join("\n"),
  });
  try {
    await mkdir(dirname(file), { recursive: true });
    // Keep the file small: start over once it passes 1 MB.
    const size = await stat(file).then(
      (s) => s.size,
      () => 0,
    );
    if (size > 1_000_000) await truncate(file, 0);
    await appendFile(file, `${line}\n`);
  } catch {
    // Logging must never break the request.
  }
  console.error(line);
}
