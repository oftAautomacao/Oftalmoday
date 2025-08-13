import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { useAmbiente } from '../contexts/AmbienteContext';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  IconButton, 
  Tooltip, 
  CircularProgress, 
  Stack,
  Tabs,
  Tab,
  Snackbar,
  Alert as MuiAlert,
  AlertProps as MuiAlertProps
} from '@mui/material';

// Componente Alert personalizado para o Snackbar
const Alert = React.forwardRef<HTMLDivElement, MuiAlertProps>(function Alert(
  props,
  ref,
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Paciente {
  id: string;
  Paciente: string;
  DataMarcada: string;
  Medico: string;
  Convenio: string;
  WhatsAppCel?: string;
  TelefoneCel?: string;
  TelefoneRes?: string;
  TelefoneCom?: string;
  Telefone?: string;
  IDMarcacao?: string;
  status: string;
  tipo?: 'paciente' | 'erro';
  mensagem?: string;
}

interface DadosFirebase {
  aEnviar?: Record<string, Omit<Paciente, 'id'>>;
  erro?: Record<string, Omit<Paciente, 'id'>>;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

// Estilos base para o checkbox
const checkboxContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px', // Aumentado o espaçamento entre o número e a caixinha
  width: '100%',
  justifyContent: 'flex-start',
  paddingLeft: '8px',
  minHeight: '52px' // Garante altura mínima igual à das outras linhas
};

// Estilos inline foram movidos para o componente Box

const ReconfirmacaoPacientes: React.FC = () => {
  const { database } = useAmbiente();
  const [dados, setDados] = useState<DadosFirebase>({ aEnviar: {}, erro: {} });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState(0);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'info' 
  });
  const [selectedRows, setSelectedRows] = useState<{[key: string]: boolean}>({});
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 100,
  });

  // Processa os dados para exibição
  const { pacientes, erros } = useMemo(() => {
    const listaPacientes: Paciente[] = Object.entries(dados.aEnviar || {}).map(([id, paciente]) => ({
      ...paciente,
      id,
      tipo: 'paciente' as const
    }));

    const listaErros: Paciente[] = [];
    if (dados.erro) {
      for (const [id, erro] of Object.entries(dados.erro)) {
        if (erro && typeof erro === 'object') {
          listaErros.push({
            ...erro,
            id,
            tipo: 'erro' as const,
            mensagem: 'Erro na confirmação'
          });
        }
      }
    }

    const filterFn = (item: Paciente, searchTerm: string) => 
      Object.entries(item).some(([key, value]) => 
        !['id', 'tipo'].includes(key) && 
        String(value).toLowerCase().includes(searchTerm)
      );

    const searchTerm = search.toLowerCase();
    
    return {
      pacientes: search 
        ? listaPacientes.filter(p => filterFn(p, searchTerm)) 
        : listaPacientes,
      erros: search 
        ? listaErros.filter(e => filterFn(e, searchTerm)) 
        : listaErros
    };
  }, [dados, search]);

  // Carrega os dados do Firebase
  const carregarDados = useCallback((): (() => void) | undefined => {
    if (!database) {
      setError('Banco de dados não está disponível');
      return;
    }
    
    const path = '/OFT/45/reconfirmacaoPacientes';
    const rootRef = ref(database, path);
    
    const onDataChange = (snapshot: any) => {
      try {
        if (snapshot.exists()) {
          const dadosFirebase = snapshot.val();
          setDados(dadosFirebase || { aEnviar: {}, erro: {} });
        } else {
          setDados({ aEnviar: {}, erro: {} });
          setError('Nenhum dado encontrado');
        }
      } catch (err) {
        console.error('Erro ao processar dados:', err);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    const onError = (error: any) => {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao conectar ao banco de dados');
    };
    
    // Registrar o listener
    const unsubscribe = onValue(rootRef, onDataChange, onError);
    
    // Retorna a função de limpeza
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.error('Erro ao remover listener:', err);
      }
    };
  }, [database]);

  // Efeito para sincronizar o estado dos checkboxes com o campo 'Copiado' dos dados
  useEffect(() => {
    if (dados.aEnviar) {
      const novosSelecionados: {[key: string]: boolean} = {};
      
      // Itera sobre os pacientes e verifica se o campo 'Copiado' está como true
      Object.entries(dados.aEnviar).forEach(([id, paciente]) => {
        if ((paciente as any).Copiado === true) {
          novosSelecionados[id] = true;
        }
      });
      
      setSelectedRows(novosSelecionados);
    }
  }, [dados]);

  // Efeito para carregar os dados
  useEffect(() => {
    const unsubscribe = carregarDados();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [carregarDados]);

  // Função para copiar o link do WhatsApp para a área de transferência
  const copiarParaAreaTransferencia = (texto: string, pacienteId: string) => {
    // Primeiro copia para a área de transferência
    navigator.clipboard.writeText(texto).then(() => {
      setSnackbar({
        open: true,
        message: 'Link copiado para a área de transferência!',
        severity: 'success'
      });
      
      // Atualiza o banco de dados para marcar como copiado
      if (database) {
        // Atualiza apenas o campo Copiado sem modificar outros campos
        const pacienteRef = ref(database, `/OFT/45/reconfirmacaoPacientes/aEnviar/${pacienteId}`);
        
        // Atualiza apenas o campo Copiado
        update(pacienteRef, { Copiado: true }).catch((error: Error) => {
          console.error('Erro ao atualizar status de cópia no banco de dados:', error);
        });
      }
    }).catch((error: Error) => {
      console.error('Erro ao copiar link:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao copiar o link',
        severity: 'error'
      });
    });
  };

  // Formata mensagem do WhatsApp
  const formatarMensagem = useCallback((paciente: Paciente) => {
    // Extrai data e hora da string DataMarcada
    const dataMarcada = paciente.DataMarcada.split(' ');
    const data = dataMarcada[0];
    const hora = dataMarcada[2]; // Pega a hora diretamente do terceiro elemento
    
    // Texto principal da mensagem
    let mensagem = "*Olá, bom dia!* \n*Somos da clínica Oftalmo Day!*";
    
    // Verifica se o médico é "Campo Visual"
    if (paciente.Medico === "Campo Visual") {
      mensagem += "\nPassando para lembrar do exame do paciente " +
                paciente.Paciente + " para *HOJE*, dia " +
                data + " às " + hora;
    } else {
      // Formato padrão para outros médicos
      mensagem += "\nPassando para lembrar do agendamento do paciente " +
                paciente.Paciente + " para *HOJE*, dia " +
                data + " às " + hora + " com o(a) Dr(a) " + paciente.Medico + ".";
    }
    
    // Adiciona o complemento da mensagem
    mensagem += "\n\n📍 Caso necessite de declaração de comparecimento ou emissão de Nota Carioca, " +
               "solicitamos que o pedido seja feito no dia da consulta, diretamente na recepção da clínica. " +
               "Se a solicitação for feita posteriormente, o prazo para entrega será de até 24 horas.";
    
    // Codifica a mensagem para URL (mantendo os caracteres especiais)
    return encodeURIComponent(mensagem)
      .replace(/'/g, "%27")
      .replace(/\*/g, "%2A");
  }, []);

  // Função para alternar a seleção de uma linha
  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));

    // Atualiza o Firebase
    if (database) {
      const updates: Record<string, any> = {};
      const caminho = `/OFT/45/reconfirmacaoPacientes/aEnviar/${rowId}/Copiado`;
      
      if (!selectedRows[rowId]) {
        // Se estiver marcando, adiciona o campo copiado: true
        updates[caminho] = true;
      } else {
        // Se estiver desmarcando, define como null para remover o campo
        updates[caminho] = null;
      }
      
      update(ref(database), updates).catch(error => {
        console.error('Erro ao atualizar status de cópia no banco de dados:', error);
        // Reverte o estado em caso de erro
        setSelectedRows(prev => ({
          ...prev,
          [rowId]: !prev[rowId]
        }));
      });
    }
  };

  // Função para obter o índice da linha de forma segura
  const getSafeRowIndex = (params: GridRenderCellParams, page: number, pageSize: number): number => {
    try {
      // Tenta obter o índice da linha de forma segura
      if (params.api && typeof params.api.getRowIndexRelativeToVisibleRows === 'function') {
        const rowIndex = params.api.getRowIndexRelativeToVisibleRows(params.row.id);
        // Calcula o número sequencial considerando a página atual
        return (page * pageSize) + rowIndex + 1;
      }
      return (page * pageSize) + 1; // Valor padrão seguro
    } catch (error) {
      console.error('Erro ao obter índice da linha:', error);
      return (page * pageSize) + 1;
    }
  };

  // Coluna de numeração sequencial com checkbox
  const numeroSequencialColumn: GridColDef = {
    field: 'numeroSequencial',
    headerName: '#',
    width: 100,
    align: 'center',
    headerAlign: 'center',
    valueGetter: (params) => {
      const index = getSafeRowIndex(params, paginationModel.page, paginationModel.pageSize);
      return isNaN(index) ? 0 : index; // Garante que sempre retornaremos um número válido
    },
    renderCell: (params: GridRenderCellParams) => {
      const value = isNaN(Number(params.value)) ? 0 : Number(params.value);
      const rowId = params.row.id;
      
      return (
        <div style={{ ...checkboxContainerStyles, gap: '4px' }}>
          <span style={{ minWidth: '20px', textAlign: 'right', fontFamily: 'monospace' }}>{value}</span>
          <div style={{ position: 'relative', width: '18px', height: '18px' }}>
            <Box
              component="input"
              type="checkbox"
              checked={!!selectedRows[rowId]}
              onChange={() => toggleRowSelection(rowId)}
              onClick={(e) => e.stopPropagation()}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0.01, // Torna o input quase invisível, mas ainda clicável
                zIndex: 1,
                cursor: 'pointer',
                margin: 0,
                padding: 0,
                border: 'none',
                outline: 'none'
              }}
            />
            <Box
              component="div"
              sx={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                marginLeft: '8px',
                backgroundColor: selectedRows[rowId] ? '#4caf50' : 'white',
                borderRadius: '3px',
                border: selectedRows[rowId] ? '1px solid #4caf50' : '1px solid #ccc',
                position: 'relative',
                outline: 'none',
                transition: 'all 0.2s ease-in-out',
                WebkitAppearance: 'none',
                appearance: 'none',
                ...(selectedRows[rowId] && {
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'20 6 9 17 4 12\'%3E%3C/polyline%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundSize: '12px 12px',
                }),
                '&:hover': {
                  backgroundColor: selectedRows[rowId] ? '#388e3c' : '#f5f5f5',
                  borderColor: selectedRows[rowId] ? '#388e3c' : '#999'
                }
              }}
            />
          </div>
        </div>
      );
    }
  };

  // Coluna de link para WhatsApp
  const linkColumn: GridColDef = { 
    field: 'link', 
    headerName: 'Link WhatsApp', 
    flex: 0.5,
    minWidth: 200,
    sortable: false,
    filterable: false,
    renderCell: (params: GridRenderCellParams) => {
      const whatsappCel = params.row.WhatsAppCel || '';
      if (!whatsappCel || whatsappCel.trim() === '') return 'Sem WhatsApp';
      
      const numeroLimpo = whatsappCel.replace(/\D/g, '').replace(/^55/, '');
      const mensagem = formatarMensagem(params.row);
      const whatsappLink = `https://api.whatsapp.com/send/?phone=55${numeroLimpo}&text=${mensagem}&type=phone_number&app_absent=0`;
      
      return (
        <Tooltip title="Clique para copiar o link" arrow>
          <Box 
            component="div"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copiarParaAreaTransferencia(whatsappLink, params.row.id);
            }}
            sx={{
              width: '100%',
              maxWidth: '100%',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'pointer',
              color: '#1976d2',
              '&:hover': {
                textDecoration: 'underline',
                backgroundColor: '#f0f0f0',
              },
              padding: '2px 6px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background-color 0.2s',
            }}
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
              alt="WhatsApp" 
              style={{ 
                width: '14px', 
                height: '14px',
                flexShrink: 0
              }} 
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {whatsappLink}
            </span>
          </Box>
        </Tooltip>
      );
    }
  };

  // Colunas da tabela
  const colunas: GridColDef[] = [
    numeroSequencialColumn,
    // Mostra a coluna de link apenas na aba de pacientes (tabAtiva === 0)
    ...(tabAtiva === 0 ? [linkColumn] : []),
    { 
      field: 'Paciente', 
      headerName: 'Paciente', 
      flex: 2,
      valueFormatter: (params) => params.value || 'Não informado',
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <div style={{ fontWeight: 'bold' }}>{params.value || 'Não informado'}</div>
        </Box>
      )
    },
    { 
      field: 'DataMarcada', 
      headerName: 'Data da Consulta', 
      flex: 1,
      valueFormatter: (params) => {
        if (!params.value) return 'Não informado';
        
        // Tenta criar uma data a partir do valor
        let date: Date;
        
        // Se for um número, assume que é um timestamp
        if (typeof params.value === 'number') {
          date = new Date(params.value);
        } 
        // Se for uma string no formato ISO
        else if (typeof params.value === 'string' && params.value.includes('T')) {
          date = new Date(params.value);
        }
        // Se for uma string no formato DD/MM/YYYY HH:MM
        else if (typeof params.value === 'string' && params.value.includes('/')) {
          const [datePart, timePart] = params.value.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hours, minutes] = timePart ? timePart.split(':').map(Number) : [0, 0];
          date = new Date(year, month - 1, day, hours, minutes);
        }
        // Se não for nenhum dos formatos acima, retorna o valor original
        else {
          return params.value;
        }
        
        // Verifica se a data é válida
        if (isNaN(date.getTime())) {
          return params.value; // Retorna o valor original se a data for inválida
        }
        
        // Formata a data para o padrão brasileiro
        return date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
    },
    { 
      field: 'Medico', 
      headerName: 'Médico', 
      flex: 1.5, // Aumentando o flex para dar mais espaço
      minWidth: 150, // Largura mínima para evitar que fique muito apertado
      valueFormatter: (params) => params.value || 'Não informado',
      renderCell: (params) => (
        <Box 
          sx={{ 
            width: '100%',
            whiteSpace: 'normal',
            lineHeight: '1.2',
            py: 1 // Adiciona um pequeno padding vertical
          }}
        >
          {params.value || 'Não informado'}
        </Box>
      )
    },
    { 
      field: 'Convenio', 
      headerName: 'Convênio', 
      flex: 1,
      valueFormatter: (params) => params.value || 'Não informado'
    },
    {
      field: 'Telefone',
      headerName: 'Telefone',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => {
        // Para a aba de Pacientes, mostra APENAS o WhatsAppCel
        if (tabAtiva === 0) {
          let whatsappCel = params.row.WhatsAppCel || params.row.whatsappcel || params.row.whatsAppCel;
          
          if (!whatsappCel || whatsappCel.trim() === '') {
            return 'Não informado';
          }
          
          // Remove o 55 do início do número para exibição
          const numeroExibicao = whatsappCel.replace(/^55/, '');
          // Remove todos os caracteres não numéricos e o 55 do início se existir
          const numeroLimpo = whatsappCel.replace(/\D/g, '').replace(/^55/, '');
          // Adiciona apenas um 55 no link do WhatsApp
          const whatsappLink = `https://wa.me/55${numeroLimpo}`;
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  textDecoration: 'none',
                  color: '#1976d2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                  alt="WhatsApp" 
                  style={{ 
                    width: '14px', 
                    height: '14px',
                    flexShrink: 0
                  }} 
                />
                {numeroExibicao}
              </a>
            </Box>
          );
        }
        
        // Para outras abas, mantém o comportamento original (mostra todos os telefones)
        const telefones = [
          params.row.Telefone,
          params.row.TelefoneCel,
          params.row.TelefoneCom,
          params.row.TelefoneRes,
          params.row.WhatsAppCel,
        ].filter(tel => tel && tel.trim() !== '');
        
        if (telefones.length === 0) return 'Não informado';
        
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {telefones.map((tel, index) => {
              const numeroLimpo = tel.replace(/\D/g, '');
              const whatsappLink = `https://wa.me/55${numeroLimpo}`;
              
              return (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <a 
                    href={whatsappLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      textDecoration: 'none',
                      color: '#1976d2',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                      alt="WhatsApp" 
                      style={{ 
                        width: '14px', 
                        height: '14px',
                        flexShrink: 0
                      }} 
                    />
                    {tel}
                  </a>
                </Box>
              );
            })}
          </Box>
        );
      }
    }
  ];

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder={tabAtiva === 0 ? "Buscar paciente..." : "Buscar erros..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Box>
          <Box>
            <Tooltip title="Atualizar dados">
              <span>
                <IconButton 
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    setDados({ aEnviar: {}, erro: {} });
                    setTimeout(() => carregarDados(), 100);
                  }}
                  disabled={loading}
                  sx={{ 
                    height: '40px',
                    width: '40px',
                    backgroundColor: '#e8f5e9', // Verde claro
                    '&:hover': {
                      backgroundColor: '#c8e6c9' // Verde um pouco mais escuro no hover
                    },
                    '&:disabled': {
                      backgroundColor: 'action.disabledBackground',
                      color: 'action.disabled',
                      cursor: 'not-allowed'
                    }
                  }}
                >
                  {loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        '& .MuiDataGrid-root': {
          width: '100%',
          minWidth: 0,
        },
        '& .MuiDataGrid-virtualScroller': {
          overflow: 'auto',
        },
        '& .MuiDataGrid-viewport': {
          minWidth: '100% !important',
        },
        '& .MuiDataGrid-columnsContainer': {
          minWidth: '100% !important',
        },
        '& .MuiDataGrid-row': {
          minWidth: '100% !important',
        }
      }}>
        <Tabs 
          value={tabAtiva} 
          onChange={(_, newValue) => setTabAtiva(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Pacientes</span>
                {pacientes.length > 0 && (
                  <Box sx={{ 
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: 20, 
                    height: 20, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '0.75rem'
                  }}>
                    {pacientes.length}
                  </Box>
                )}
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Erros</span>
                {erros.length > 0 && (
                  <Box sx={{ 
                    bgcolor: 'error.main', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: 20, 
                    height: 20, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '0.75rem'
                  }}>
                    {erros.length}
                  </Box>
                )}
              </Box>
            } 
          />
        </Tabs>

        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : tabAtiva === 0 ? (
            <DataGrid
              rows={pacientes}
              columns={colunas}
              autoHeight
              disableRowSelectionOnClick
              disableColumnMenu
              pageSizeOptions={[100]}
              pagination
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              getRowId={(row) => row.id}
              components={{
                NoRowsOverlay: () => (
                  <Box 
                    display="flex" 
                    flexDirection="column" 
                    justifyContent="center" 
                    alignItems="center" 
                    height="100%" 
                    p={4}
                  >
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                      Nenhum paciente encontrado
                    </Typography>
                    <Typography variant="body2" color="textSecondary" align="center">
                      {search ? 'Nenhum resultado para a busca atual' : 'Nenhum paciente aguardando confirmação'}
                    </Typography>
                  </Box>
                ),
              }}
              sx={{
                width: '100%',
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f5f5f5',
                  '& .MuiDataGrid-columnHeader': {
                    '&:not(:last-child)': {
                      borderRight: '1px solid rgba(224, 224, 224, 1)',
                    },
                  },
                },
                flex: 1,
                minWidth: 0,
              }}
            />
          ) : (
            <DataGrid
              rows={erros}
              columns={colunas}
              autoHeight
              disableRowSelectionOnClick
              disableColumnMenu
              pageSizeOptions={[100]}
              pagination
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              getRowId={(row) => row.id}
              components={{
                NoRowsOverlay: () => (
                  <Box 
                    display="flex" 
                    flexDirection="column" 
                    justifyContent="center" 
                    alignItems="center" 
                    height="100%" 
                    p={4}
                  >
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                      Nenhum erro encontrado
                    </Typography>
                    <Typography variant="body2" color="textSecondary" align="center">
                      {search ? 'Nenhum resultado para a busca atual' : 'Nenhum erro de confirmação'}
                    </Typography>
                  </Box>
                ),
              }}
              sx={{
                width: '100%',
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f5f5f5',
                  '& .MuiDataGrid-columnHeader': {
                    '&:not(:last-child)': {
                      borderRight: '1px solid rgba(224, 224, 224, 1)',
                    },
                  },
                },
                flex: 1,
                minWidth: 0,
              }}
            />
          )}
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbar-root': {
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
          },
          '& .MuiPaper-root': {
            minWidth: 'auto',
            flexGrow: 0,
          }
        }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReconfirmacaoPacientes;
