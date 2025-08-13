# Painel de Controle - OftalmoDay

Este é um painel de controle desenvolvido para o setor de call-center da OftalmoDay - Dr. Antonio Lobo. O sistema permite visualizar os números de telefone que tiveram erro no envio de confirmação e gerenciar os números bloqueados para não receberem mais mensagens.

## Funcionalidades

- Visualização de números com erro no envio de confirmação
- Bloqueio de números para não receberem mais mensagens
- Alternância entre ambientes de teste e produção
- Interface moderna e responsiva

## Configuração do Ambiente

### Pré-requisitos

- Node.js (versão 16 ou superior)
- npm (geralmente vem com o Node.js)
- Conta no Firebase com acesso ao projeto

### Instalação

1. Clone o repositório ou faça o download dos arquivos
2. Navegue até a pasta do projeto:
   ```bash
   cd caminho/para/o/projeto
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```

## Configuração do Firebase

O aplicativo já vem pré-configurado com as credenciais de teste e produção fornecidas. As configurações estão no arquivo `src/firebase/config.ts`.

## Executando o Projeto

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:5173`

## Build para Produção

Para criar uma versão otimizada para produção:

```bash
npm run build
```

Os arquivos de produção serão gerados na pasta `dist/`.

## Deploy no Firebase Hosting

1. Instale a CLI do Firebase:
   ```bash
   npm install -g firebase-tools
   ```

2. Faça login no Firebase:
   ```bash
   firebase login
   ```

3. Inicialize o Firebase Hosting (se ainda não tiver feito):
   ```bash
   firebase init hosting
   ```

4. Faça o deploy:
   ```bash
   firebase deploy --only hosting
   ```

## Uso

1. **Erros de Confirmação**:
   - Acesse a aba "Erros de Confirmação" para visualizar os números que tiveram erro no envio
   - Clique em "Bloquear" ao lado de um número para adicioná-lo à lista de bloqueados

2. **Telefones Bloqueados**:
   - Acesse a aba "Telefones Bloqueados" para ver todos os números bloqueados
   - Use o campo de texto para adicionar manualmente um número à lista de bloqueados

3. **Alternar entre Ambientes**:
   - Use o switch no canto superior direito para alternar entre os ambientes de teste e produção

## Estrutura do Projeto

- `src/` - Código-fonte do projeto
  - `App.tsx` - Componente principal
  - `firebase/` - Configurações e utilitários do Firebase
  - `index.css` - Estilos globais
  - `main.tsx` - Ponto de entrada da aplicação

## Licença

Este projeto é para uso exclusivo da OftalmoDay - Dr. Antonio Lobo.
