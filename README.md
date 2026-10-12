# Sapia — válvula de 10 mm

Site estático (HTML, CSS e JavaScript puros), pronto para publicar na Vercel. Não precisa de build, de `npm install` nem de variáveis de ambiente.

Projeto de José Francisco Gonçalves Junior, estudante de Engenharia de Instrumentação, Automação e Robótica na UFABC.

## Publicar na Vercel

**Pelo GitHub (recomendado, atualiza sozinho a cada commit)**
1. Suba esta pasta para um repositório no GitHub (o `index.html` fica na raiz).
2. Em vercel.com, clique em Add New → Project e escolha o repositório.
3. Deixe o Framework Preset em "Other". Não preencha Build Command nem Output Directory.
4. Clique em Deploy.

**Pelo terminal**
    cd pasta-do-projeto
    npx vercel          # primeira vez: faz login e cria o projeto (teste)
    npx vercel --prod   # publica em produção

O arquivo `vercel.json` já ativa URLs limpas, cabeçalhos básicos de segurança e cache para imagens, scripts, estilos e STL.

## Testar localmente
    python3 -m http.server 8000      # dentro desta pasta, e abra http://localhost:8000
Não abre direto pelo arquivo (file://), porque o modelo 3D lê os STL por requisição.

## Abas
- **Modelo** (início, rosa e preto): imagens do modelo, uma projeção feita por inteligência artificial.
- **Água** (azul água e branco), **CO₂** (verde oliva e branco arenoso), **Gás** (vermelho e preto) e **Purga solar** (amarelo e azul).
  Cada uma tem a explicação do funcionamento, o simulador e o modelo 3D explodido. A flor do logo e as cores mudam com a aba.

## Arquivos
index.html · css/style.css · js/app.js (abas, temas e simuladores) · js/viewer.js (3D) · js/vendor/three.min.js (Three.js r128) · img/ (imagens) · stl/ (usados só pelo visualizador 3D; o site não tem links de download)
