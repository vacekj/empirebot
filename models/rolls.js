'use strict';
module.exports = (sequelize, DataTypes) => {
  const Rolls = sequelize.define('Rolls', {
    result: DataTypes.INTEGER,
    index: DataTypes.INTEGER,
    scannedAt: DataTypes.INTEGER
  }, {});
  Rolls.associate = function(models) {
    // associations can be defined here
  };
  return Rolls;
};