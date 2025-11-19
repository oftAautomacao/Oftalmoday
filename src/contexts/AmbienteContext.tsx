import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Database, getDatabase } from 'firebase/database';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfigs } from '../firebase/config';

type Ambiente = 'producao' | 'teste-b720c';

interface AmbienteContextData {
  ambiente: Ambiente;
  database: Database | null;
  atualizarAmbiente: (novoAmbiente: Ambiente) => void;
  carregando: boolean;
  erro: string | null;
  inicializado: boolean;
}

const AmbienteContext = createContext<AmbienteContextData>({
  ambiente: 'producao',
  database: null,
  atualizarAmbiente: () => {},
  carregando: true,
  erro: null,
  inicializado: false
});

export const useAmbiente = () => useContext(AmbienteContext);

export const AmbienteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ambiente, setAmbiente] = useState<Ambiente>('producao');
  const [database, setDatabase] = useState<Database | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [inicializado, setInicializado] = useState(false);


  const inicializarFirebase = useCallback(async (ambiente: Ambiente) => {
    try {
      setCarregando(true);
      setErro(null);

      const config = firebaseConfigs[ambiente];
      const appName = `app-${ambiente}`;
      let novaApp;

      // Verifica se já existe um app com esse nome
      const existingApp = getApps().find(app => app.name === appName);
      if (existingApp) {
        novaApp = getApp(appName);
      } else {
        novaApp = initializeApp(config, appName);
      }
      const novaDatabase = getDatabase(novaApp);


      setDatabase(novaDatabase);
      setAmbiente(ambiente);

      // Salva a preferência no localStorage
      localStorage.setItem('ambiente', ambiente);

      return true;
    } catch (error) {
      console.error('[AmbienteContext] Erro ao inicializar Firebase:', error);
      setErro(`Falha ao conectar ao ambiente ${ambiente}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return false;
    } finally {
      setCarregando(false);
    }
  }, []);

  const atualizarAmbiente = useCallback(async (novoAmbiente: Ambiente) => {
    if (novoAmbiente === ambiente) return;
    
    // console.log(`[AmbienteContext] Solicitada mudança para o ambiente: ${novoAmbiente}`);
    const sucesso = await inicializarFirebase(novoAmbiente);
    
    if (sucesso) {
      // console.log(`[AmbienteContext] Ambiente alterado com sucesso para: ${novoAmbiente}`);
      // Força um pequeno atraso para garantir que todos os componentes sejam notificados
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      console.error(`[AmbienteContext] Falha ao alterar para o ambiente: ${novoAmbiente}`);
    }
  }, [ambiente, inicializarFirebase]);

  // Efeito para carregar o ambiente salvo ao iniciar
  useEffect(() => {
    const carregarAmbienteInicial = async () => {
      try {
        setCarregando(true);
        const ambienteSalvo = localStorage.getItem('ambiente') as Ambiente | null;
        const ambienteInicial = (ambienteSalvo && (ambienteSalvo === 'producao' || ambienteSalvo === 'teste-b720c')) 
          ? ambienteSalvo 
          : 'producao';
        
        const sucesso = await inicializarFirebase(ambienteInicial);
        if (sucesso) {
          setInicializado(true);
        }
      } catch (error) {
        console.error('[AmbienteContext] Erro ao carregar ambiente:', error);
        setErro('Erro ao carregar as configurações do ambiente.');
      } finally {
        setCarregando(false);
      }
    };

    carregarAmbienteInicial();
  }, [inicializarFirebase]);

  // Renderiza um loader enquanto está carregando e não está inicializado
  if (!inicializado && carregando) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div>Inicializando ambiente...</div>
        {erro && <div style={{ color: 'red' }}>{erro}</div>}
      </div>
    );
  }

  return (
    <AmbienteContext.Provider 
      value={{ 
        ambiente, 
        database, 
        atualizarAmbiente, 
        carregando, 
        erro,
        inicializado 
      }}
    >
      {children}
    </AmbienteContext.Provider>
  );
};
