import pup, { Page, Response } from "puppeteer";
import fs from "fs";
import parseCsv from "csv-parse/lib/sync";
import chalk from "chalk";

import * as elib from "./lib";
import { getPath, paths } from "./Paths";
import { Roll, Side } from "./lib";

import DatabaseHandler from "./db";

process
	.on("unhandledRejection", (reason, p) => {
		console.error(reason, "Unhandled Rejection at Promise", p);
		process.exit(1);
	})
	.on("uncaughtException", err => {
		console.error(err, "Uncaught Exception thrown");
		process.exit(1);
	});

let rollsHistory: Roll[] = [];
let globalPage: Page;
let steamId: string;

let DbHandler = new DatabaseHandler();

const rulesFile = fs.readFileSync(getPath(paths.algoPath));
const rules = parseCsv(rulesFile);

function prepareUserDataDir() {
	if (!fs.existsSync(getPath(paths.userDataDir))) {
		fs.mkdirSync(getPath(paths.userDataDir));
	}
}

const { username, password } = require(getPath(paths.envPath));

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
	await DbHandler.init();
	prepareUserDataDir();
	const userDataDir = getPath(paths.userDataDir);
	const browser = await pup.launch({
		headless: false,
		userDataDir: userDataDir,
		args: [
			"--disable-gpu",
			"--disable-session-crashed-bubble",
			"--disable-infobars"
		],
		defaultViewport: null
	});

	const page = await browser.newPage();
	page.on("response", onResponse);

	await elib.gotoEmpire(page);
	await page.waitFor(3000);
	const loggedIn = await elib.isLoggedIn(page);
	if (!loggedIn) {
		console.log("Trying to log in");
		const loggedInAlready = await elib.login(page, username, password);
		if (!loggedInAlready.alreadyLoggedIn) {
			const steamGuardNeeded = await elib.steamGuardNeeded(page);
			if (steamGuardNeeded) {
				console.log("zadej steam guard kód");
				await page.waitForNavigation({
					timeout: 50 * 60 * 1000
				});
				await elib.isLoggedIn(page);
			}
		}
	}
	await page.waitFor(2000);
	await elib.closeWelcomeBackModal(page);
	// await elib.closeChat(page);

	// @ts-ignore
	const client = page._client;

	globalPage = page;

	client.on("Network.webSocketFrameReceived", onWsMsg);
}

function getBetAmount() {
	const strokesSinceBonus = elib.getStrokesSinceBonus(rollsHistory);
	const betAmount = parseFloat(rules[strokesSinceBonus][1]);
	console.log(
		chalk.inverse(
			`Strokes since Bonus: ${strokesSinceBonus} | Bet amount from table: ${betAmount}`
		)
	);
	return betAmount;
}

interface User {
	steam_id: string;
}

async function onResponse(response: Response) {
	const url = await response.url();
	if (
		url.includes("https://csgoempire.com/api/v2/metadata") &&
		(await response.status()) === 200
	) {
		const json: { user: User } = (await response.json()) as { user: User };
		if (json.user) {
			steamId = json.user.steam_id;
		}
	}
}

interface Bet {
	id: string;
	steam_id: string;
	steam_name: string;
	name: string;
	avatar: string;
	profile_url: string;
	verified: number;
	lvl: number;
	koc_rank?: any;
	round: number;
	coin: string;
	amount: number;
	user_id: number;
	uid: number;
	bonus_eligible: boolean;
}

async function onWsMsg({ response }: { response: { payloadData: string } }) {
	const payload = response.payloadData;
	if (payload.includes("roll\",")) {
		const data = JSON.parse(payload.slice(17));
		const winnerHash = data[1].winner;
		const winner =
			winnerHash === 0 ? Side.Bonus : winnerHash > 7 ? Side.CT : Side.T;
		rollsHistory.push({ winner: winner, round: data[1].round });

		/* Evaluate our bet */
		const allBets: Bet[] = []
			.concat(data[1]?.bets?.t)
			.concat(data[1]?.bets?.ct)
			.concat(data[1]?.bets?.bonus);
		const myBet = allBets.find(bet => {
			return bet.steam_id === steamId;
		});

		if (myBet) {
			const hasWon = myBet.coin === winner;
			const profit = getProfit(hasWon, myBet.amount, myBet.coin as Side);

			console.log(
				`Last bet: ${
					hasWon ? chalk.green("WON") : chalk.red("LOST")
				} ${profit}`
			);

			await DbHandler.insertBetResult({
				steam_id: steamId,
				change: profit,
				target: myBet.coin as Side,
				actual: winner
			});
		} else {
			console.log("Didn't bet this round");
		}

		/* Next bet */
		const betSide = "d";
		const betAmount = getBetAmount();
		console.log(chalk.green(`Betting ${betAmount} on ${betSide}`));
		await bet(globalPage, betAmount);
	}
}

function getProfit(hasWon: boolean, betAmount: number, betSide: Side) {
	if (!hasWon) {
		return -betAmount;
	}

	return betSide === "bonus" ? betAmount * 14 : betAmount * 2;
}

async function bet(page: Page, amount: number) {
	const input = await page.waitForSelector(
		"input[placeholder=\"Enter bet amount...\"]"
	);
	await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll("button"));
		const clear = btns.find(btn => {
			return btn.innerText.trim().toLowerCase() === "clear";
		});
		if (clear) {
			clear.click();
		}
	});

	await input.click({ clickCount: 3 });
	console.log("Typing bet amount");
	await input.type(amount.toString(), { delay: Math.random() * 100 });
	await page.waitFor(1000);
	console.log("Defocusing input");
	(await page.waitForSelector("body")).click();
	await page.waitForSelector(".wheel__marker");
	console.log("Waiting for end of roll");
	await page.waitForSelector(".wheel__marker", {
		hidden: true
	});
	console.log("Clicking bet button");
	await page.evaluate(() => {
		Array.from(document.querySelectorAll("span"))
			.find(span => span.innerText.trim().toLowerCase() === "win 14")
			?.click();
	});
}

main();
