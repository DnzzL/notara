import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const posthogHost = env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";
	const posthogAssetsHost = posthogHost.replace(
		"i.posthog.com",
		"assets.i.posthog.com",
	);

	return {
		plugins: [
			tailwindcss(),
			react(),
			VitePWA({
				registerType: "autoUpdate",
				devOptions: {
					enabled: true,
				},
				includeAssets: [
					"favicon.svg",
					"favicon.png",
					"favicon.ico",
					"icon-512.svg",
					"pwa-64x64.png",
					"apple-touch-icon-180x180.png",
				],
				manifest: {
					name: "Notara",
					short_name: "Notara",
					description:
						"Your second brain — pages, databases, and rich documents.",
					theme_color: "#ffffff",
					background_color: "#ffffff",
					display: "standalone",
					display_override: [
						"window-controls-overlay",
						"minimal-ui",
						"standalone",
					],
					start_url: "/",
					scope: "/",
					categories: ["productivity", "notes"],
					icons: [
						{
							src: "pwa-64x64.png",
							sizes: "64x64",
							type: "image/png",
						},
						{
							src: "pwa-192x192.png",
							sizes: "192x192",
							type: "image/png",
						},
						{
							src: "pwa-512x512.png",
							sizes: "512x512",
							type: "image/png",
						},
						{
							src: "maskable-icon-512x512.png",
							sizes: "512x512",
							type: "image/png",
							purpose: "maskable",
						},
					],
				},
				workbox: {
					globPatterns: ["**/*.{js,css,html,woff2,woff,ttf,svg,png,ico}"],
					maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB — main JS bundle is ~2.4 MB
					runtimeCaching: [
						{
							urlPattern:
								/^\/api\/(?!auth\/(sign-in|sign-up|request-password-reset|reset-password)).*/,
							handler: "NetworkFirst",
							options: {
								cacheName: "api-cache",
								expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
								networkTimeoutSeconds: 5,
							},
						},
						{
							urlPattern:
								/^\/api\/auth\/(sign-in|sign-up|request-password-reset|reset-password)/,
							handler: "NetworkOnly",
						},
						{
							urlPattern: /^\/attachments\//,
							handler: "StaleWhileRevalidate",
							options: {
								cacheName: "attachments-cache",
								expiration: {
									maxEntries: 50,
									maxAgeSeconds: 60 * 60 * 24 * 30,
								},
							},
						},
						{
							urlPattern: /^\/health/,
							handler: "NetworkOnly",
						},
					],
					navigateFallback: "/index.html",
					navigateFallbackDenylist: [
						/^\/api/,
						/^\/attachments/,
						/^\/import-notion/,
					],
				},
			}),
		],
		server: {
			port: 5173,
			proxy: {
				"/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
				"/import-notion": {
					target: "http://127.0.0.1:3000",
					changeOrigin: true,
				},
				"/attachments": { target: "http://127.0.0.1:3000", changeOrigin: true },
				"/ingest/static": {
					target: posthogAssetsHost,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ingest/, ""),
				},
				"/ingest/array": {
					target: posthogAssetsHost,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ingest/, ""),
				},
				"/ingest": {
					target: posthogHost,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ingest/, ""),
				},
			},
		},
	};
});
