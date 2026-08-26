# GRIDIRON LIFE

Um simulador de carreira e vida de futebol americano — do liceu ao Hall of Fame.

## Como jogar (mais fácil): pasta `jogar-offline/`

Se abriste o `index.html` na raiz do projeto e ficou tudo branco, é porque
esse `index.html` é o ficheiro-fonte do Vite (referencia `/src/main.tsx`
diretamente, com TypeScript e JSX) — os browsers não conseguem correr isso
sem passar primeiro por um bundler. **Não é esse o ficheiro para abrir.**

Em vez disso, dentro da pasta `jogar-offline/` há uma versão já compilada e
pronta a usar:

1. Abre a pasta `jogar-offline/`.
2. Faz duplo-clique em `index.html`.
3. Deve abrir diretamente no teu browser, já com o ecrã de login.
4. Conta de demonstração: utilizador `adm`, password `adm` (já vem com
   assinatura ativa, para não teres de passar pelo ecrã de pagamento).

Se o teu browser bloquear o duplo-clique (alguns têm políticas mais
restritas para ficheiros abertos localmente), corre um servidor local de
um único comando dentro dessa pasta e abre o link que ele indicar:

```bash
cd jogar-offline
python3 -m http.server 8000
# depois abre http://localhost:8000 no browser
```

ou, se tiveres Node instalado:

```bash
cd jogar-offline
npx serve .
```

## Desenvolver (para quem quer mexer no código)

Este é o projeto completo, feito com Vite + React + TypeScript. Num
ambiente normal com acesso à npm registry:

```bash
npm install
npm run dev       # servidor de desenvolvimento com hot-reload
npm run build     # build de produção para dist/
npm run test      # testes automatizados
```

Ver `GAME_DESIGN.md` para a arquitetura completa do jogo (motor de eventos,
simulação de jogos, sistema de contas/assinatura, etc.) e `DATABASE_SCHEMA.md`
para o esquema de dados pensado para uma futura integração com Supabase.

## Nota sobre a pasta `jogar-offline/`

Essa pasta é gerada a partir do código-fonte em `src/` (ver
`tools/sandbox/esbuild-build.mjs`) — não é o código "principal" do projeto,
é apenas uma cópia pré-compilada para poderes jogar imediatamente sem
instalar nada. Qualquer alteração ao jogo deve ser feita em `src/`; para
gerar uma nova versão de `jogar-offline/` depois de alterar o código,
corre `npm run build:sandbox` (ou `npm run build` num ambiente com Vite) e
copia o resultado para lá.
