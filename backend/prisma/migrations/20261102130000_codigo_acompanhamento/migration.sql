-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "codigo_acompanhamento" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_codigo_acompanhamento_key" ON "pedidos"("codigo_acompanhamento");

