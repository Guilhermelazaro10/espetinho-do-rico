# Como subir o PDV para o GitHub e passar para outro notebook

## O que vai para o GitHub

O GitHub deve receber apenas o codigo-fonte do sistema:

- `backend`
- `frontend`
- `desktop`
- `scripts`
- `package.json`
- `package-lock.json`
- `backend/.env.example`

Nao envie estas pastas/arquivos no commit:

- `node_modules`
- `dist-desktop`
- `frontend/dist`
- banco local `backend/prisma/dev.db`
- arquivos `.exe` gerados

Esses arquivos sao gerados novamente por comandos.

O `.exe` pronto deve ir em uma Release do GitHub, pendrive ou Google Drive.

## Passo 1 - Criar o repositorio no GitHub

1. Entre em https://github.com
2. Clique em `New repository`
3. Nome sugerido:

```text
espetinho-do-rico-pdv
```

4. Deixe como `Private`, se nao quiser expor o projeto.
5. Nao marque README, .gitignore ou license, porque o projeto ja tem arquivos.
6. Clique em `Create repository`.

## Passo 2 - Enviar o codigo

No PowerShell, dentro da pasta do projeto:

```powershell
cd "$env:USERPROFILE\Desktop\PVD"
git remote add origin https://github.com/SEU_USUARIO/espetinho-do-rico-pdv.git
git branch -M main
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuario do GitHub.

## Passo 3 - Passar o instalador para o notebook do seu pai

O instalador `.exe` tem quase 200 MB. Nao coloque ele dentro do commit, porque o GitHub bloqueia arquivos grandes.

Use uma destas opcoes:

### Opcao A - GitHub Release

1. Entre no repositorio no GitHub.
2. Clique em `Releases`.
3. Clique em `Draft a new release`.
4. Tag:

```text
v1.0.5
```

5. Titulo:

```text
Espetinho do Rico PDV 1.0.5
```

6. Anexe um destes arquivos:

```text
$env:USERPROFILE\Desktop\PVD\dist-desktop\Espetinho do Rico PDV Setup 1.0.5.exe
```

ou

```text
$env:USERPROFILE\Desktop\PVD\dist-desktop\Espetinho do Rico PDV 1.0.5.exe
```

7. Clique em `Publish release`.

No notebook do seu pai, basta baixar o `.exe` pela pagina da Release.

### Opcao B - Pendrive ou Google Drive

Copie este arquivo:

```text
$env:USERPROFILE\Desktop\PVD\dist-desktop\Espetinho do Rico PDV Setup 1.0.5.exe
```

e rode no notebook dele.

## Passo 4 - Rodar pelo codigo no notebook dele

Se ele quiser rodar pelo codigo-fonte:

```powershell
git clone https://github.com/SEU_USUARIO/espetinho-do-rico-pdv.git
cd espetinho-do-rico-pdv
npm install
npm install --prefix backend
Copy-Item backend\.env.example backend\.env
npm run seed
npm run desktop:dist
```

O instalador novo vai aparecer em:

```text
dist-desktop
```

## Observacao importante

Para uso simples no notebook dele, o melhor caminho e baixar o instalador pela Release. Ele nao precisa instalar Node.js nem mexer com comandos.
