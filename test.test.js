const { Side, getStrokesSinceBonus } = require("./src/lib");

describe("GetStrokesSinceBonus tests", () => {
	test("One bonus in history", () => {

		const strokes5 = [
			{ winner: Side.CT, round: 1 },
			{ winner: Side.Bonus, round: 2 },
			{ winner: Side.T, round: 3 },
			{ winner: Side.T, round: 4 },
			{ winner: Side.T, round: 5 },
			{ winner: Side.T, round: 6 },
			{ winner: Side.T, round: 7 }
		];
		expect(getStrokesSinceBonus(strokes5))
			.toBe(5);
	});

	test("One bonus only", () => {

		const strokes00 = [
			{ winner: Side.Bonus, round: 1 }
		];

		expect(getStrokesSinceBonus(strokes00))
			.toBe(0);
	});

	test("More bonuses", () => {
		const strokes00 = [
			{ winner: Side.Bonus, round: 1 },
			{ winner: Side.Bonus, round: 2 },
			{ winner: Side.Bonus, round: 3 },
			{ winner: Side.Bonus, round: 4 },
			{ winner: Side.Bonus, round: 5 },
			{ winner: Side.Bonus, round: 6 },
			{ winner: Side.T, round: 7 },
			{ winner: Side.T, round: 8 },
			{ winner: Side.Bonus, round: 9 },
			{ winner: Side.T, round: 10 },
			{ winner: Side.T, round: 11 }
		];

		expect(getStrokesSinceBonus(strokes00))
			.toBe(2);
	});
});

