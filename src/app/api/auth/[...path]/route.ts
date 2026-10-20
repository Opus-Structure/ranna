import { neonAuth } from "@/lib/auth/server";

/** Proxy to Managed Better Auth: the browser talks to this origin, so cookies stay first-party. */
type Ctx = { params: Promise<{ path: string[] }> };
const handlers = () => neonAuth().handler();

export const GET = (request: Request, ctx: Ctx) => handlers().GET(request, ctx);
export const POST = (request: Request, ctx: Ctx) => handlers().POST(request, ctx);
