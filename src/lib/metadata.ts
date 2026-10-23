import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";
import exif from "exif-reader";

export interface MetadataResult {
	raw?: string;
	artist?: string;
	url?: string;
}

export function parseMetadata(raw: string | undefined): MetadataResult {
	if (!raw) return {};
	const trimmed = raw.trim();
	if (!trimmed) return {};

	if (trimmed.includes("|")) {
		const [first, ...rest] = trimmed.split("|").map((s) => s.trim());
		const second = rest.join("|").trim();
		return {
			raw: trimmed,
			artist: first || undefined,
			url: second || undefined,
		};
	}

	if (/^(?:https?:)?\/\//i.test(trimmed)) {
		return {
			raw: trimmed,
			url: trimmed,
		};
	}

	return {
		raw: trimmed,
		artist: trimmed,
	};
}

export function parseGifComment(buf: Buffer): string | undefined {
	if (buf.length < 13 || buf.toString("ascii", 0, 3) !== "GIF") return undefined;
	let p = 13;
	const flags = buf[10];
	if (flags & 0x80) p += (1 << ((flags & 7) + 1)) * 3;
	while (p < buf.length) {
		const block = buf[p];
		if (block === 0x3b) break;
		if (block === 0x21) {
			const label = buf[p + 1];
			p += 2;
			let text = "";
			while (p < buf.length) {
				const size = buf[p++];
				if (size === 0) break;
				if (label === 0xfe) text += buf.toString("latin1", p, p + size);
				p += size;
			}
			if (label === 0xfe && text.trim()) return text.trim();
		} else if (block === 0x2c) {
			const desc = buf[p + 9];
			if (desc & 0x80) p += (1 << ((desc & 7) + 1)) * 3;
			p += 11;
			while (p < buf.length) {
				const size = buf[p++];
				if (size === 0) break;
				p += size;
			}
		} else {
			break;
		}
	}
	return undefined;
}

export function parsePngTextChunks(buf: Buffer): Record<string, string> {
	const out: Record<string, string> = {};
	if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return out;
	let off = 8;
	while (off + 8 <= buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString("ascii", off + 4, off + 8);
		const data = buf.subarray(off + 8, off + 8 + len);
		if (type === "tEXt") {
			const nul = data.indexOf(0);
			if (nul > 0) {
				out[data.toString("latin1", 0, nul).toLowerCase()] = data.toString(
					"latin1",
					nul + 1,
				);
			}
		} else if (type === "iTXt") {
			const nul = data.indexOf(0);
			if (nul > 0) {
				const keyword = data.toString("latin1", 0, nul).toLowerCase();
				let p = nul + 3; // skip compression flag + method
				p = data.indexOf(0, p) + 1; // language
				p = data.indexOf(0, p) + 1; // translated keyword
				if (p > 0) out[keyword] = data.toString("utf8", p);
			}
		}
		off += 12 + len;
		if (type === "IEND") break;
	}
	return out;
}

export function parseXmpString(xmp: string): string | undefined {
	const m =
		xmp.match(/<exif:UserComment[\s\S]*?<rdf:li[^>]*>([^<]*)<\/rdf:li>/i) ??
		xmp.match(/<dc:description[\s\S]*?<rdf:li[^>]*>([^<]*)<\/rdf:li>/i) ??
		xmp.match(/<dc:creator[\s\S]*?<rdf:li[^>]*>([^<]*)<\/rdf:li>/i);
	return m?.[1]?.trim() || undefined;
}

export async function readRawMetadataFromBuffer(
	buf: Buffer,
): Promise<string | undefined> {
	if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF") {
		const c = parseGifComment(buf);
		if (c) return c;
	}

	if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) {
		const png = parsePngTextChunks(buf);
		const text = png.comment ?? png.usercomment ?? png.description;
		if (text && text.trim()) return text.trim();
		const xmp = png["xml:com.adobe.xmp"];
		if (xmp) {
			const val = parseXmpString(xmp);
			if (val) return val;
		}
	}

	const rawStr = buf.toString("latin1");
	const xmpStart = rawStr.indexOf("<x:xmpmeta");
	if (xmpStart !== -1) {
		const xmpEnd = rawStr.indexOf("</x:xmpmeta>", xmpStart);
		if (xmpEnd !== -1) {
			const xmpPacket = buf.subarray(xmpStart, xmpEnd + 12).toString("utf8");
			const val = parseXmpString(xmpPacket);
			if (val) return val;
		}
	}

	try {
		const { default: sharp } = await import("sharp");
		const meta = await sharp(buf).metadata();
		if (meta.exif) {
			const tags = exif(meta.exif) as {
				Image?: Record<string, unknown>;
				Photo?: Record<string, unknown>;
			};
			const raw =
				(tags.Photo?.UserComment as unknown) ??
				(tags.Image?.XPComment as unknown) ??
				(tags.Image?.ImageDescription as unknown);
			if (typeof raw === "string" && raw.trim()) return raw.trim();
			if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
				const b = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
				const stripped = b
					.subarray(8)
					.toString("utf8")
					.replace(/\0/g, "")
					.trim();
				return stripped || b.toString("utf8").trim();
			}
			if (Array.isArray(raw)) {
				return String.fromCharCode(...raw.map(Number)).trim();
			}
		}
	} catch {
	}

	return undefined;
}

// exiftool resolves formats the in-node parsers can't reach (e.g. brotli-compressed XMP inside avif)
export function readRawMetadataViaExiftool(
	filePath: string,
): string | undefined {
	try {
		const out = execFileSync(
			"exiftool",
			[
				"-s3",
				"-UserComment",
				"-Comment",
				"-ImageDescription",
				"-XMP:Description",
				filePath,
			],
			{ stdio: "pipe" },
		)
			.toString()
			.split(/\r?\n/)
			.filter((l) => l.trim())
			.map((l) => l.trim());
		return out[0] || undefined;
	} catch {
		return undefined;
	}
}

export async function readAssetMetadata(
	name: string,
	subdirs: { generated: string; src: string },
): Promise<MetadataResult> {
	const candidates = [
		resolve(subdirs.src, `${name}.png`),
		resolve(subdirs.src, `${name}.gif`),
		resolve(subdirs.src, `${name}.jpg`),
		resolve(subdirs.src, `${name}.jpeg`),
		resolve(subdirs.src, `${name}.webp`),
		resolve(subdirs.src, `${name}.avif`),
		resolve(subdirs.generated, `${name}.jpg`),
		resolve(subdirs.generated, `${name}.gif`),
		resolve(subdirs.generated, `${name}.png`),
	];

	for (const candidate of candidates) {
		if (!fs.existsSync(candidate)) continue;
		try {
			const buf = fs.readFileSync(candidate);
			let raw = await readRawMetadataFromBuffer(buf);
			if (!raw) raw = readRawMetadataViaExiftool(candidate);
			if (raw) {
				const parsed = parseMetadata(raw);
				if (parsed.artist || parsed.url) return parsed;
			}
		} catch {}
	}

	return {};
}
