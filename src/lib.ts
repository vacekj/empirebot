import { Page } from "puppeteer";

import { logger } from "./index";

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
		logger.error("Failed to log in");
		logger.error(e);
		return {
			success: false,
			alreadyLoggedIn: false
		};
	}
}

export async function steamGuardNeeded(page: Page) {
	return !page.url().includes("https://csgoempire.com");
}

export async function isLoggedIn(page: Page) {
	try {
		const avatar = await page.$(".avatar");
		return avatar != null;
	} catch (e) {
		logger.error("Failed to verify login");
		throw e;
	}
}

export async function closeWelcomeBackModal(page: Page) {
	logger.info("Closing welcome back modal.");
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
		logger.error("Failed to close Welcome back modal");
	}
}

export function getStrokesSinceBonus(rollsHistory: Roll[], countFromBonus = true) {
	const lastBonus = rollsHistory.filter(roll => roll.winner === Side.Bonus).sort((a, b) => {
		return b.round - a.round;
	})[0];
	if (!lastBonus && countFromBonus) {
		return -1;
	}
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
