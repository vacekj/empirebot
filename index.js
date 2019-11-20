const pup = require("puppeteer");
const seq = require("sequelize");
const readline = require('readline');
const fs = require("fs");

const elib = require("./lib");

const userDataDir = "./userData";

function prepareUserDataDir() {
	if (!fs.existsSync(userDataDir)) {
		fs.mkdirSync(userDataDir);
	}
}

async function main() {
	prepareUserDataDir();
	const browser = await pup.launch({
		headless: false,
		userDataDir: userDataDir,
		args: [
			"--disable-gpu"
		]
	});

	const page = await browser.newPage();
	await elib.gotoEmpire(page);
	const loggedIn = await elib.verifyLogin(page);
	if (!loggedIn) {
		await elib.login(page, "vacekjo", "anZ9S265z65arRuD");
	}
	const steamGuardNeeded = await elib.steamGuardNeeded(page);
	if (steamGuardNeeded) {
		console.log("zadej steam guard kód");
		await page.waitForNavigation({
			timeout: 5 * 60 * 1000
		});
		await elib.verifyLogin(page);
	}
	await elib.closeWelcomeBackModal(page);
	await elib.closeChat(page);
}

main();
