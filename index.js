const pup = require("puppeteer");
const fs = require("fs");
const parseCsv = require("csv-parse/lib/sync");
const chalk = require("chalk");

const elib = require("./lib");

const userDataDir = "./userData";

const admin = require("firebase-admin");

let serviceAccount = require("./empirebot-9b58d-b1816793c1f1");

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

let db = admin.firestore();

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
/**
 *
 * @type {{
 *     target: string,
 *     balance: number
 * }}
 */
var lastBet = {};

/** {Page} */
var globalPage;

const rulesFile = fs.readFileSync("./algo.csv");
const rules = parseCsv(rulesFile);

function prepareUserDataDir() {
	if (!fs.existsSync(userDataDir)) {
		fs.mkdirSync(userDataDir);
	}
}

const { username, password } = require("./env.json");

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
		args: ["--disable-gpu"],
		defaultViewport: null
	});

	const page = await browser.newPage();
	await elib.gotoEmpire(page);
	const loggedIn = await elib.verifyLogin(page);
	if (!loggedIn) {
		await elib.login(page, username, password);
		await page.waitForNavigation();
		const steamGuardNeeded = await elib.steamGuardNeeded(page);
		if (steamGuardNeeded) {
			console.log("zadej steam guard kód");
			await page.waitForNavigation({
				timeout: 30 * 1000
			});
			await elib.verifyLogin(page);
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
	/* Filter out nonrelevant information */
	const payload = response.payloadData;
	if (payload.includes('roll",')) {
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

		/*Evaluate our last bet*/
		const currentBalance = await getBalance(globalPage);
		const change = currentBalance - lastBet.balance;

		await insertBetResultToDb({
			target: lastBet.target,
			actual: winner,
			change
		});

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
 */
async function getBalance(page) {
	return parseFloat(await page.$eval(".whitespace-no-wrap", (el) => el.innerHTML));
}

function insertBetResultToDb({ target, actual, change }) {
	let collection = db.collection("bets");
	if (!actual || !target) {
		return;
	}
	collection.add({
		target,
		actual,
		change,
		created_on: new Date()
	});

	console.log("=======================");
	console.log(`Last bet: ${target === actual ? chalk.green("WON") : chalk.red("LOST")} ${change}`);
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
	(await page.$(".coinstack")).click();
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

	const currentBalance = await getBalance(globalPage);
	lastBet = {
		target: winner,
		balance: currentBalance
	};
}

main();
