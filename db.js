const { Sequelize, Model, DataTypes } = require('sequelize');


const sequelize = new Sequelize('gibsqlborecc2228', 'gibsqlborecc2228', 'Ahoj1234', {
	host: 'sql2.webzdarma.cz',
	dialect: 'mysql'
});

class BetResult extends Model {
}

BetResult.init({
	steam_id: DataTypes.STRING,
	profit: DataTypes.FLOAT,
	target: DataTypes.STRING,
	actual: DataTypes.STRING
}, { sequelize: sequelize });

async function insertBetResult(betResult) {
	try {
		await sequelize.sync()
			.then(() => {
				BetResult.create(betResult);
			})
			.then((betResult) => {
				console.log("Insert bet result: " + betResult.toJSON());
			});

	} catch (e) {
		console.error("Failed to close Welcome back modal");
	}
}

module.exports = {
	insertBetResult
};
