import pup, { Page, Response } from "puppeteer";
import fs from "fs";
import parseCsv from "csv-parse/lib/sync";
import chalk from "chalk";
import * as winston from "winston";

import * as elib from "./lib";
import { Roll, Side } from "./lib";
import { getPath, paths } from "./Paths";

import DatabaseHandler from "./db";

process
	.on("unhandledRejection", (reason, p) => {
		logger.error("Unhandled Rejection at Promise", reason, p);
	})
	.on("uncaughtException", err => {
		logger.error("Uncaught Exception thrown", err);
	});

let rollsHistory: Roll[] = [];
let globalPage: Page;
let steamId: string;

let DbHandler = new DatabaseHandler();

const rulesFile = fs.readFileSync(getPath(paths.algoPath));
const rules: [[string, string]] = parseCsv(rulesFile);

function prepareUserDataDir() {
	if (!fs.existsSync(getPath(paths.userDataDir))) {
		fs.mkdirSync(getPath(paths.userDataDir));
	}
}

const { username, password } = require(getPath(paths.envPath));

function createLogger() {
	const logger = winston.createLogger({
		levels: winston.config.cli.levels,
		format: winston.format.json(),
		transports: [
			new winston.transports.File({ filename: "error.log", level: "error" }),
			new winston.transports.File({ filename: "combined.log" })
		]
	});

	logger.add(new winston.transports.Console({
		format: winston.format.simple()
	}));

	return logger;
}

export const logger = createLogger();

async function main() {
	logger.info(chalk.magenta(`Empirebot v.2.0.0`));
	logger.info("(c) Josef Vacek");
	await DbHandler.init();

	prepareUserDataDir();
	const userDataDir = getPath(paths.userDataDir);
	const browser = await pup.launch({
		headless: false,
		userDataDir: userDataDir,
		args: ["--disable-gpu", "--disable-session-crashed-bubble", "--disable-infobars"],
		defaultViewport: null
	});

	const page = await browser.newPage();
	page.on("response", onResponse);

	await elib.gotoEmpire(page);
	await page.waitFor(3000);
	const loggedIn = await elib.isLoggedIn(page);
	if (!loggedIn) {
		logger.info("Trying to log in");
		const loggedInAlready = await elib.login(page, username, password);
		if (!loggedInAlready.alreadyLoggedIn) {
			const steamGuardNeeded = await elib.steamGuardNeeded(page);
			if (steamGuardNeeded) {
				logger.warn("zadej steam guard kód");
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
	if (strokesSinceBonus === -1) {
		logger.warn(
			chalk.inverse(
				`No bonus found in history, waiting...`
			)
		);
		return 0;
	}
	logger.info(
		chalk.inverse(
			`Strokes since Bonus: ${strokesSinceBonus}`
		)
	);
	const rule = rules.find(rule => parseInt(rule[0]) == strokesSinceBonus);
	if (!rule) {
		logger.info(chalk.inverse(`No rule found`));
		return 0;
	}
	return parseFloat(rule[1]);
}

interface User {
	steam_id?: string;
}

async function onResponse(response: Response) {
	const url = await response.url();
	if (
		url.includes("https://csgoempire.com/api/v2/metadata") &&
		(await response.status()) === 200
	) {
		const json: { user?: User } = (await response.json()) as { user: User };
		if (json.user?.steam_id) {
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
		const winner = winnerHash === 0 ? Side.Bonus : winnerHash > 7 ? Side.CT : Side.T;
		if (winner === Side.Bonus) { /* Reset rolls history on bonus */
			rollsHistory = [];
		}
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

			logger.info(`Last bet: ${hasWon ? chalk.green("WON") : chalk.red("LOST")} ${profit}`);

			await DbHandler.insertBetResult({
				steam_id: steamId,
				change: profit,
				target: myBet.coin as Side,
				actual: winner
			});
		} else {
			logger.warn("Didn't bet this round");
		}

		/* Next bet */
		const betSide = "d";
		const betAmount = getBetAmount();
		if (betAmount == 0) {
			logger.warn(chalk.green(`Skipping bet because of 0 bet amount value.`));
			return;
		}
		logger.info(chalk.green(`Betting ${betAmount} on ${betSide}`));
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
	const input = await page.waitForSelector("input[placeholder=\"Enter bet amount...\"]");
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
	logger.debug("Typing bet amount");
	await input.type(amount.toString(), { delay: Math.random() * 100 });
	await page.waitFor(1000);
	logger.debug("Defocusing input");
	(await page.waitForSelector("body")).click();
	await page.waitForSelector(".wheel__marker");
	logger.debug("Waiting for end of roll");
	await page.waitForSelector(".wheel__marker", {
		hidden: true
	});
	await page.waitFor(delay(1000));
	logger.debug("Clicking bet button");
	await page.evaluate(() => {
		Array.from(document.querySelectorAll("span"))
			.find(span => span.innerText.trim().toLowerCase() === "win 14")
			?.click();
	});
}

function delay(ms: number, random: number = 100) {
	return ms + Math.random() * random;
}

main();
