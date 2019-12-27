import { Page, ElementHandle } from "puppeteer";

export async function gotoEmpire(page: Page) {
	return await page.goto("https://csgoempire.com/");
}

export async function login(
	page: Page,
	username_: string,
	password_: string
): Promise<{
	success: boolean;
	alreadyLoggedIn: boolean;
}> {
	try {
		await page.evaluate(() => {
			(document.querySelector(
				"a[href=\"/login\"]"
			) as HTMLElement)?.click();
		});
		await page.waitForNavigation();

		/* We may already be logged in */
		const isAlreadyLoggedIn = await page.$(".OpenID_UserContainer");
		if (isAlreadyLoggedIn) {
			(await page.waitForSelector("#imageLogin")).click();
			return {
				success: true,
				alreadyLoggedIn: true
			};
		}

		const username = await page.waitForSelector("#steamAccountName");
		await username.focus();
		await username.type(username_, { delay: Math.random() * 100 });

		const password = await page.waitForSelector("#steamPassword");
		await password.focus();
		await password.type(password_, { delay: Math.random() * 100 });

		(await page.waitForSelector("#imageLogin")).click();
		return {
			success: true,
			alreadyLoggedIn: false
		};
	} catch (e) {
		console.error("Failed to log in");
		console.error(e);
		return {
			success: false,
			alreadyLoggedIn: false
		};
	}
}

export async function steamGuardNeeded(page: Page) {
	return !page.url().includes("https://csgoempire.com");
}

export async function solveSteamGuard(page: Page, code: string) {
	try {
		await page.waitForNavigation();
		const codeInput = await page.$(".authcode_entry_input");
		if (!codeInput) {
			console.error("Couldn't solve Steam Guard");
			return false;
		}
		const authButton = await page.waitForSelector(".auth_button");
		await codeInput.type(code, { delay: Math.random() * 100 });
		await authButton.click();
		return true;
	} catch (e) {
		console.error("Couldn't solve Steam Guard");
		console.error(e);
		return false;
	}
}

export async function isLoggedIn(page: Page) {
	try {
		const avatar = await page.$(".avatar");
		return avatar != null;
	} catch (e) {
		console.error("Failed to verify login");
		throw e;
	}
}

export async function getBalance(page: Page): Promise<number> {
	const coinsWrapper: ElementHandle = await page.waitForSelector(
		".text-gold.font-bold.xl:text-sm"
	);

	const coins = (coinsWrapper as unknown as HTMLElement).firstChild as HTMLElement;
	return parseFloat(coins.innerHTML);
}

export async function getPreviousRolls(page: Page) {
	await page.waitForSelector(".previous-rolls-item");
	const rollDivs = await page.$$(".previous-rolls-item > div");
	return await Promise.all(
		rollDivs.map(async rollDiv => {
			const className = (
				await rollDiv.getProperty("className")
			).toString();
			if (className.includes("coin-t")) {
				return "t";
			} else if (className.includes("coin-ct")) {
				return "ct";
			} else {
				return "d";
			}
		})
	);
}

export async function closeWelcomeBackModal(page: Page) {
	console.log("Closing welcome back modal.");
	try {
		await page.evaluate(() => {
			const close: HTMLButtonElement | null = document.querySelector(
				".v--modal-close-button > button"
			);
			if (close != null) {
				close.click();
			}
		});
	} catch (e) {
		console.error("Failed to close Welcome back modal");
	}
}

export async function closeChat(page: Page) {
	console.log("Closing chat.");
	try {
		await page.evaluate(() => {
			const close: HTMLButtonElement | null = document.querySelector(
				".w-40.h-full.flex.items-center.justify-center.link"
			);
			if (close != null) {
				close.click();
			}
		});
	} catch (e) {
		console.error("Failed to close chat");
	}
}


export function getStrokesSinceBonus(rollsHistory: Roll[]) {
	const lastBonus = rollsHistory.find(roll => roll.winner === Side.Bonus);
	const lastBonusRound = lastBonus ? lastBonus.round : rollsHistory[0].round;
	return rollsHistory[rollsHistory.length - 1].round - lastBonusRound;
}

export interface Roll {
	winner: Side,
	round: number
}

export enum Side {
	T = "t",
	CT = "ct",
	Bonus = "bonus"
}
