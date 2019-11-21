const { getStrokesSinceDice } = require("./lib");

test("Get strokes since dice correctly", () => {
	const strokes7 = [
		"t",
		"d",
		"t",
		"d",
		"t",
		"t",
		"t",
		"t",
		"t",
		"t",
		"t",
	];
	expect(getStrokesSinceDice(strokes7))
		.toBe(7);

	const strokes0 = [];
	expect(getStrokesSinceDice(strokes0))
		.toBe(0);

	const strokes00 = [
		"d"
	];
	expect(getStrokesSinceDice(strokes00))
		.toBe(0);
});
