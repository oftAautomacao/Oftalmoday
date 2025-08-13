import React, { useState } from 'react';
import { ref, get } from 'firebase/database';
import { useAmbiente } from './contexts/AmbienteContext';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';

const FirebaseTest: React.FC = () => {
  const { database } = useAmbiente();
  const [status, setStatus] = useState('Preparando para testar a conexão...');
  const [loading, setLoading] = useState(false);
  const [connectionData, setConnectionData] = useState<any>(null);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testando conexão com o Firebase...');
    setConnectionData(null);

    // Verifica se o banco de dados está disponível
    if (!database) {
      setStatus('❌ Erro: Banco de dados não inicializado. Por favor, verifique a conexão.');
      setLoading(false);
      return;
    }

    try {
      // Testa o nó raiz
      setStatus(prev => prev + '\n\n🔍 Acessando o nó raiz...');
      const rootRef = ref(database, '/');
      const rootSnapshot = await get(rootRef);
      
      let result = {
        rootData: rootSnapshot.exists() ? rootSnapshot.val() : 'Nenhum dado encontrado',
        specificPathData: null as any,
        error: null as any
      };

      // Tenta acessar o caminho específico
      try {
        setStatus(prev => prev + '\n\n🔍 Acessando o caminho específico...');
        const specificRef = ref(database, '/OFT/45/confirmacaoPacientes/erro');
        const specificSnapshot = await get(specificRef);
        
        if (specificSnapshot.exists()) {
          result.specificPathData = specificSnapshot.val();
          setStatus(prev => prev + '\n✅ Dados encontrados no caminho específico!');
        } else {
          setStatus(prev => prev + '\n⚠️ Nenhum dado encontrado no caminho específico');
        }
      } catch (error) {
        const specificError = error instanceof Error ? error : new Error(String(error));
        console.error('Erro ao acessar caminho específico:', specificError);
        result.error = specificError;
        setStatus(prevStatus => `${prevStatus}\n❌ Erro ao acessar caminho específico: ${specificError.message}`);
      }

      setConnectionData(result);
      setStatus(prevStatus => `✅ Teste concluído com sucesso!${prevStatus}`);
    } catch (error: unknown) {
      console.error('Erro ao conectar ao Firebase:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setStatus(`❌ Falha na conexão com o Firebase:\n${errorMessage}`);
      setConnectionData({ error: error instanceof Error ? error : new Error(String(error)) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Teste de Conexão com o Firebase
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Status da Conexão
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Button 
            variant="contained" 
            onClick={testConnection}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Testando...' : 'Testar Conexão'}
          </Button>
        </Box>
        
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            backgroundColor: '#f5f5f5',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            minHeight: 100,
            maxHeight: 300,
            overflow: 'auto'
          }}
        >
          {status}
        </Paper>
      </Paper>
      
      {connectionData && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Resultados
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom>
            Dados do nó raiz:
          </Typography>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflowX: 'auto',
            maxHeight: '200px'
          }}>
            {JSON.stringify(connectionData.rootData, null, 2)}
          </pre>
          
          {connectionData.specificPathData && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2 }} gutterBottom>
                Dados do caminho específico:
              </Typography>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '4px',
                overflowX: 'auto',
                maxHeight: '200px'
              }}>
                {JSON.stringify(connectionData.specificPathData, null, 2)}
              </pre>
            </>
          )}
          
          {connectionData.error && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, color: 'error.main' }} gutterBottom>
                Detalhes do Erro:
              </Typography>
              <pre style={{ 
                backgroundColor: '#ffebee', 
                padding: '10px', 
                borderRadius: '4px',
                overflowX: 'auto',
                color: '#d32f2f',
                maxHeight: '200px'
              }}>
                {JSON.stringify(connectionData.error, null, 2)}
              </pre>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default FirebaseTest;
