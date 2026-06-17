const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

function logDesktop(...partes) {
  const linha = `[${new Date().toISOString()}] ${partes.map(String).join(' ')}\n`;
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'desktop.log'), linha);
  } catch {
    // O log nunca deve impedir a abertura do PDV.
  }
}

function rootPath(...partes) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...partes)
    : path.join(__dirname, '..', ...partes);
}

function garantirBanco() {
  const dadosDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dadosDir, { recursive: true });

  const bancoDestino = path.join(dadosDir, 'pdv.db');
  const bancoSeed = rootPath('backend', 'prisma', 'dev.db');

  if (!fs.existsSync(bancoDestino) && fs.existsSync(bancoSeed)) {
    fs.copyFileSync(bancoSeed, bancoDestino);
  }

  logDesktop('database', bancoDestino);
  process.env.DATABASE_URL = `file:${bancoDestino.replace(/\\/g, '/')}`;
  return bancoDestino;
}

// Aplica migrações pendentes ao banco do usuário (resolve upgrade de versão
// com schema novo sem perder os dados existentes). Idempotente.
function migrarBanco() {
  const prismaCli = rootPath('backend', 'node_modules', 'prisma', 'build', 'index.js');
  const schema = rootPath('backend', 'prisma', 'schema.prisma');
  if (!fs.existsSync(prismaCli) || !fs.existsSync(schema)) {
    logDesktop('migrate_skip', 'prisma cli ou schema ausente');
    return;
  }
  const resultado = spawnSync(
    process.execPath,
    [prismaCli, 'migrate', 'deploy', '--schema', schema],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 60000 }
  );
  logDesktop(
    'migrate',
    `status=${resultado.status}`,
    (resultado.stdout || '').replace(/\s+/g, ' ').slice(-300),
    (resultado.stderr || '').replace(/\s+/g, ' ').slice(-300)
  );
}

async function iniciarServidor() {
  garantirBanco();
  migrarBanco();
  if (!process.env.JWT_SECRET) {
    const { obterOuCriarSegredo } = require(rootPath('backend', 'src', 'lib', 'segredo.js'));
    process.env.JWT_SECRET = obterOuCriarSegredo(
      path.join(app.getPath('userData'), 'pdv.secret')
    );
  }
  const port = Number(process.env.PORT || 3001);
  const url = `http://127.0.0.1:${port}`;

  process.env.NODE_ENV = 'production';
  process.env.FRONTEND_DIST = rootPath('frontend', 'dist');
  process.env.ALLOWED_ORIGINS = [
    url,
    `http://localhost:${port}`,
  ].join(',');
  process.env.ALLOW_LAN_ORIGINS = 'true';

  logDesktop('frontend_dist', process.env.FRONTEND_DIST);
  const expressApp = require(rootPath('backend', 'src', 'app.js'));
  const server = http.createServer(expressApp);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });

  logDesktop('server_started', url, 'lan_port', port);
  return { server, url };
}

async function criarJanela(url) {
  const sessao = BrowserWindow.getAllWindows();
  for (const aberta of sessao) aberta.close();

  const janela = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#3f2b1d',
    title: 'Espetinho do Rico - PDV',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await janela.webContents.session.clearCache();
  await janela.webContents.session.clearStorageData({
    storages: ['serviceworkers', 'cachestorage'],
  });

  janela.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  janela.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logDesktop('renderer_console', level, message, sourceId, line);
  });
  janela.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logDesktop('did_fail_load', errorCode, errorDescription, validatedURL);
  });
  janela.webContents.on('did-finish-load', () => {
    logDesktop('did_finish_load', janela.webContents.getURL());
  });

  if (!app.isPackaged || process.env.PDV_DEVTOOLS === 'true') {
    janela.webContents.openDevTools({ mode: 'detach' });
  }

  const health = await new Promise((resolve) => {
    http
      .get(`${url}/health`, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on('error', (erro) => resolve(`erro:${erro.message}`));
  });
  logDesktop('health_before_load', health);

  await janela.loadURL(url);

  setTimeout(async () => {
    if (janela.isDestroyed()) return;
    try {
      const estado = await janela.webContents.executeJavaScript(
        `({
          url: location.href,
          title: document.title,
          bodyText: document.body?.innerText?.slice(0, 200) || '',
          rootChildren: document.getElementById('root')?.children?.length || 0,
          scripts: Array.from(document.scripts).map((s) => s.src)
        })`
      );
      logDesktop('renderer_state', JSON.stringify(estado));

      if (estado.rootChildren === 0) {
        await janela.webContents.executeJavaScript(`
          document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#3f2b1d;color:#fffcf7;font-family:Inter,Arial,sans-serif;padding:32px;text-align:center"><div><h1 style="margin:0 0 12px;font-size:28px">PDV carregou, mas a interface nao iniciou</h1><p style="margin:0 0 8px">Feche e abra novamente. Se continuar, envie o arquivo desktop.log.</p><p style="opacity:.7;font-size:13px">${url}</p></div></div>';
        `);
      }
    } catch (erro) {
      logDesktop('renderer_state_error', erro.message);
    }
  }, 3500);
}

let servidor = null;

app.whenReady().then(async () => {
  try {
    servidor = await iniciarServidor();
    await criarJanela(servidor.url);
  } catch (erro) {
    const mensagem =
      erro.code === 'EADDRINUSE'
        ? 'A porta 3001 ja esta em uso. Feche outro PDV aberto ou pare o modo telefone antes de abrir novamente.'
        : `${erro.message}\n\nVerifique se o aplicativo tem permissao para gravar dados locais.`;

    dialog.showErrorBox(
      'Falha ao iniciar o PDV',
      mensagem
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (servidor?.server) servidor.server.close();
  app.quit();
});
