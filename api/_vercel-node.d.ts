// Minimal structural types for the `@vercel/node` request/response, matching
// what Vercel's runtime provides in production. The real package is not a
// devDependency (it would pull in its own TypeScript + esbuild toolchain just
// for two types), so this ambient declaration keeps `tsc -p api/tsconfig.json`
// self-contained. Only the members similoo's functions touch are declared.
declare module '@vercel/node' {
  export interface VercelRequest {
    method?: string;
    query: Partial<Record<string, string | string[]>>;
    body: unknown;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface VercelResponse {
    setHeader(name: string, value: string | number | readonly string[]): VercelResponse;
    status(code: number): VercelResponse;
    json(body: unknown): VercelResponse;
    send(body: unknown): VercelResponse;
    end(): VercelResponse;
  }
}
