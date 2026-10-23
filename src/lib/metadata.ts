import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";

const run = (cmd: string, args: string[]) =>
	execFileSync(cmd, args, { stdio: "pipe" }).toString().trim();

export interface MetadataResult {
	artist?: string;
	url?: string;
}

export function parseMetadata(raw: string | undefined): MetadataResult {
	if (!raw) return {};
	const trimmed = raw.trim();
	if (!trimmed) return {};

	if (trimmed.includes("|")) {
		const [artist, url] = trimmed.split("|", 2).map((part) => part.trim());
		const result: MetadataResult = {};
		if (artist) result.artist = artist;
		if (url) result.url = url;
		return result;
	}

	if (/^(?:https?:)?\/\//i.test(trimmed)) {
		return { url: trimmed };
	}

	return { artist: trimmed };
}

const exts = ["png", "gif", "jpg", "jpeg", "webp", "avif"];

export function readAssetMetadata(
	name: string,
	{ dir }: { dir: string },
): MetadataResult {
	for (const ext of exts) {
		const file = resolve(dir, `${name}.${ext}`);
		if (!fs.existsSync(file)) continue;
		for (const tag of ["UserComment", "Comment"]) {
			try {
				const raw = run("exiftool", ["-s3", `-${tag}`, file]);
				if (!raw) continue;
				const parsed = parseMetadata(raw);
				if (parsed.artist || parsed.url) return parsed;
			} catch {}
		}
	}
	return {};
}
