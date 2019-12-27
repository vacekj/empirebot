const { getStrokesSinceBonus } = require("./src/lib");

test("Get strokes since Bonus correctly", () => {
	const strokes5 = [
		{ winner: "ct", round: 1 },
		{ winner: "d", round: 2 },
		{ winner: "t", round: 3 },
		{ winner: "t", round: 4 },
		{ winner: "t", round: 5 },
		{ winner: "t", round: 6 },
		{ winner: "t", round: 7 },
	];
	expect(getStrokesSinceBonus(strokes5))
		.toBe(5);

	const strokes00 = [
		{ winner: "d", round: 1 }
	];

	expect(getStrokesSinceBonus(strokes00))
		.toBe(0);
});
