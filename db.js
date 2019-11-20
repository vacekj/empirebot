const { Sequelize, Model } = require("sequelize");

class Roll extends Model {
}

class Round extends Model {
}

async function initialize() {
	const seq = new Sequelize({
		dialect: 'sqlite',
		storage: './db.sqlite'
	});
	await seq.authenticate();


	Roll.init({
		result: {
			type: Sequelize.STRING
		}
	}, {
		sequelize: seq,
		modelName: 'roll'
	});
	Roll.sync();

	return seq;
}

module.exports = { initialize, Roll};
