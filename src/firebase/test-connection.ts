import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

// Configurações para os ambientes de teste e produção
const firebaseConfigs = {
  teste: {
    apiKey: "AIzaSyBTSTqEZARRrIOPwtTcysbw5RjjvXFuFDw",
    databaseURL: "https://teste-b720c-default-rtdb.firebaseio.com"
  },
  producao: {
    apiKey: "AIzaSyDseoXikJofokNkYoU-Sm6wf_N9EIZbmrs",
    databaseURL: "https://oftautomacao-9b427-default-rtdb.firebaseio.com"
  }
};

async function testConnection() {
  console.log('Iniciando teste de conexão...');
  
  // Testa primeiro o ambiente de produção
  console.log('\n=== Testando ambiente de PRODUÇÃO ===');
  await testEnvironment('producao');
  
  // Depois testa o ambiente de teste
  console.log('\n=== Testando ambiente de TESTE ===');
  await testEnvironment('teste');
}

async function testEnvironment(env: 'teste' | 'producao') {
  try {
    console.log(`\nInicializando Firebase (${env})...`);
    const app = initializeApp(firebaseConfigs[env], `test-${Date.now()}`);
    const db = getDatabase(app);
    
    console.log('Tentando acessar o nó raiz...');
    const rootRef = ref(db, '/');
    const snapshot = await get(rootRef);
    
    if (snapshot.exists()) {
      console.log('✅ Conexão bem-sucedida!');
      console.log('Dados do nó raiz:', snapshot.val());
    } else {
      console.log('⚠️  Nenhum dado encontrado no nó raiz');
    }
    
    // Tenta acessar o caminho específico
    console.log('\nTentando acessar o caminho específico...');
    const specificRef = ref(db, '/OFT/45/confirmacaoPacientes/erro');
    const specificSnapshot = await get(specificRef);
    
    if (specificSnapshot.exists()) {
      console.log('✅ Dados encontrados no caminho específico');
      console.log('Primeiros dados:', JSON.stringify(specificSnapshot.val(), null, 2).split('\n').slice(0, 10).join('\n') + '\n...');
    } else {
      console.log('⚠️  Nenhum dado encontrado no caminho específico');
    }
    
  } catch (error: unknown) {
    console.error('❌ Erro ao conectar ao Firebase:', error);
    
    if (error && typeof error === 'object') {
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code) console.error('Código do erro:', firebaseError.code);
      if (firebaseError.message) console.error('Mensagem:', firebaseError.message);
    } else {
      console.error('Erro desconhecido:', String(error));
    }
  }
}

// Executa o teste
testConnection().catch(console.error);
