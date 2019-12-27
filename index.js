const pup = require("puppeteer");
const fs = require("fs");
const parseCsv = require("csv-parse/lib/sync");
const chalk = require("chalk");

const elib = require("./lib");
const db = require("./db");

const userDataDir = "./userData";

process
	.on('unhandledRejection', (reason, p) => {
		console.error(reason, 'Unhandled Rejection at Promise', p);
		process.exit(1);
	})
	.on('uncaughtException', err => {
		console.error(err, 'Uncaught Exception thrown');
		process.exit(1);
	});

/**
 *
 * @type {{winner: string, round: int}[]}
 */
var rollsHistory = [];

/** {Page} */
var globalPage;

const rulesFile = fs.readFileSync("./algo.csv");
const rules = parseCsv(rulesFile);

function prepareUserDataDir() {
	if (!fs.existsSync(userDataDir)) {
		fs.mkdirSync(userDataDir);
	}
}

const { username, password } = require("./.env.json");

async function main() {
	console.log(`
███████╗███╗   ███╗██████╗ ██╗██████╗ ███████╗██████╗  ██████╗ ████████╗
██╔════╝████╗ ████║██╔══██╗██║██╔══██╗██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝
█████╗  ██╔████╔██║██████╔╝██║██████╔╝█████╗  ██████╔╝██║   ██║   ██║   
██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║██╔══██╗██╔══╝  ██╔══██╗██║   ██║   ██║   
███████╗██║ ╚═╝ ██║██║     ██║██║  ██║███████╗██████╔╝╚██████╔╝   ██║   
╚══════╝╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝  ╚═════╝    ╚═╝   
                                                                        
`);
	console.log("(c) Josef Vacek");
	prepareUserDataDir();
	const browser = await pup.launch({
		headless: false,
		userDataDir: userDataDir,
		args: ["--disable-gpu",
			"--disable-session-crashed-bubble",
			"--disable-infobars"],
		defaultViewport: null
	});

	const page = await browser.newPage();
	await elib.gotoEmpire(page);
	await page.waitFor(3000);
	const loggedIn = await elib.verifyLogin(page);
	if (!loggedIn) {
		const loggedInAlready = await elib.login(page, username, password);
		if (!loggedInAlready) {
			const steamGuardNeeded = await elib.steamGuardNeeded(page);
			if (steamGuardNeeded) {
				console.log("zadej steam guard kód");
				await page.waitForNavigation({
					timeout: 50 * 60 * 1000
				});
				await elib.verifyLogin(page);
			}
		}
	}
	await page.waitFor(4000);
	await elib.closeWelcomeBackModal(page);
	await elib.closeChat(page);

	const client = page._client;

	globalPage = page;

	client.on("Network.webSocketFrameReceived", onWsMsg);
}

function getBetAmount() {
	const strokesSinceDice = elib.getStrokesSinceDice(rollsHistory);
	const betAmount = parseFloat(rules[strokesSinceDice][1]);
	console.log(
		chalk.inverse(
			`Strokes since dice: ${strokesSinceDice} | Bet amount from table: ${betAmount}`
		)
	);
	return betAmount;
}

async function onWsMsg({ requestId, timestamp, response }) {

	const payload = response.payloadData;
	if (payload.includes('roll",')) {
		const data = JSON.parse(payload.slice(17));
		const winnerHash = data[1].winner;
		const winner = winnerHash === 0 ? "bonus" : winnerHash > 7 ? "ct" : "t";
		rollsHistory.push({ winner: winner, round: data[1].round });

		/* TODO: get this from user XHR */
		const mySteamId = "76561198879849315";

		/* Evaluate our bet */
		const allBets = []
			.concat(data[1].bets.t)
			.concat(data[1].bets.ct)
			.concat(data[1].bets.bonus);
		const myBet = allBets.find((bet) => {
			return bet.steam_id === mySteamId;
		});

		if (myBet) {
			const hasWon = myBet.coin === winner;
			const profit = getProfit(hasWon, myBet.amount, myBet.coin);

			console.log(`Last bet: ${hasWon ? chalk.green("WON") : chalk.red("LOST")} ${profit}`);

			await db.insertBetResult({
				steam_id: mySteamId,
				profit: profit,
				target: myBet.coin,
				actual: winner
			});
		} else {
			console.log("Didn't bet this round");
		}

		/* Next bet */
		const betSide = "d";
		const betAmount = getBetAmount();
		console.log(chalk.green(`Betting ${betAmount} on ${betSide}`));
		bet(globalPage, betAmount, betSide);
	}
}

function getProfit(hasWon, betAmount, betSide) {
	if (!hasWon) {
		return -betAmount;
	}

	return betSide === "bonus" ? betAmount * 14 : betAmount * 2;
}

/**
 *
 * @param {Page} page
 *
 */
async function getBalance(page) {
	return parseFloat(await page.$eval(".whitespace-no-wrap", (el) => el.innerHTML));
}

/**
 *
 * @param {Page} page
 *
 * @param {number} amount
 * @param {string} winner
 */
async function bet(page, amount, winner) {
	const input = await page.waitForSelector(
		'input[placeholder="Enter bet amount..."]'
	);
	await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll("button"));
		const clear = btns.find(btn => {
			return btn.innerText.trim() === "Clear";
		});
		clear.click();
	});
	await input.click({ clickCount: 3 });
	console.log("Typing bet amount");
	await input.type(amount.toString(), { delay: Math.random() * 100 });
	await page.waitFor(1000);
	const defocus = await page.waitForSelector(".whitespace-no-wrap");
	await defocus.click();
	const secondsToWait = 8;
	console.log(`Waiting for ${secondsToWait} seconds`);
	await page.waitFor(secondsToWait * 1000);
	console.log("Clicking bet button");
	await page.evaluate(() => {
		Array.from(document.querySelectorAll("span"))
			.find(span => span.innerText.trim()
				.toLowerCase() === "win 14")
			.click();
	});
}

main();
