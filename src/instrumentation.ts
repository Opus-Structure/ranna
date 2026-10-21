/**
 * Server request errors. Production Next.js hides the message from the browser (digest only), and
 * the shared host does not surface the app's stderr, so on the cPanel deploy the failure is also
 * appended to a file the owner can read (`<app>/tmp/app-errors.log`, override with APP_ERROR_LOG).
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { appendFile, mkdir, stat, truncate } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
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
