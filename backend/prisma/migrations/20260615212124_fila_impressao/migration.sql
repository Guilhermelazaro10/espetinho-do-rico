-- CreateTable
CREATE TABLE "print_jobs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "ref_id" INTEGER,
    "conteudo" TEXT NOT NULL,
    "abrir_gaveta" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "print_jobs_status_idx" ON "print_jobs"("status");
