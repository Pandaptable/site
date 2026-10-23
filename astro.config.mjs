// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import mdx from "@astrojs/mdx";

import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import fs from "node:fs";

import { execSync } from "node:child_process";
import path from "node:path";

const formatVariants = () => ({
	name: "format-variants",
	hooks: {
		/** @param {{ server: import("vite").ViteDevServer }} options */
		"astro:server:setup"({ server }) {
			execSync("node scripts/generate-formats.mjs", { stdio: "inherit" });
			server.watcher.add(path.resolve("public/art"));
			server.watcher.add(path.resolve("public/ads"));
			// dev-only: /art|x and /ads|x fall back to public/generated/<folder> so components use one clean URL scheme in dev and prod
			server.middlewares.use((req, res, next) => {
				const m = (req.url || "").match(/^\/(art|ads)\/(.+)$/);
				if (m) {
					const file = decodeURIComponent(m[2]);
					const direct = path.join(
						process.cwd(),
						"public",
						m[1],
						file,
					);
					const generated = path.join(
						process.cwd(),
						"generated",
						m[1],
						file,
					);
					if (!fs.existsSync(direct) && fs.existsSync(generated)) {
						const types = {
							".avif": "image/avif",
							".webp": "image/webp",
							".jpg": "image/jpeg",
							".jxl": "image/jxl",
							".gif": "image/gif",
						};
						res.setHeader(
							"content-type",
							types[path.extname(generated).toLowerCase()] ||
								"application/octet-stream",
						);
						fs.createReadStream(generated).pipe(res);
						return;
					}
				}
				next();
			});
			/** @type {ReturnType<typeof setTimeout> | undefined} */
			let timer;
			/** @param {string} changedPath */
			const rebuild = (changedPath) => {
				const norm = (changedPath || "").replace(/\\/g, "/");
				if (
					!norm.includes("public/art") &&
					!norm.includes("public/ads")
				)
					return;
				if (!fs.existsSync(changedPath)) return;
				if (norm.includes(".probe-") || norm.includes(".rt-")) return;
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
			};
			server.watcher.on("add", rebuild);
			server.watcher.on("change", rebuild);
			server.watcher.on("unlink", rebuild);
		},
		"astro:build:start"() {
			execSync("node scripts/generate-formats.mjs", { stdio: "inherit" });
		},
		"astro:build:done"() {
			for (const folder of ["art", "ads"]) {
				fs.cpSync(
					path.resolve("generated", folder),
					path.resolve("dist", folder),
					{ recursive: true },
				);
			}
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
		server: {
			allowedHosts: [".trycloudflare.com"],
		},
	},
});
