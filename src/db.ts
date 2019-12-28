import { initializeApp, credential, firestore } from "firebase-admin";
import { Side } from "./lib";

interface BetResult {
	steam_id: string;
	target: Side;
	actual: Side;
	change: number;
}

export default class DatabaseHandler {
	private db: firestore.Firestore;

	async init() {
		let serviceAccount = require("../empirebot-9b58d-10d4c4242196.json");

		initializeApp({
			credential: credential.cert(serviceAccount)
		});

		this.db = firestore();
		console.log("Firestore initialized succesfully.");
	}

	async insertBetResult(betResult: BetResult) {
		try {
			const doc: any = await this.db.collection("betresults").add({
				...betResult,
				created_at: new Date().toUTCString()
			});
			console.log(`Db write success: ${doc.steam_id} | ${doc.change}`);
		} catch (e) {
			console.error("Failed to insert bet result to db");
		}
	}
}
