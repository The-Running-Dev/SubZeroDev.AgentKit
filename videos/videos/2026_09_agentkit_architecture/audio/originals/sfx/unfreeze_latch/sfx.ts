type SfxAsset = {
	name: string;
	description: string;
	length_s: number;
	source: "elevenlabs" | "user" | "openverse";
	notes?: string;
};

export const sfx: SfxAsset = {
	name: "Freeze latch open",
	description: "Wooden chest lid latch opening, ~1.76s. Mechanical 'release' sound for the FREEZE marker lifting away.",
	length_s: 1.8,
	source: "openverse",
	notes:
		'Openverse: "Wooden Chest Lid Latches Open.wav" by The_Frisbee_of_Peace. License: CC0 1.0. Share link: https://openverse.org/audio/772df7e0-45e4-448a-8e03-f0d466de0201',
};

export default sfx;
