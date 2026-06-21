/** @type {import('next').NextConfig} */
const nextConfig = {
    // @napi-rs/canvas ships a native .node binding that can't be bundled — keep it
    // external so it's loaded at runtime (required for server-side ticket rendering).
    serverExternalPackages: ['@napi-rs/canvas'],
};

export default nextConfig;
