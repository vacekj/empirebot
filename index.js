const pup = require("puppeteer");
const seq = require("sequelize");

async function main() {
	const browser = await pup.launch({
		executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
		headless: false,
		args: [
			"--disable-gpu"
		]
	});
	const page = await browser.newPage();

}

main();
