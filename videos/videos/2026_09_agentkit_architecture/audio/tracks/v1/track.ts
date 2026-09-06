import type { AudioTrack } from "videowright";

const track: AudioTrack = {
	audio_file: "./audio/tracks/v1/track.mp3",
	length_s: 575.0,
	timing: { perSegment: {} },
	audio_plan_path: "../../audio_plan.md",
	plan_snapshot_path: "./plan_snapshot.md",
	created_at: "2026-09-07T00:40:00Z",
	notes: "SFX-only mix (no VO/music). Timing is intentionally empty — segment advances drive video timing directly since there is no voiceover to sync against; this track is muxed audio only.",
};

export default track;
