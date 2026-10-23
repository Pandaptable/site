const radios = [...document.querySelectorAll<HTMLInputElement>(".page-radio")];
const panels = [...document.querySelectorAll<HTMLElement>(".tab-panel")];

function syncInert() {
	const active = radios.find((r) => r.checked)?.dataset.tab;
	panels.forEach((p) => {
		if (active && p.dataset.panel !== active) p.setAttribute("inert", "");
		else p.removeAttribute("inert");
	});
}

radios.forEach((r) => r.addEventListener("change", syncInert));
syncInert();

const lightbox = document.getElementById("lightbox");
const lbCap = lightbox?.querySelector("figcaption");

const lbArtist = lightbox?.querySelector<HTMLAnchorElement>(".lightbox-artist");
let lbOpener: HTMLElement | null = null;
let lbItems: HTMLElement[] = [];
let lbIndex = 0;

function closeLightbox() {
	if (!lightbox) return;
	lightbox.hidden = true;
	document.body.style.overflow = "";
	lbOpener?.focus();
}

let lbImg: HTMLImageElement | null = null;
let lbPic: HTMLPictureElement | null = null;

function ensureLightboxMedia() {
	if (lbImg || !lightbox) return;
	const fig = lightbox.querySelector("figure");
	if (!fig) return;
	lbPic = document.createElement("picture");
	lbImg = document.createElement("img");
	lbImg.alt = "";
	lbImg.loading = "eager";
	lbImg.setAttribute("data-image-component", "");
	lbImg.addEventListener("load", () => (lbImg!.style.opacity = "1"));
	lbImg.addEventListener("error", () => (lbImg!.style.opacity = "1"));
	lbPic.appendChild(lbImg);
	fig.prepend(lbPic);
}

function lbShow(t: HTMLElement) {
	ensureLightboxMedia();
	if (!lbPic || !lbImg) return;
	lbImg.style.opacity = "0";
	const sources: [string | undefined, string][] = [
		[t.dataset.lightboxAvif, "image/avif"],
		[t.dataset.lightboxWebp, "image/webp"],
		[t.dataset.lightbox, "image/jxl"],
	];
	lbPic.replaceChildren();
	for (const [url, type] of sources) {
		if (!url) continue;
		const s = document.createElement("source");
		s.srcset = url;
		s.type = type;
		lbPic.appendChild(s);
	}
	lbImg.src = t.dataset.lightboxJpg || t.dataset.lightbox || "";
	lbPic.appendChild(lbImg);
	if (lbCap) lbCap.textContent = t.dataset.caption ?? "";
	const url = t.dataset.artistUrl;
	if (lbArtist) {
		lbArtist.hidden = !url;
		if (url) {
			lbArtist.href = url;
			lbArtist.textContent = t.dataset.artist || "artist";
			lbArtist.insertAdjacentHTML(
				"afterbegin",
				'<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
			);
		}
	}
}

function lbStep(delta: number) {
	if (!lbItems.length) return;
	lbIndex = (lbIndex + delta + lbItems.length) % lbItems.length;
	lbShow(lbItems[lbIndex]);
}

document.addEventListener("click", (e) => {
	const trigger = (e.target as HTMLElement).closest<HTMLElement>(
		"[data-lightbox]",
	);
	if (!trigger || !lightbox) return;
	e.preventDefault();
	lbOpener = trigger;
	const scope = trigger.closest(".tab-panel") ?? document;
	lbItems = [...scope.querySelectorAll<HTMLElement>("[data-lightbox]")];
	lbIndex = Math.max(0, lbItems.indexOf(trigger));
	lbShow(trigger);
	lightbox.hidden = false;
	document.body.style.overflow = "hidden";
	lightbox.focus();
});

lightbox?.addEventListener("click", closeLightbox);

lbArtist?.addEventListener("click", (e) => e.stopPropagation());
addEventListener("keydown", (e: KeyboardEvent) => {
	if (!lightbox || lightbox.hidden) return;
	if (e.key === "Escape") closeLightbox();
	else if (e.key === "ArrowRight") lbStep(1);
	else if (e.key === "ArrowLeft") lbStep(-1);
});
