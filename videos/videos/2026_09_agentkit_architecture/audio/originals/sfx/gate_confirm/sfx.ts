type SfxAsset = {
	name: string;
	description: string;
	length_s: number;
	source: "elevenlabs" | "user" | "openverse";
	notes?: string;
};

export const sfx: SfxAsset = {
	name: "Gate confirm click",
	description: "Short synth UI button click, ~0.16s. Used for review-gate / stage-pass moments.",
	length_s: 0.2,
	source: "openverse",
	notes:
		'Openverse: "SFX UI Button Click" by suntemple. License: CC0 1.0. Share link: https://openverse.org/audio/ea9dc47e-7f07-45dd-8aa6-8c9e25609251',
};

export default sfx;
