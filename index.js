const pup = require("puppeteer");
const fs = require("fs");
const parseCsv = require("csv-parse/lib/sync");
const chalk = require('chalk');

const elib = require("./lib");

const { initialize, Roll } = require("./db");

const userDataDir = "./userData";

/**
 *
 * @type {{winner: string, round: int}[]}
 */
var rollsHistory = [];
var betsHistory = [];

/** {Page} */
var globalPage;

const rulesFile = fs.readFileSync("./algo.csv");
const rules = parseCsv(rulesFile);

function prepareUserDataDir() {
	if (!fs.existsSync(userDataDir)) {
		fs.mkdirSync(userDataDir);
	}
}

async function main() {
	const dlib = await initialize();

	prepareUserDataDir();
	const browser = await pup.launch({
		headless: false,
		userDataDir: userDataDir,
		args: [
			"--disable-gpu"
		],
		defaultViewport: null
	});

	const page = await browser.newPage();
	await elib.gotoEmpire(page);
	const maintenance = elib.isInMaintenance(page);
	const loggedIn = await elib.verifyLogin(page);
	if (!loggedIn) {
		await elib.login(page, "vacekjo", "anZ9S265z65arRuD");
		const steamGuardNeeded = await elib.steamGuardNeeded(page);
		if (steamGuardNeeded) {
			console.log("zadej steam guard kód");
			await page.waitForNavigation({
				timeout: 5 * 60 * 1000
			});
			await elib.verifyLogin(page);
		}
	}
	await page.waitFor(4000);
	await elib.closeWelcomeBackModal(page);
	await elib.closeChat(page);

	const client = page._client;

	globalPage = page;

	client.on('Network.webSocketFrameReceived', onWsMsg);
}

function getBetAmount() {
	const strokesSinceDice = elib.getStrokesSinceDice(rollsHistory);
	const betAmount =  parseFloat(rules[strokesSinceDice][1])
	console.log(chalk.blue(`Strokes since dice: ${strokesSinceDice} | Bet amount from table: ${betAmount}`));
	return betAmount;
}

function onWsMsg({ requestId, timestamp, response }) {
	/* Filter out nonrelevant information */
	const payload = response.payloadData;
	if (payload.includes("roll\",")) {
		/* 0 is dice, 1 to 7 is T, upper is CT*/
		/*4 t
		0 d
		11 ct
		9 ct
		2 t
		3 t
		7 t
		10 ct
		11 ct
		5 t
		9 ct
		10 ct
		13 ct
		4 t
		0 d*/
		const data = JSON.parse(payload.slice(2));
		const winnerHash = data[1].winner;
		const winner = winnerHash === 0 ? "d" : winnerHash > 7 ? "ct" : "t";
		rollsHistory.push({ winner: winner, round: data[1].round });

		const betSide = "d";
		const betAmount = getBetAmount();
		console.log(chalk.green(`Betting ${betAmount} on ${betSide}`));
		bet(globalPage, betAmount, betSide);
	}
}

/**
 *
 * @param {Page} page
 *
 * @param {number} amount
 * @param {string} winner
 */
async function bet(page, amount, winner) {
	const input = await page.waitForSelector('input[placeholder="Enter bet amount..."]');
	await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll("button"));
		const clear = btns.find((btn) => {
			return btn.innerText.trim() === "Clear";
		});
		clear.click();
	});
	await input.click({ clickCount: 3 });
	console.log("Typing bet amount");
	await input.type(amount.toString(), { delay: Math.random() * 100 });
	(await page.$(".coinstack")).click();
	console.log("Waiting for 12 seconds");
	await page.waitFor(12 * 1000);
	console.log("Clicking bet button");
	await page.evaluate(() => {
		Array.from(document.querySelectorAll("span"))
			.find((span) => span.innerText.trim()
				.toLowerCase() === "win 14")
			.click();
	});
}

main();
