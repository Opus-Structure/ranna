/**
 * Server request errors. Production Next.js hides the message from the browser (digest only), and
 * the shared host does not surface the app's stderr, so on the cPanel deploy the failure is also
 * appended to a file the owner can read (see instrumentation-node.ts).
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logRequestError } = await import("./instrumentation-node");
    await logRequestError(error, request, context);
  }
}
