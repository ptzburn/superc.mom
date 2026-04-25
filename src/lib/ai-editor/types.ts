// Input contract: gameplay events emitted by the brawler game.
export type GameEvent =
	| {
			kind: "kill";
			t: number;
			killer: string;
			victim: string;
			killerHp: number;
			killerMaxHp: number;
			victimKind: string;
			range: number;
			chainSeconds: number;
	  }
	| { kind: "ally_kill"; t: number; killer: string; victim: string }
	| { kind: "ally_death"; t: number; victim: string }
	| { kind: "low_hp_save"; t: number; subject: string; hpAfter: number }
	| { kind: "long_shot"; t: number; killer: string; range: number }
	| {
			kind: "match_end";
			t: number;
			result: "win" | "loss";
			durationMs: number;
	  };

// Output contract: a TikTok-style edit plan produced by the AI editor.
export type EditPlan = {
	mood: "hype" | "menacing" | "cocky" | "comeback";
	audio: "phonk_hype" | "phonk_menacing" | "phonk_cocky";
	hook: string;
	shots: Array<{
		eventIndex: number;
		caption: string;
		lengthMs: number;
		transition?: "cut" | "whip" | "flash" | "glitch";
	}>;
	outro: string;
};
