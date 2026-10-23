const sound = new Audio("/wpn_denyselect.wav");
sound.preload = "auto";
sound.volume = 0.25;

const isClickable = (el: Element | null) =>
	el?.closest("a, button, label, summary, [role='button']") != null &&
	el?.closest("[data-caption]") == null;

document.addEventListener(
	"click",
	(e) => {
		if (!isClickable(e.target as Element)) return;
		sound.currentTime = 0;
		void sound.play().catch(() => {});
	},
	true,
);
