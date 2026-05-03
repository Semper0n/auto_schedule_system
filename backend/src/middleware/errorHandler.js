function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error.code === "23503") {
    return res.status(409).json({
      error: "Запись используется в связанных данных и не может быть удалена",
      details: error.detail,
    });
  }
  if (error.code === "23505") {
    return res.status(409).json({
      error: "Такая запись уже существует",
      details: error.detail,
    });
  }
  if (error.code === "22P02") {
    return res.status(400).json({
      error: "Некорректный тип данных в одном из полей",
      details: error.message,
    });
  }
  res.status(500).json({
    error: "Ошибка сервера",
    details: error.message,
  });
}

module.exports = { errorHandler };
