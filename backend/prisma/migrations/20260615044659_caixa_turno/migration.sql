-- CreateTable
CREATE TABLE "caixas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "fundo_abertura" INTEGER NOT NULL DEFAULT 0,
    "aberto_por" TEXT NOT NULL,
    "aberto_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_por" TEXT,
    "fechado_em" DATETIME,
    "valor_contado" INTEGER,
    "diferenca" INTEGER,
    "observacao" TEXT
);

-- CreateTable
CREATE TABLE "movimentos_caixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caixa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "por" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentos_caixa_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "caixas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "caixas_status_idx" ON "caixas"("status");
