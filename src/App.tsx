import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { 
  ThemeProvider, 
  CssBaseline, 
  Snackbar, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { AmbienteProvider } from './contexts/AmbienteContext';
import { ConfirmProvider } from 'material-ui-confirm';
import theme from './theme';
import Principal from './pages/Principal';
import ConfirmacaoPacientes from './components/ConfirmacaoPacientes';
import ReconfirmacaoPacientes from './components/ReconfirmacaoPacientes';
import Controle from './pages/Controle';
import { useEffect, useState } from 'react';

// Componente para exibir notificações de status da rede
function NetworkStatusNotifier() {
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [prevStatus, setPrevStatus] = useState<boolean | null>(null);

  useEffect(() => {
    // Só mostra o aviso quando o status mudar
    if (prevStatus !== null && prevStatus !== isOnline) {
      setOpen(true);
    }
    setPrevStatus(isOnline);
  }, [isOnline, prevStatus]);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert 
        onClose={handleClose} 
        severity={isOnline ? 'success' : 'error'}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {isOnline ? 'Conexão restabelecida!' : 'Você está offline. Algumas funcionalidades podem não estar disponíveis.'}
      </Alert>
    </Snackbar>
  );
}

// Componente para tratamento de erros globais
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      // Aqui você pode adicionar um serviço de log de erros
      console.error('Erro não tratado:', event.error);
    };

    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (hasError) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh',
        p: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h4" color="error" gutterBottom>
          Ocorreu um erro inesperado
        </Typography>
        <Typography variant="body1" paragraph>
          Pedimos desculpas pelo transtorno. Por favor, tente recarregar a página.
        </Typography>
        <Button 
          component={Link} 
          to="/principal" 
          variant="contained" 
          color="primary" 
          onClick={() => window.location.reload()}
          startIcon={<RefreshIcon />}
        >
          Recarregar Página
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
}

// Componente principal da aplicação
function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Configura o service worker para PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(
          (registration) => {
            console.log('ServiceWorker registration successful');
            
            // Verifica se há uma atualização disponível
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setUpdateAvailable(true);
                    setSnackbar({
                      open: true,
                      message: 'Nova atualização disponível!',
                      severity: 'info',
                    });
                  } else if (newWorker.state === 'activated') {
                    setSnackbar({
                      open: true,
                      message: 'Pronto para trabalhar offline!',
                      severity: 'success',
                    });
                  }
                });
              }
            });
          },
          (error) => {
            console.error('ServiceWorker registration failed: ', error);
          }
        );
      });
    }
  }, []);

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AmbienteProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <NetworkStatusNotifier />
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Principal />} />
                <Route path="/principal" element={<Principal />} />
                <Route path="/confirmacao" element={<ConfirmacaoPacientes />} />
                <Route path="/reconfirmacao" element={<ReconfirmacaoPacientes />} />
                <Route path="/controle" element={<Controle />} />
              </Routes>
              
              {/* Snackbar para mensagens gerais */}
              <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <Alert 
                  onClose={handleCloseSnackbar} 
                  severity={snackbar.severity}
                  variant="filled"
                  sx={{ width: '100%' }}
                >
                  {snackbar.message}
                </Alert>
              </Snackbar>
              
              {/* Diálogo para atualização de versão */}
              <Dialog
                open={updateAvailable}
                onClose={() => setUpdateAvailable(false)}
                aria-labelledby="update-dialog-title"
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle id="update-dialog-title">
                  Nova Atualização Disponível
                </DialogTitle>
                <DialogContent>
                  <DialogContentText>
                    Uma nova versão do aplicativo está disponível. Deseja atualizar agora?
                  </DialogContentText>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setUpdateAvailable(false)} color="primary">
                    Depois
                  </Button>
                  <Button 
                    onClick={() => window.location.reload()} 
                    color="primary" 
                    variant="contained"
                    autoFocus
                  >
                    Atualizar Agora
                  </Button>
                </DialogActions>
              </Dialog>
            </ErrorBoundary>
          </BrowserRouter>
        </ConfirmProvider>
      </AmbienteProvider>
    </ThemeProvider>
  );
}

export default App;
