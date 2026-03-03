import { defineConfig } from 'vite';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default defineConfig({
  server: {
    host: true,
    port: 4174,
    strictPort: true,
    cors: true,
    headers: corsHeaders,
  },
  preview: {
    host: true,
    port: 4174,
    strictPort: true,
    cors: true,
    headers: corsHeaders,
  },
});
