const pup = require("puppeteer");

/**
 *
 * @param {Page} page
 */
async function gotoEmpire(page) {
	return await page.goto("https://csgoempire.com/");
}

/**
 *
 * @param {Page} page
 * @param username_
 * @param password_
 */
async function login(page, username_, password_) {
	await page.evaluate(() => {
		document.querySelector('a[href="/login"]')
			.click();
	});

	const username = await page.waitForSelector("#steamAccountName");
	await username.focus();
	await username.type(username_, { delay: Math.random() * 100 });

	const password = await page.waitForSelector("#steamPassword");
	await password.focus();
	await password.type(password_, { delay: Math.random() * 100 });

	(await page.waitForSelector("#imageLogin")).click();
}

/**
 *
 * @param {Page} page
 */
async function steamGuardNeeded(page) {
	return !page.url()
		.includes("https://csgoempire.com");
}

/**
 *
 * @param {Page} page
 * @param code
 */
async function solveSteamGuard(page, code) {
	await page.waitForNavigation();
	const codeInput = await page.$(".authcode_entry_input");
	const authButton = await page.waitForSelector(".auth_button");
	await codeInput.type(code, { delay: Math.random() * 100 });
	await authButton.click();
}


/**
 *
 * @param {Page} page
 */
async function verifyLogin(page) {
	const avatar = await page.$(".avatar");
	return avatar != null;
}

/**
 *
 * @param {Page} page
 * @returns {Number} balance
 */
async function getBalance(page) {
	const coinsWrapper = await page.waitForSelector(".text-gold.font-bold.xl:text-sm");
	/** @type HTMLSpanElement */
	const coins = coinsWrapper.firstChild;
	return parseFloat(coins.innerHTML);
}

/**
 *
 * @param {Page} page
 *
 */
async function getPreviousRolls(page) {
	await page.waitForSelector(".previous-rolls-item");
	const rollDivs = await page.$$(".previous-rolls-item > div");
	// noinspection JSValidateTypes
	/** @type HTMLDivElement[] */
	const rolls = await Promise.all(
		rollDivs.map(async (rollDiv) => {
			const className = (await rollDiv.getProperty("className")).toString();
			if (className.includes("coin-t")) {
				return "t";
			} else if (className.includes("coin-ct")) {
				return "ct";
			} else {
				return "d";
			}
		})
	);

	return rolls;
}

/**
 *
 * @param {Page} page
 *
 */
async function closeWelcomeBackModal(page) {
	const closeButton = await page.$(".v--modal-close-button");
	if (closeButton) {
		await closeButton.click();
	}
}

/**
 *
 * @param {Page} page
 *
 */
async function closeChat(page) {
	const closeButton = await page.$(".w-40.h-full.flex.items-center.justify-center.link");
	if (closeButton) {
		await closeButton.click();
	}
}

module.exports = {
	gotoEmpire,
	login,
	verifyLogin,
	steamGuardNeeded,
	closeWelcomeBackModal,
	closeChat,
	getPreviousRolls
};
