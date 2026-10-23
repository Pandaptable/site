const sound = new Audio("/wpn_denyselect.wav");
sound.preload = "auto";

const isClickable = (el: Element | null) =>
	el?.closest("a, button, label, summary, [role='button']") != null &&
	el?.closest("[data-caption]") == null;

document.addEventListener(
	"click",
	(e) => {
		if (!isClickable(e.target as Element)) return;
		const click = sound.cloneNode() as HTMLAudioElement;
		click.volume = 0.25;
		click.addEventListener("ended", () => click.remove());
		void click.play().catch(() => {});
	},
	true,
);
