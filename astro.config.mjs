// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import mdx from "@astrojs/mdx";

import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";

import { execSync } from "node:child_process";
import path from "node:path";

const formatVariants = () => ({
	name: "format-variants",
	hooks: {
		/** @param {{ server: import("vite").ViteDevServer }} options */
		"astro:server:setup"({ server }) {
			execSync("node scripts/generate-formats.mjs", { stdio: "inherit" });
			server.watcher.add(path.resolve("src/assets"));
			/** @type {ReturnType<typeof setTimeout> | undefined} */
			let timer;
			/** @param {string} changedPath */
			const rebuild = (changedPath) => {
				const norm = (changedPath || "").replace(/\\/g, "/");
				if (norm.includes("src/assets/") || norm.includes("src/assets")) {
					clearTimeout(timer);
					timer = setTimeout(() => {
						try {
							const rel = path.relative(process.cwd(), changedPath);
							execSync(`node scripts/generate-formats.mjs "${rel}"`, {
								stdio: "inherit",
							});
							server.ws.send({ type: "full-reload" });
						} catch (err) {
							console.error("[format-variants] rebuild error:", err);
						}
					}, 150);
				}
			};
			server.watcher.on("add", rebuild);
			server.watcher.on("change", rebuild);
			server.watcher.on("unlink", rebuild);
		},
		"astro:build:start"() {
			execSync("node scripts/generate-formats.mjs", { stdio: "inherit" });
		},
	},
});

export default defineConfig({
	site: "https://pandaptable.moe",
	integrations: [
		sitemap(),
		mdx(),
		icon({
			include: {
				mdi: ["github", "steam", "youtube", "twitch"],
				ic: ["baseline-discord"],
			},
		}),
		formatVariants(),
	],
	vite: {
		plugins: [tailwindcss()],
		assetsInclude: ["*.jxl"],
		server: {
			allowedHosts: [".trycloudflare.com"],
		},
	},
});
