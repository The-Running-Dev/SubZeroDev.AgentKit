import "../../styles/motion-engineering/tokens.css";
import type { Timeline } from "videowright";
import defaultAudioTrack from "./audio/tracks/v1/track.js";

const timeline: Timeline = {
	meta: {
		title: "AgentKit — Architecture Explainer",
	},
	segments: [
		{ id: "title" },
		{ id: "problem", transition: "fade" },
		{ id: "pipeline", transition: "fade" },
		{ id: "session-boundaries", transition: "fade" },
		{ id: "model-routing", transition: "fade" },
		{ id: "contracts", transition: "fade" },
		{ id: "design-state", transition: "fade" },
		{ id: "orientation", transition: "fade" },
		{ id: "retirement-absorption", transition: "fade" },
		{ id: "verification", transition: "fade" },
		{ id: "github-work-state", transition: "fade" },
		{ id: "freeze-unfreeze", transition: "fade" },
		{ id: "install-reuse", transition: "fade" },
		{ id: "example", transition: "fade" },
		{ id: "close", transition: "fade" },
	],
	default_audio_track: defaultAudioTrack,
};

export default timeline;
