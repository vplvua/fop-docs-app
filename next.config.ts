import type { NextConfig } from "next";

// Allow the in-app DubiDoc signing modal to embed the provider's signing page
// in an iframe. Only `frame-src` is set (no `default-src`), so no other resource
// type is restricted. Domain covers `api.` and `my.` subdomains; the exact sign
// host is confirmed by the integration spike (see change add-dubidoc-in-app-signing).
const DUBIDOC_CSP = "frame-src 'self' https://*.dubidoc.com.ua https://dubidoc.com.ua";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: DUBIDOC_CSP }],
      },
    ];
  },
};

export default nextConfig;
