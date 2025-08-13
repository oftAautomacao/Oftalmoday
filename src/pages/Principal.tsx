import { useState, useEffect } from 'react';
import { useConfirm } from 'material-ui-confirm';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { 
  Container, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Box, 
  Tabs, 
  Tab, 
  IconButton, 
  CircularProgress, 
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material';
import { useAmbiente } from '../contexts/AmbienteContext';
import ConfirmacaoPacientes from '../components/ConfirmacaoPacientes';
import ReconfirmacaoPacientes from '../components/ReconfirmacaoPacientes';
import AppHeader from '../components/AppHeader';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import { red } from '@mui/material/colors';

interface TelefoneCancelado {
  WhatsApp: string;
  Reenviar: string;
}

function Principal() {
  const { database } = useAmbiente();
  const [aba, setAba] = useState(0);

  // --- dados bloqueados ---
  const [telefonesCancelados, setTelefonesCancelados] = useState<Record<string, TelefoneCancelado>>({});
  const [loadingCancelados, setLoadingCancelados] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  
  const confirm = useConfirm();
  
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  useEffect(() => {
    if (!database) return;

    // listener telefones cancelados
    const canceladosRef = ref(
      database,
      '/OFT/45/_dadosComuns/cancelados/1jApb1NOrMYoLce8MKxkUSLBpwEXbe1N1b33di08Ww40/Cancelados'
    );
    const unsubCancelados = onValue(canceladosRef, (snapshot) => {
      const dados = snapshot.val() as Record<string, TelefoneCancelado>;
      setTelefonesCancelados(dados || {});
      setLoadingCancelados(false);
    });

    return () => {
      unsubCancelados();
    };
  }, [database]);


  const handleRemoverTelefone = async (id: string) => {
    if (!database) return;
    
    try {
      await confirm({
        title: 'Confirmar Exclusão',
        description: 'Tem certeza que deseja remover este telefone da lista de bloqueados?',
        confirmationText: 'Sim, remover',
        cancellationText: 'Cancelar',
        confirmationButtonProps: { variant: 'contained', color: 'error' },
        cancellationButtonProps: { variant: 'outlined' },
        dialogProps: { maxWidth: 'sm' }
      });
      
      const telefoneRef = ref(database, `/OFT/45/_dadosComuns/cancelados/1jApb1NOrMYoLce8MKxkUSLBpwEXbe1N1b33di08Ww40/Cancelados/${id}`);
      await remove(telefoneRef);
      
    } catch (error) {
      if (error !== 'cancelled') {
        console.error('Erro ao remover telefone:', error);
      }
    }
  };

  const handleAdicionarTelefone = async () => {
    if (!novoTelefone.trim() || !database) return;
    
    try {
      // Verifica se o telefone já existe
      const telefoneExiste = Object.values(telefonesCancelados).some(
        tel => tel.WhatsApp === novoTelefone
      );
      
      if (telefoneExiste) {
        setSnackbar({
          open: true,
          message: 'Este número já está na lista de bloqueados',
          severity: 'warning'
        });
        return;
      }
      
      // Pergunta de confirmação antes de adicionar
      await confirm({
        title: 'Confirmar Adição',
        description: `Deseja realmente adicionar o número ${novoTelefone} à lista de bloqueados?`,
        confirmationText: 'Sim, adicionar',
        cancellationText: 'Cancelar',
        confirmationButtonProps: { variant: 'contained', color: 'primary' },
        cancellationButtonProps: { variant: 'outlined' },
        dialogProps: { maxWidth: 'sm' }
      });
      
      // Se o usuário confirmar, adiciona o número
      const telefoneRef = ref(database, '/OFT/45/_dadosComuns/cancelados/1jApb1NOrMYoLce8MKxkUSLBpwEXbe1N1b33di08Ww40/Cancelados');
      const novoRegistro: TelefoneCancelado = {
        WhatsApp: novoTelefone,
        Reenviar: 'N'
      };
      
      const novoRegistroRef = push(telefoneRef);
      await set(novoRegistroRef, novoRegistro);
      
      // Limpa o campo após adicionar
      setNovoTelefone('');
      setAdicionando(false);
      
      // Mostra mensagem de sucesso
      setSnackbar({
        open: true,
        message: 'Número adicionado com sucesso!',
        severity: 'success'
      });
      
    } catch (error) {
      // Se o usuário cancelar, não faz nada
      if (error !== 'cancelled') {
        console.error('Erro ao adicionar telefone bloqueado:', error);
        setSnackbar({
          open: true,
          message: 'Erro ao adicionar número. Tente novamente.',
          severity: 'error'
        });
      }
    }
  };

  // Filtra e ordena os telefones
  const telefonesFiltrados = Object.entries(telefonesCancelados)
    .filter(([_, dados]) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      // Garante que WhatsApp seja tratado como string e remove caracteres não numéricos
      const whatsappNumero = String(dados.WhatsApp || '').replace(/\D/g, '');
      const searchNumeros = search.replace(/\D/g, '');
      return whatsappNumero.includes(searchNumeros);
    })
    .sort((a, b) => {
      // Remove caracteres não numéricos para ordenação correta
      const telefoneA = String(a[1]?.WhatsApp || '').replace(/\D/g, '');
      const telefoneB = String(b[1]?.WhatsApp || '').replace(/\D/g, '');
      return telefoneA.localeCompare(telefoneB);
    });

  // Configuração da paginação
  const itensPorPagina = 21; // 3 colunas * 7 itens
  const [paginaAtual, setPaginaAtual] = useState(0);
  const totalPaginas = Math.ceil(telefonesFiltrados.length / itensPorPagina);

  // Atualiza a página atual se necessário quando os dados mudam
  useEffect(() => {
    if (paginaAtual >= totalPaginas && totalPaginas > 0) {
      setPaginaAtual(totalPaginas - 1);
    }
  }, [paginaAtual, totalPaginas]);

  // Divide os telefones em páginas e depois em colunas
  const telefonesPaginados = () => {
    const inicio = paginaAtual * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return telefonesFiltrados.slice(inicio, fim);
  };

  // Divide os telefones em 3 colunas com 7 itens cada
  const telefonesPorColuna = (telefones: typeof telefonesFiltrados) => {
    const colunas: (typeof telefonesFiltrados)[] = [[], [], []];
    
    telefones.forEach((item, index) => {
      const colunaIndex = Math.floor(index / 7);
      if (colunaIndex < 3) { // Garante que só preenche 3 colunas
        colunas[colunaIndex].push(item);
      }
    });
    
    return colunas;
  };
  
  const colunasTelefones = telefonesPorColuna(telefonesPaginados());
  
  const handleMudarPagina = (novaPagina: number) => {
    setPaginaAtual(Math.max(0, Math.min(novaPagina, totalPaginas - 1)));
  };


  return (
    <>
      <AppHeader />

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper sx={{ mb: 3 }}>
          <Tabs value={aba} onChange={(_, v: number) => setAba(v)} centered>
            <Tab label="Confirmação Pacientes" />
            <Tab label="Reconfirmação Pacientes" />
            <Tab label="Pacientes Bloqueados" />
          </Tabs>
        </Paper>

        {/* Aba 0 – confirmação pacientes */}
        {aba === 0 && (
          <Paper sx={{ p: 2 }}>
            <ConfirmacaoPacientes />
          </Paper>
        )}

        {/* Aba 1 – reconfirmação pacientes */}
        {aba === 1 && (
          <Paper sx={{ p: 2 }}>
            <ReconfirmacaoPacientes />
          </Paper>
        )}

        {/* Aba 2 – bloqueados */}
        {aba === 2 && (
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
              <TextField
                size="small"
                placeholder="Buscar telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
                }}
                sx={{ flex: 1 }}
              />
              <Tooltip title="Adicionar telefone bloqueado">
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAdicionando(!adicionando)}
                >
                  {adicionando ? 'Cancelar' : 'Adicionar'}
                </Button>
              </Tooltip>
            </Box>

            {adicionando && (
              <Box sx={{ p: 2, mb: 2, border: '1px solid #eee', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>Adicionar Telefone Bloqueado</Typography>
                <Box sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    label="Número de Telefone *"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value.replace(/\D/g, ''))}
                    placeholder="DDD + Número"
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="caption" color="textSecondary">
                    Digite apenas números. O telefone será adicionado à lista de bloqueados.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={() => setAdicionando(false)}>Cancelar</Button>
                  <Button 
                    variant="contained" 
                    onClick={handleAdicionarTelefone}
                    disabled={!novoTelefone}
                  >
                    Salvar
                  </Button>
                </Box>
              </Box>
            )}

            {loadingCancelados ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 3, mt: 2, minHeight: 400 }}>
                  {colunasTelefones.map((coluna, colIndex) => (
                    <Box key={colIndex} sx={{ flex: 1, border: '1px solid #eee', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{ 
                        backgroundColor: '#f5f5f5', 
                        p: 1.5, 
                        borderBottom: '1px solid #eee',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        Telefones Pacientes
                      </Box>
                      <Box sx={{ minHeight: 350 }}>
                        {coluna.map(([id, dados]) => (
                          <Box 
                            key={id} 
                            sx={{ 
                              p: 1.5, 
                              borderBottom: '1px solid #f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              '&:hover': { 
                                backgroundColor: '#f9f9f9',
                                '& .delete-button': {
                                  visibility: 'visible'
                                }
                              }
                            }}
                          >
                            <Box>{dados.WhatsApp}</Box>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoverTelefone(id);
                              }}
                              className="delete-button"
                              sx={{
                                visibility: 'hidden',
                                color: red[500],
                                '&:hover': {
                                  backgroundColor: 'rgba(244, 67, 54, 0.08)'
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                        {coluna.length < 7 && Array(7 - coluna.length).fill(0).map((_, i) => (
                          <Box 
                            key={`empty-${i}`} 
                            sx={{ 
                              p: 1.5, 
                              borderBottom: '1px solid #f0f0f0',
                              height: '50px',
                              boxSizing: 'border-box'
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
                
                {/* Controles de Paginação */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2, alignItems: 'center' }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => handleMudarPagina(0)}
                    disabled={paginaAtual === 0}
                  >
                    Primeira
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => handleMudarPagina(paginaAtual - 1)}
                    disabled={paginaAtual === 0}
                  >
                    Anterior
                  </Button>
                  
                  <Typography variant="body1">
                    Página {paginaAtual + 1} de {Math.max(1, totalPaginas)}
                  </Typography>
                  
                  <Button 
                    variant="outlined" 
                    onClick={() => handleMudarPagina(paginaAtual + 1)}
                    disabled={paginaAtual >= totalPaginas - 1}
                  >
                    Próxima
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => handleMudarPagina(totalPaginas - 1)}
                    disabled={paginaAtual >= totalPaginas - 1}
                  >
                    Última
                  </Button>
                </Box>
                
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
                  Total de {telefonesFiltrados.length} telefone(s) bloqueado(s)
                </Typography>
              </Box>
            )}
          </Paper>
        )}
        
        {/* Snackbar para mensagens de feedback */}
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
      </Container>
    </>
  );
}

export default Principal;
