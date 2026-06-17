# Gerar o APK Android — Espetinho do Rico (Garçom)

O app nativo é o **mesmo frontend React**, empacotado com **Capacitor**. O shell
fica dentro do aparelho, então **trocar o IP do roteador não exige reinstalar** —
o app só guarda o endereço do PDV (configurável na primeira abertura).

## Pré-requisito (uma vez)

Instalar o **Android Studio** (traz o Android SDK):
https://developer.android.com/studio

Na primeira execução, deixe ele baixar o **Android SDK** e aceite as licenças.
O `JAVA` já está instalado nesta máquina (Java 25).

## Build do APK

No `frontend/`:

```powershell
# 1. Compila o React e copia para o projeto Android
npm run apk:sync

# 2a. Abre no Android Studio → menu Build > Build APK(s)
npm run apk:open
```

Ou tudo pela linha de comando (depois do SDK instalado e `ANDROID_HOME` setado):

```powershell
npm run apk:build
```

O APK sai em:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## Instalar no celular

1. Copie o `app-debug.apk` para o celular (USB, Drive, WhatsApp Web…).
2. No celular: ative **"Instalar apps de fontes desconhecidas"** e toque no arquivo.
3. Abra o app → ele **procura o PDV na rede automaticamente**. Na primeira vez,
   se não achar, use **"Procurar o PDV na rede"** ou informe o **IP** + porta **3001**.
4. Faça login com o PIN.

## Descoberta automática (Fase 2)

O app não fica preso a um IP:

- **Ao abrir**, tenta o último endereço usado; se não responder (o roteador trocou
  o IP do desktop), **varre a sub-rede** e reencontra o PDV sozinho em segundos.
- Botão **"Procurar o PDV na rede"** faz uma busca ampla (sub-redes comuns) — útil
  na primeira instalação ou se trocar de rede.
- O PDV é identificado pela assinatura em `GET /health` (`app: "espetinho-pdv"`),
  então o app não conecta por engano em outro dispositivo.
- Botão **"Trocar servidor"** na tela de login força reconfigurar.

> Dica: uma **reserva de IP fixo no roteador** (DHCP) para o desktop deixa tudo
> ainda mais estável — o IP nunca muda e nem a varredura é necessária.

## No desktop (servidor)

- Deixe o **backend rodando**: no `backend/`, `npm run dev` (ou `npm start`).
- **Mesma rede Wi‑Fi** entre celular e desktop.
- **Liberar o firewall**: na primeira vez que o Node escutar na rede, o Windows
  pede permissão — marque **Redes privadas** e permita. (Se não aparecer, crie uma
  regra de entrada para a porta **3001/TCP**.)
- Descubra o IP do desktop com `ipconfig` (procure o **IPv4**, algo como
  `192.168.x.x`). É esse IP que vai na tela "Conectar ao PDV".

> Dica: o backend expõe `GET /api/rede`, que lista os IPs da máquina — útil para
> mostrar o endereço na tela do PDV desktop.

## Sempre que mudar o frontend

Rebuild + sync antes de gerar o APK de novo:

```powershell
npm run apk:sync
```

## Detalhes técnicos

- **Endereço do servidor**: salvo em `localStorage` (`pdv.servidor`). Trocável pelo
  botão **"Trocar servidor"** na tela de login do app nativo.
- **CapacitorHttp** ligado (`capacitor.config.json`): as chamadas de API passam pela
  camada nativa, contornando CORS / mixed-content. Cleartext HTTP liberado para a LAN
  em `android/app/src/main/res/xml/network_security_config.xml`.
- **Tempo real**: no app nativo usamos polling (8s); SSE fica só no navegador.
- **appId**: `com.espetinhodorico.pdv` — ajuste em `capacitor.config.json` se quiser.
</content>
