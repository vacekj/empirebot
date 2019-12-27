import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { Side } from "../lib";

@Entity()
export class BetResult {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	steam_id: string;

	@Column("double")
	profit: number;

	@Column()
	target: Side;

	@Column()
	actual: Side;
}
