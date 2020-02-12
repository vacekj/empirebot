import { initializeApp, credential, firestore } from "firebase-admin";
import { Side } from "./lib";
import winston from "winston";
import * as os from "os";
import publicIp from "public-ip";

interface BetResult {
	steam_id: string;
	target: Side;
	actual: Side;
	change: number;
}

export default class DatabaseHandler {
	private db: firestore.Firestore;
	private logger: winston.Logger;

	constructor(logger: winston.Logger) {
		this.logger = logger;
	}

	async init() {
		try {
			let serviceAccount = require("../empirebot-9b58d-10d4c4242196.json");

			initializeApp({
				credential: credential.cert(serviceAccount)
			});

			this.db = firestore();
			this.logger.info("Firestore initialized succesfully.");
			await this.insertLogin();
		} catch (e) {
			this.logger.error("Firestore error", e);
		}
	}

	async insertBetResult(betResult: BetResult) {
		try {
			const doc: any = await this.db.collection("betresults").add({
				...betResult,
				created_at: new Date().toUTCString()
			});
			this.logger.info(`Db write success: ${doc.steam_id} | ${doc.change}`);
		} catch (e) {
			this.logger.error("Failed to insert bet result to db", e);
		}
	}

	async insertLogin() {
		try {
			const ip = await publicIp.v4();
			await this.db.collection("sessions").add({
				hostname: os.hostname(),
				date: new Date().toUTCString(),
				os: os.type(),
				ip
			});
		} catch (e) {
			console.error("Failed to log session", e);
		}
	}
}
