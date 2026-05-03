function pickColumns(body, columns) {
  return columns.reduce((acc, column) => {
    if (Object.prototype.hasOwnProperty.call(body, column)) {
      acc[column] = body[column] === "" ? null : body[column];
    }
    return acc;
  }, {});
}

function isTruthy(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

module.exports = { isTruthy, pickColumns };
