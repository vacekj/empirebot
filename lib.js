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
	await page.goto("https://csgoempire.com/login");

	const username = await page.waitForSelector("#steamAccountName");
	await username.focus();
	await username.type(username_);

	const password = await page.waitForSelector("#steamPassword");
	await password.focus();
	await password.type(password_);

	(await page.waitForSelector("#imageLogin")).click();

	await page.waitForNavigation();
}


/**
 *
 * @param {Page} page
 */
async function verifyLogin(page) {
	const avatar = await page.waitForSelector(".avatar");
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
	const rollDivs = await page.$$(".previous-rolls-item");
	// noinspection JSValidateTypes
	/** @type HTMLDivElement[] */
	const rolls = rollDivs.map((/** Element */rollDiv) => rollDiv.firstChild);
}



