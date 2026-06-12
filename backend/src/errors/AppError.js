// Erro operacional esperado (validação, não-encontrado, regra de negócio).
// Tudo que NÃO for AppError é tratado como erro inesperado (500) pelo middleware.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
