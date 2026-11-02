-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "pago_antecipado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "configuracoes" (
    "chave" TEXT NOT NULL PRIMARY KEY,
    "valor" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL
);
