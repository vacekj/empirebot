import "reflect-metadata";
import { Connection, createConnection } from "typeorm";
import { BetResult } from "./entity/BetResult";

export default class DatabaseHandler {
	// @ts-ignore
	private connection: Connection;

	async init() {
		this.connection = await createConnection({
			type: "sqlite",
			database: "db.sqlite",
			entities: [BetResult]
		});
	}

	// @ts-ignore
	async insertBetResult(betResult: Partial<BetResult>) {
		try {

		} catch (e) {
			console.error("Failed to close Welcome back modal");
		}
	}

}
