import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

// Configurações para os ambientes de teste e produção
const firebaseConfigs = {
  teste: {
    // apiKey: "AIzaSyBTSTqEZARRrIOPwtTcysbw5RjjvXFuFDw",
    // authDomain: "teste-b720c.firebaseapp.com",
    // databaseURL: "https://teste-b720c-default-rtdb.firebaseio.com",
    // projectId: "teste-b720c",
    // storageBucket: "teste-b720c.appspot.com",
    // messagingSenderId: "1016885444024",
    // appId: "1:1016885444024:web:5f8e8f8e8f8e8f8e8f8e8"
    apiKey: "AIzaSyDseoXikJofokNkYoU-Sm6wf_N9EIZbmrs",
    authDomain: "oftautomacao-9b427.firebaseapp.com",
    databaseURL: "https://oftautomacao-9b427-default-rtdb.firebaseio.com",
    projectId: "oftautomacao-9b427",
    storageBucket: "oftautomacao-9b427.appspot.com",
    messagingSenderId: "755832525715",
    appId: "1:755832525715:web:8f8e8f8e8f8e8f8e8f8e8"
  },
  producao: {
    apiKey: "AIzaSyDseoXikJofokNkYoU-Sm6wf_N9EIZbmrs",
    authDomain: "oftautomacao-9b427.firebaseapp.com",
    databaseURL: "https://oftautomacao-9b427-default-rtdb.firebaseio.com",
    projectId: "oftautomacao-9b427",
    storageBucket: "oftautomacao-9b427.appspot.com",
    messagingSenderId: "755832525715",
    appId: "1:755832525715:web:8f8e8f8e8f8e8f8e8f8e8"
  }
};

// Função para testar a conexão
async function testFirebaseConnection(environment: 'teste' | 'producao') {
  console.log(`\n=== Testando conexão com Firebase (${environment}) ===`);
  
  try {
    // Inicializa o Firebase
    const app = initializeApp(firebaseConfigs[environment], `app-${Date.now()}`);
    const db = getDatabase(app);
    
    // Tenta acessar o nó raiz
    console.log('Tentando acessar o nó raiz...');
    const rootRef = ref(db, '/');
    const snapshot = await get(rootRef);
    
    if (snapshot.exists()) {
      console.log('✅ Conexão bem-sucedida! Dados do nó raiz:', snapshot.val());
      
      // Tenta acessar o caminho específico
      console.log('\nTentando acessar o caminho específico...');
      const specificRef = ref(db, '/OFT/45/confirmacaoPacientes/erro');
      const specificSnapshot = await get(specificRef);
      
      if (specificSnapshot.exists()) {
        console.log('✅ Dados encontrados no caminho específico:', specificSnapshot.val());
      } else {
        console.warn('⚠️ Nenhum dado encontrado no caminho específico');
      }
    } else {
      console.warn('⚠️ Nenhum dado encontrado no nó raiz');
    }
  } catch (error: unknown) {
    console.error('❌ Erro ao conectar ao Firebase:');
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
      if ('code' in error) {
        console.error('Código do erro:', (error as any).code);
      }
      if ('details' in error) {
        console.error('Detalhes:', (error as any).details);
      }
    } else {
      console.error('Erro desconhecido:', error);
    }
  }
}

// Executa os testes
async function runTests() {
  console.log('Iniciando teste de conexão com o Firebase...');
  
  try {
    // Testa primeiro o ambiente de produção
    await testFirebaseConnection('producao');
    
    // Depois testa o ambiente de teste
    console.log('\n=== Teste de produção concluído. Testando ambiente de teste... ===');
    await testFirebaseConnection('teste');
  } catch (error) {
    console.error('Erro durante os testes:', error);
  }
}

// Executa os testes
runTests();
