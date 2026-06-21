/** @type {import('next').NextConfig} */
const nextConfig = {
    // @napi-rs/canvas ships a native .node binding that can't be bundled — keep it
    // external so it's loaded at runtime (required for server-side ticket rendering).
    serverExternalPackages: ['@napi-rs/canvas'],
    // Ship the bundled ticket fonts into the serverless function so server-side
    // ticket rendering can register them (Vercel has no system fonts).
    outputFileTracingIncludes: {
        '/api/emails/send': ['./src/lib/fonts/**'],
    },
};

export default nextConfig;
