-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mesas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVRE',
    "taxa_ativa" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_mesas" ("id", "numero", "status") SELECT "id", "numero", "status" FROM "mesas";
DROP TABLE "mesas";
ALTER TABLE "new_mesas" RENAME TO "mesas";
CREATE UNIQUE INDEX "mesas_numero_key" ON "mesas"("numero");
CREATE TABLE "new_pagamentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mesa_id" INTEGER,
    "pedido_id" INTEGER,
    "forma" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "liquidado" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagamentos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pagamentos" ("criado_em", "forma", "id", "mesa_id", "valor") SELECT "criado_em", "forma", "id", "mesa_id", "valor" FROM "pagamentos";
DROP TABLE "pagamentos";
ALTER TABLE "new_pagamentos" RENAME TO "pagamentos";
CREATE INDEX "pagamentos_criado_em_idx" ON "pagamentos"("criado_em");
CREATE TABLE "new_pedidos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'MESA',
    "mesa_id" INTEGER,
    "cliente_nome" TEXT,
    "cliente_telefone" TEXT,
    "cliente_endereco" TEXT,
    "taxa_entrega" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "taxa_servico" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "forma_pagamento" TEXT,
    "motivo_cancelamento" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pedidos" ("criado_em", "forma_pagamento", "id", "mesa_id", "motivo_cancelamento", "status", "taxa_servico", "total") SELECT "criado_em", "forma_pagamento", "id", "mesa_id", "motivo_cancelamento", "status", "taxa_servico", "total" FROM "pedidos";
DROP TABLE "pedidos";
ALTER TABLE "new_pedidos" RENAME TO "pedidos";
CREATE INDEX "pedidos_status_idx" ON "pedidos"("status");
CREATE INDEX "pedidos_tipo_idx" ON "pedidos"("tipo");
CREATE INDEX "pedidos_criado_em_idx" ON "pedidos"("criado_em");
CREATE TABLE "new_produtos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "preco" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_produtos" ("categoria", "id", "nome", "preco") SELECT "categoria", "id", "nome", "preco" FROM "produtos";
DROP TABLE "produtos";
ALTER TABLE "new_produtos" RENAME TO "produtos";
CREATE TABLE "new_usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_usuarios" ("id", "nome", "papel", "pin_hash") SELECT "id", "nome", "papel", "pin_hash" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
