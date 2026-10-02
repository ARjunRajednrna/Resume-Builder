import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    'pdf-parse',
    'pdfjs-dist',
    'canvas',
    '@napi-rs/canvas',
    '@react-pdf/renderer',
  ],
};

export default nextConfig;
