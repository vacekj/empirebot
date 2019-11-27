const { getStrokesSinceDice } = require("./lib");

test("Get strokes since dice correctly", () => {
	const strokes5 = [
		{ winner: "ct", round: 1 },
		{ winner: "d", round: 2 },
		{ winner: "t", round: 3 },
		{ winner: "t", round: 4 },
		{ winner: "t", round: 5 },
		{ winner: "t", round: 6 },
		{ winner: "t", round: 7 },
	];
	expect(getStrokesSinceDice(strokes5))
		.toBe(5);

	const strokes00 = [
		{ winner: "d", round: 1 }
	];

	expect(getStrokesSinceDice(strokes00))
		.toBe(0);
});
