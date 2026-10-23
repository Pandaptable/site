import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const genDir = path.join(root, "generated");
const manifestPath = path.join(genDir, "manifest.json");
const targetArg = process.argv[2] ? path.resolve(process.argv[2]) : null;

// sources live in public/<folder>, generated variants in public/gen/<folder>
const jobs = [
	{
		src: "public/art",
		out: "art",
		pattern: /\.(png|jpe?g|webp|avif|gif)$/i,
		strip: true,
		ads: false,
	},
	{
		src: "public/ads",
		out: "ads",
		pattern: /\.(gif|png|jpe?g|webp|avif)$/i,
		strip: true,
		ads: true,
	},
];

const variantExts = new Set([
	".anim",
	".avif",
	".webp",
	".jpg",
	".jxl",
	".gif",
]);

const run = (cmd, args) =>
	execFileSync(cmd, args, { stdio: "pipe" }).toString().trim();
const rm = (...files) => files.forEach((f) => fs.rmSync(f, { force: true }));
const mtime = (f) => fs.statSync(f).mtimeMs;

const getFps = (f) => {
	try {
		const [n, d] = run("ffprobe", [
			"-v",
			"error",
			"-select_streams",
			"v:0",
			"-show_entries",
			"stream=avg_frame_rate",
			"-of",
			"default=nw=1:nk=1",
			f,
		])
			.split("/")
			.map(Number);
		if (n > 0 && d > 0) return n / d;
	} catch {}
	try {
		const t = Number(
			run("magick", ["identify", "-format", "%T", `${f}[0]`]),
		);
		if (t > 0) return 100 / t;
	} catch {}
	return 50;
};

let generated = 0,
	skipped = 0;
const manifest = {};

for (const job of jobs) {
	const srcDir = path.join(root, job.src);
	const outDir = path.join(genDir, job.out);
	if (!fs.existsSync(srcDir)) continue;
	fs.mkdirSync(outDir, { recursive: true });

	const files = fs.readdirSync(srcDir).filter((f) => job.pattern.test(f));
	const validBases = new Set(files.map((f) => path.parse(f).name));

	// prune only OUR generated variants whose source is gone
	for (const outFile of fs.readdirSync(outDir)) {
		const parsed = path.parse(outFile);
		if (parsed.name.startsWith(".")) continue;
		if (
			variantExts.has(parsed.ext.toLowerCase()) &&
			!validBases.has(parsed.name)
		) {
			rm(path.join(outDir, outFile));
		}
	}

	for (const file of files) {
		const srcPath = path.join(srcDir, file);
		const { name: base, ext: rawExt } = path.parse(file);
		const ext = rawExt.toLowerCase();
		const isGif = ext === ".gif";
		const srcTime = mtime(srcPath);
		const stale = (p) =>
			(targetArg && path.resolve(srcPath) === targetArg) ||
			!fs.existsSync(p) ||
			mtime(p) < srcTime;

		const out = (e) => path.join(outDir, `${base}.${e}`);
		let animated = false;
		try {
			animated =
				run("magick", ["identify", srcPath]).split("\n").length > 1;
		} catch {}

		const formats = [];

		if (animated) {
			fs.writeFileSync(out("anim"), "");
			formats.push("anim");
			rm(out("jpg"));
			if (stale(out(ext.slice(1))))
				fs.copyFileSync(srcPath, out(ext.slice(1)));
			formats.push(ext.slice(1));

			const needJxl = ext !== ".jxl" && stale(out("jxl"));
			const needAvif = ext !== ".avif" && stale(out("avif"));
			const needWebp = ext !== ".webp" && stale(out("webp"));
			const needGif = !isGif && stale(out("gif"));

			if (needJxl || needAvif || needWebp || needGif) {
				const seq = `.probe-${process.pid}-%03d.png`;
				const rt = path.join(outDir, `.rt-${process.pid}.apng`);
				try {
					const fps = getFps(srcPath);
					// running into weird random issues on host system lol
					run("magick", [srcPath, "-coalesce", path.join(outDir, seq)]);
					run("ffmpeg", [
						"-y",
						"-framerate",
						fps.toFixed(4),
						"-i",
						path.join(outDir, seq),
						"-plays",
						"0",
						rt,
					]);

					if (needJxl)
						run("cjxl", [
							rt,
							out("jxl"),
							"-d",
							job.ads ? "3" : "1",
							"-e",
							"7",
							"--quiet",
						]);
					if (needAvif)
						run("ffmpeg", [
							"-y",
							"-i",
							rt,
							"-c:v",
							"libaom-av1",
							"-crf",
							job.ads ? "36" : "30",
							"-cpu-used",
							"8",
							"-threads",
							"0",
							out("avif"),
						]);
					if (needWebp)
						run("ffmpeg", [
							"-y",
							"-i",
							rt,
							"-c:v",
							"libwebp",
							"-q:v",
							job.ads ? "60" : "75",
							"-loop",
							"0",
							out("webp"),
						]);
					if (needGif)
						run("ffmpeg", [
							"-y",
							"-i",
							rt,
							"-vf",
							`fps=${Math.min(fps, 50).toFixed(2)}`,
							out("gif"),
						]);
				} catch {}
				rm(rt);
				for (const f of fs.readdirSync(outDir)) {
					if (f.startsWith(`.probe-${process.pid}`)) rm(path.join(outDir, f));
				}
			}
			generated++;
		} else {
			rm(out("anim"));
			if (!isGif) rm(out("gif"));

			const encodes = isGif
				? [
						["avif", ["-quality", "60"]],
						["webp", ["-quality", "60"]],
					]
				: [
						["avif", ["-quality", "85"]],
						["webp", ["-quality", "90"]],
						[
							"jpg",
							[
								"-quality",
								"92",
								"-background",
								"#11111b",
								"-flatten",
							],
						],
					];

			for (const [fExt, args] of encodes) {
				if (stale(out(fExt))) {
					run("magick", [
						srcPath,
						...(job.strip ? ["-strip"] : []),
						...args,
						out(fExt),
					]);
					generated++;
				} else skipped++;
			}
			if (isGif && stale(out("gif"))) {
				fs.copyFileSync(srcPath, out("gif"));
				generated++;
			}
		}

		try {
			const [w, h, rgb] = run("magick", [
				`${srcPath}[0]`,
				"-format",
				"%w %h ",
				"-write",
				"info:",
				"-resize",
				"1x1!",
				"-format",
				"%[fx:int(255*r)],%[fx:int(255*g)],%[fx:int(255*b)]",
				"info:",
			]).split(" ");
			const hex = rgb
				.split(",")
				.map((n) => (+n).toString(16).padStart(2, "0"))
				.join("");
			manifest[`${job.out}/${base}`] = {
				w: +w,
				h: +h,
				c: `#${hex}`,
				a: animated,
				s: ext.slice(1),
			};
		} catch {}
	}
}

// formats recorded by existence, not by what this run encoded
for (const [key, entry] of Object.entries(manifest)) {
	const [folder, base] = key.split("/");
	const outDir = path.join(genDir, folder);
	const formats = new Set([entry.s]);
	for (const e of ["avif", "webp", "jpg", "jxl", "gif", "anim"]) {
		if (fs.existsSync(path.join(outDir, `${base}.${e}`))) formats.add(e);
	}
	entry.f = [...formats];
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`formats: ${generated} generated, ${skipped} cached`);
