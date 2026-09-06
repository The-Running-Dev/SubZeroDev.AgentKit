type SfxAsset = {
	name: string;
	description: string;
	length_s: number;
	source: "elevenlabs" | "user" | "openverse";
	notes?: string;
};

export const sfx: SfxAsset = {
	name: "Freeze latch close",
	description: "Wooden chest lid latch closing, ~1.1s. Mechanical 'lock down' sound for the FREEZE marker slamming in.",
	length_s: 1.1,
	source: "openverse",
	notes:
		'Openverse: "Wooden Chest Lid Latches Close_02.wav" by The_Frisbee_of_Peace. License: CC0 1.0. Share link: https://openverse.org/audio/0c14dca1-173d-46b7-93ea-34c21b0c9072',
};

export default sfx;
