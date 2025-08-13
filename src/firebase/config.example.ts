import { FirebaseOptions } from 'firebase/app';

// Este é um arquivo de exemplo. Crie um arquivo config.ts com suas próprias credenciais.
// Não faça commit do arquivo config.ts no controle de versão.

export const firebaseConfigs: { [key: string]: FirebaseOptions } = {
  teste: {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto-teste.firebaseapp.com",
    databaseURL: "https://seu-projeto-teste-default-rtdb.firebaseio.com",
    projectId: "seu-projeto-teste",
    storageBucket: "seu-projeto-teste.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef"
  },
  producao: {
    apiKey: "SUA_API_KEY_DE_PRODUCAO_AQUI",
    authDomain: "seu-projeto-prod.firebaseapp.com",
    databaseURL: "https://seu-projeto-prod-default-rtdb.firebaseio.com",
    projectId: "seu-projeto-prod",
    storageBucket: "seu-projeto-prod.appspot.com",
    messagingSenderId: "987654321098",
    appId: "1:987654321098:web:abcdef1234567890abcdef"
  }
};
