// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

import mdx from '@astrojs/mdx';

import tailwindcss from "@tailwindcss/vite";

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
	site: 'https://pandaptable.moe',
	integrations: [sitemap(), mdx(), icon({ include: { mdi: ["github", "steam", "youtube", "twitch"], ic: ["baseline-discord"] } })],
	vite: {
		plugins: [tailwindcss()],
		server: {
			allowedHosts: [".trycloudflare.com"]
		}
	}
});