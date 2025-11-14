import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { useAmbiente } from '../contexts/AmbienteContext';
import { normalizeMessage } from '../utils/normalizeMessage';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  IconButton, 
  Tooltip, 
  Stack,
  Snackbar,
  Alert as MuiAlert,
  AlertProps as MuiAlertProps,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface Paciente {
  id: string;
  Paciente: string;
  DataMarcada: string;
  Medico: string;
  Convenio: string;
  TelefoneRes: string;
  TelefoneCel?: string;
  Telefone?: string;
  TelefoneCom?: string;
  WhatsAppCel?: string;
  IDMarcacao: string;
  status: string;
  Copiado?: boolean;
}

interface DadosFirebase {
  aEnviar: Record<string, Omit<Paciente, 'id'>>;
  erro: Record<string, Omit<Paciente, 'id'>>;
}

interface ConfirmacaoPacientesProps {}

const ConfirmacaoPacientes: React.FC<ConfirmacaoPacientesProps> = ({}) => {
  const { database, ambiente } = useAmbiente();
  const [dados, setDados] = useState<DadosFirebase>({ aEnviar: {}, erro: {} });
  const [search, setSearch] = useState('');
  // Filtros
  const [filtroDataExistente, setFiltroDataExistente] = useState<string[]>([]); // [] = todas
  const [filtroMedico, setFiltroMedico] = useState<string[]>([]); // [] = todos
  const [filtroConvenio, setFiltroConvenio] = useState<string[]>([]); // [] = todos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Sub-abas Pacientes/Erros (nível 2)
  const [subTabAtiva, setSubTabAtiva] = useState(0); // 0: Pacientes, 1: Erros

  // Estado para o dialog de seleção em lote
  const [batchSelectOpen, setBatchSelectOpen] = useState(false);
  const [batchSelectType, setBatchSelectType] = useState(''); // 'data', 'medico', 'convenio'
  const [batchSelectValue, setBatchSelectValue] = useState('');


  // Estado para controlar o Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Prepara os dados para exibição
  const { pacientesFiltrados, errosFiltrados } = useMemo(() => {
    console.log('Processando dados do Firebase:', dados);
    
    // Converte os objetos para arrays e adiciona o ID
    const listaPacientes = Object.entries(dados.aEnviar || {}).map(([id, paciente]) => ({
      ...paciente,
      id,
      tipo: 'paciente' as const
    }));

    // Processa os erros - agora com a mesma estrutura de paciente
    const listaErros = [];
    if (dados.erro) {
      for (const [id, erro] of Object.entries(dados.erro)) {
        // Verifica se o erro é um objeto com dados do paciente
        if (erro && typeof erro === 'object') {
          listaErros.push({
            ...erro,
            id,
            tipo: 'erro' as const,
            mensagem: 'Erro na confirmação' // Mensagem padrão
          });
        }
      }
    }
    
    console.log('Pacientes processados:', listaPacientes);
    console.log('Erros processados:', listaErros);

    // Aplica a busca se houver termo de busca
    if (!search) {
      return { 
        pacientesFiltrados: listaPacientes, 
        errosFiltrados: listaErros 
      };
    }

    const searchNormalized = normalizeMessage(search);

    // Filtra pacientes
    const pacientesFiltrados = listaPacientes.filter(paciente => 
      Object.entries(paciente).some(([key, value]) => {
        if (['id', 'tipo', 'IDMarcacao'].includes(key)) return false;
        return normalizeMessage(String(value)).includes(searchNormalized);
      })
    );

    // Filtra erros
    const errosFiltrados = listaErros.filter(erro => 
      Object.entries(erro).some(([key, value]) => {
        if (['id', 'tipo'].includes(key)) return false;
        return normalizeMessage(String(value)).includes(searchNormalized);
      })
    );

    return { pacientesFiltrados, errosFiltrados };
  }, [dados, search]);

  // Extrai datas únicas (DD/MM/AAAA), médicos e convênios únicos
  const { datasOrdenadas, medicosUnicos, conveniosUnicos } = useMemo(() => {
    const extrairData = (dataMarcada?: string) => {
      if (!dataMarcada) return 'Sem Data';
      const [data] = String(dataMarcada).split(' ');
      return data || 'Sem Data';
    };
    const setDatas = new Set<string>();
    const setMedicos = new Set<string>();
    const setConvenios = new Set<string>();

    [...pacientesFiltrados, ...errosFiltrados].forEach((item: any) => {
      setDatas.add(extrairData(item.DataMarcada));
      if (item.Medico) setMedicos.add(String(item.Medico));
      if (item.Convenio) setConvenios.add(String(item.Convenio));
    });

    const parsePtBrDate = (d: string) => {
      if (d === 'Sem Data') return new Date(0);
      const [dia, mes, ano] = d.split('/').map(Number);
      return new Date(ano, (mes || 1) - 1, dia || 1);
    };

    const ordenadas = Array.from(setDatas).sort((a, b) => parsePtBrDate(a).getTime() - parsePtBrDate(b).getTime());
    const medicos = Array.from(setMedicos).sort((a, b) => a.localeCompare(b));
    const convenios = Array.from(setConvenios).sort((a, b) => a.localeCompare(b));
    return { datasOrdenadas: ordenadas, medicosUnicos: medicos, conveniosUnicos: convenios };
  }, [pacientesFiltrados, errosFiltrados]);

  // Carrega os dados do Firebase
  const carregarDados = useCallback((): (() => void) | undefined => {
    if (!database) {
      console.error('Database não está disponível');
      setError('Banco de dados não está disponível');
      return;
    }
    
    console.log('Iniciando carregamento de dados...');
    setLoading(true);
    setError(null);
    
    const path = '/OFT/45/confirmacaoPacientes/site';
    const rootRef = ref(database, path);
    
    console.log(`Caminho de referência: ${path}`);
    console.log('Database config:', {
      app: database.app.name,
      databaseUrl: database.app.options.databaseURL
    });
    
    // Força o modo de depuração
    console.log('Modo de depuração ativado para verificar os dados do Firebase');
    
    try {
      console.log('Registrando listener no caminho...');
      const unsubscribe = onValue(rootRef, (snapshot) => {
        try {
          console.log('Dados recebidos do Firebase:', snapshot.exists() ? 'existem' : 'não existem');
          const data = snapshot.val() as DadosFirebase | null;
          console.log('Dados processados:', JSON.stringify(data, null, 2));
          
          if (data) {
            console.log(`Encontrados ${Object.keys(data.aEnviar || {}).length} pacientes a enviar`);
            console.log('Chaves de pacientes:', Object.keys(data.aEnviar || {}));
            console.log(`Encontrados ${Object.keys(data.erro || {}).length} erros de confirmação`);
            console.log('Chaves de erros:', Object.keys(data.erro || {}));
            
            // Verifica se há erros e loga o primeiro para depuração
            if (data.erro && Object.keys(data.erro).length > 0) {
              const primeiroErroId = Object.keys(data.erro)[0];
              console.log('Exemplo de erro:', primeiroErroId, data.erro[primeiroErroId as keyof typeof data.erro]);
            }
            
            setDados({
              aEnviar: data.aEnviar || {},
              erro: data.erro || {}
            });
            
            setLastUpdated(new Date());
          } else {
            console.log('Nenhum dado encontrado no caminho especificado');
            setDados({ aEnviar: {}, erro: {} });
          }
          setLoading(false);
        } catch (err) {
          console.error('Erro ao processar dados do Firebase:', err);
          setError('Erro ao carregar os dados. Tente novamente mais tarde.');
          setLoading(false);
        }
      }, (error) => {
        console.error('Erro ao acessar o Firebase:', error);
        setError('Erro ao conectar ao banco de dados. Verifique sua conexão.');
        setLoading(false);
      });
      
      return () => {
        // Limpa o listener quando o componente for desmontado
        unsubscribe();
      };
    } catch (err) {
      console.error('Erro ao configurar listener do Firebase:', err);
      setError('Erro ao configurar a conexão com o banco de dados.');
      setLoading(false);
      return undefined;
    }
  }, [database]);

  // Efeito para sincronizar o estado dos checkboxes com o campo 'copiado' dos dados
  useEffect(() => {
    if (dados.aEnviar) {
      const novosSelecionados: {[key: string]: boolean} = {};
      
      // Itera sobre os pacientes e verifica se o campo 'Copiado' está como true
      Object.entries(dados.aEnviar).forEach(([id, paciente]) => {
        if (paciente.Copiado === true) {
          novosSelecionados[id] = true;
        }
      });
      
      setSelectedRows(novosSelecionados);
    }
  }, [dados]);

  // Efeito para carregar os dados quando o ambiente ou database mudar
  useEffect(() => {
    if (!database) {
      setError('Banco de dados não disponível');
      setLoading(false);
      return;
    }
    
    const unsubscribe = carregarDados();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [database, ambiente, carregarDados]);

  // Função para formatar a mensagem de confirmação
  const formatarMensagemConfirmacao = (paciente: any) => {
    const endereco = 'Praça Saenz Pena 45, sala 1508 - Tijuca';
    const pacienteNome = paciente.Paciente || 'Não informado';
    const dataMarcada = paciente.DataMarcada || 'Data não informada';
    const medico = paciente.Medico || 'Médico não informado';
    const convenio = paciente.Convenio || 'Convênio não informado';

    let mensagem = 'Olá! Aqui é da OftalmoDay.';
    
    if (medico.toLowerCase().includes('campo visual')) {
      mensagem += '\n\nGostaríamos de confirmar o exame abaixo:' +
                `\n*Paciente:* ${pacienteNome}` +
                `\n*Data/Hora:* ${dataMarcada}` +
                `\n*Exame:* ${medico}` +
                `\n*Plano:* ${convenio}` +
                `\n*Endereço:* ${endereco}`;
    } else {
      mensagem += '\n\nGostaríamos de confirmar o agendamento abaixo:' +
                `\n*Paciente:* ${pacienteNome}` +
                `\n*Data/Hora:* ${dataMarcada}` +
                `\n*Médico:* ${medico}` +
                `\n*Plano:* ${convenio}` +
                `\n*Endereço:* ${endereco}`;
    }
    
    mensagem += '\n\n*CONFIRMA*?';
    
    return encodeURIComponent(mensagem);
  };

  // Função para copiar apenas o telefone
  const copiarTelefone = (telefone: string, pacienteId: string) => {
    const numeroLimpo = String(telefone).replace(/\D/g, '');
    navigator.clipboard.writeText(numeroLimpo).then(() => {
      setSnackbar({ open: true, message: 'Telefone copiado!', severity: 'success' });
      
      // Atualiza o banco de dados para marcar como copiado
      if (database) {
        const pacienteRef = ref(database, `/OFT/45/confirmacaoPacientes/site/aEnviar/${pacienteId}`);
        update(pacienteRef, { Copiado: true }).catch((error: Error) => {
          console.error('Erro ao atualizar status de cópia no banco de dados:', error);
        });
      }
    }).catch((err) => {
      console.error('Falha ao copiar telefone: ', err);
      setSnackbar({ open: true, message: 'Falha ao copiar telefone.', severity: 'error' });
    });
  };

  // Função para copiar texto para a área de transferência e atualizar o status no banco de dados
  const copiarParaAreaTransferencia = (texto: string, pacienteId: string) => {
    // Primeiro copia para a área de transferência
    navigator.clipboard.writeText(texto).then(() => {
      setSnackbar({ open: true, message: 'Link copiado para a área de transferência!', severity: 'success' });
      
      // Atualiza o banco de dados para marcar como copiado
      if (database) {
        // Atualiza apenas o campo Copiado sem modificar outros campos
        const pacienteRef = ref(database, `/OFT/45/confirmacaoPacientes/site/aEnviar/${pacienteId}`);
        
        // Atualiza apenas o campo Copiado
        update(pacienteRef, { Copiado: true }).catch((error: Error) => {
          console.error('Erro ao atualizar status de cópia no banco de dados:', error);
        });
      }
    }).catch((error: Error) => {
      console.error('Erro ao copiar link:', error);
      setSnackbar({ open: true, message: 'Erro ao copiar o link.', severity: 'error' });
    });
  };

  // Coluna de link para WhatsApp (usada apenas na aba de pacientes)
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
      
      // Usa o número de teste quando estiver no ambiente de teste, senão usa o número do paciente
      const numeroParaEnvio = ambiente === 'teste' ? '21972555867' : whatsappCel.replace(/\D/g, '').replace(/^55/, '');
      const mensagem = formatarMensagemConfirmacao(params.row);
      const whatsappLink = `https://api.whatsapp.com/send/?phone=55${numeroParaEnvio}&text=${mensagem}&type=phone_number&app_absent=0`;
      
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

  // Estilos inline foram movidos para o componente Box

  // Estado para controlar a paginação
  const [paginationModel, setPaginationModel] = React.useState({
    page: 0,
    pageSize: 100,
  });

  // Estado para controlar os checkboxes
  const [selectedRows, setSelectedRows] = React.useState<{[key: string]: boolean}>({});

  // Função para alternar o estado do checkbox e atualizar o Firebase
  const toggleRowSelection = (rowId: string) => {
    const novoEstado = !selectedRows[rowId];
    
    // Atualiza o estado local
    setSelectedRows(prev => ({
      ...prev,
      [rowId]: novoEstado
    }));
    
    // Atualiza o Firebase
    if (database) {
      const updates: Record<string, any> = {};
      const caminho = `/OFT/45/confirmacaoPacientes/site/aEnviar/${rowId}/Copiado`;
      
      if (novoEstado) {
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
          [rowId]: !novoEstado
        }));
      });
    }
  };

  // Função para marcar em lote
  const handleBatchSelect = () => {
    if (!batchSelectType || !batchSelectValue || !database) {
      setSnackbar({ open: true, message: 'Por favor, selecione o tipo e o valor do filtro.', severity: 'warning' });
      return;
    }

    let pacientesParaMarcar: string[] = [];

    if (batchSelectType === 'data') {
      pacientesParaMarcar = rowsPacientes
        .filter(p => extrairApenasData(p.DataMarcada) === batchSelectValue)
        .map(p => p.id);
    } else if (batchSelectType === 'medico') {
      pacientesParaMarcar = rowsPacientes
        .filter(p => p.Medico === batchSelectValue)
        .map(p => p.id);
    } else if (batchSelectType === 'convenio') {
      pacientesParaMarcar = rowsPacientes
        .filter(p => p.Convenio === batchSelectValue)
        .map(p => p.id);
    }

    if (pacientesParaMarcar.length === 0) {
      setSnackbar({ open: true, message: 'Nenhum paciente encontrado com o critério selecionado.', severity: 'info' });
      setBatchSelectOpen(false);
      return;
    }

    const novosSelecionados = { ...selectedRows };
    const updates: Record<string, any> = {};

    pacientesParaMarcar.forEach(id => {
      novosSelecionados[id] = true;
      const caminho = `/OFT/45/confirmacaoPacientes/site/aEnviar/${id}/Copiado`;
      updates[caminho] = true;
    });

    // Atualiza o estado local
    setSelectedRows(novosSelecionados);

    // Atualiza o Firebase em lote
    update(ref(database), updates)
      .then(() => {
        setSnackbar({ open: true, message: `${pacientesParaMarcar.length} paciente(s) marcados com sucesso!`, severity: 'success' });
      })
      .catch(error => {
        console.error('Erro ao marcar pacientes em lote no Firebase:', error);
        setSnackbar({ open: true, message: 'Ocorreu um erro ao marcar os pacientes.', severity: 'error' });
      });

    setBatchSelectOpen(false);
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
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          height: '100%',
          justifyContent: 'flex-start',
          pl: 1,
          position: 'relative'
        }}>
          <span style={{ 
            minWidth: '20px', 
            textAlign: 'right',
            fontFamily: 'monospace'
          }}>
            {value}
          </span>
          <Box 
            component="div"
            sx={{
              position: 'relative',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
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
          </Box>
        </Box>
      );
    }
  };

  // Colunas comuns entre as abas
  const commonColumns: GridColDef[] = [
    { 
      field: 'Paciente', 
      headerName: 'Paciente', 
      flex: 1, 
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <div style={{ fontWeight: 'bold' }}>{params.value || 'Não informado'}</div>
          {params.row.tipo === 'erro' && (
            <div style={{ color: '#d32f2f', fontSize: '0.75rem' }}>
              Erro na confirmação
            </div>
          )}
        </Box>
      )
    },
    { 
      field: 'DataMarcada', 
      headerName: 'Data da Consulta', 
      flex: 1, 
      minWidth: 160,
      valueFormatter: (params) => params.value || 'Não agendado',
      renderCell: (params) => {
        if (!params.value) return 'Não agendado';
        return params.value; // Mostra a data exatamente como está no formato "DD/MM/AAAA HH:MM"
      }
    },
    { 
      field: 'Medico', 
      headerName: 'Médico', 
      flex: 1, 
      minWidth: 160,
      valueFormatter: (params) => params.value || 'Não informado'
    },
    { 
      field: 'Convenio', 
      headerName: 'Convênio', 
      flex: 1, 
      minWidth: 140,
      valueFormatter: (params) => params.value || 'Não informado'
    },
    {
      field: 'IDMarcacao',
      headerName: 'ID Marcação',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params) => params.value || 'N/A'
    },
    {
      field: 'Telefone', 
      headerName: 'Telefone', 
      flex: 1, 
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => {
        const renderTelefone = (tel: string) => {
          if (!tel || tel.trim() === '') return 'Não informado';

          const numeroLimpo = tel.replace(/\D/g, '');
          const numeroExibicao = tel.replace(/^55/, '');
          const whatsappLink = `https://wa.me/55${numeroLimpo.replace(/^55/, '')}`;

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
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
                  style={{ width: '14px', height: '14px', flexShrink: 0 }} 
                />
                {numeroExibicao}
              </a>
              <Tooltip title="Copiar número">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    copiarTelefone(tel, params.row.id);
                  }}
                  sx={{ p: '2px' }}
                >
                  <ContentCopyIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          );
        };

        // Para a sub-aba de Pacientes, mostra APENAS o WhatsAppCel
        if (subTabAtiva === 0) {
          const whatsappCel = params.row.WhatsAppCel || params.row.whatsappcel || params.row.whatsAppCel;
          return renderTelefone(whatsappCel);
        }
        
        // Para a sub-aba de Erros, mostra todos os telefones
        const telefones = [
          params.row.Telefone,
          params.row.TelefoneCel,
          params.row.TelefoneCom,
          params.row.TelefoneRes,
          params.row.WhatsAppCel,
        ].filter(tel => tel && tel.trim() !== '');
        
        if (telefones.length === 0) return 'Não informado';
        
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            {telefones.map((tel, index) => (
              <Box key={index}>
                {renderTelefone(tel)}
              </Box>
            ))}
          </Box>
        );
      }
    },
  ];

  // Colunas para a aba de pacientes (inclui o link e a numeração)
  const columnsPacientes = [numeroSequencialColumn, linkColumn, ...commonColumns];
  
  // Colunas para a aba de erros (inclui a numeração)
  const columnsErros = [numeroSequencialColumn, ...commonColumns];

  // Predicados de filtro
  const extrairApenasData = (dm?: string) => (dm ? String(dm).split(' ')[0] : 'Sem Data');

  const aplicaFiltros = (item: any) => {
    // filtro por data existente (select)
    if (filtroDataExistente.length > 0) {
      const d = extrairApenasData(item.DataMarcada);
      if (!filtroDataExistente.includes(d)) return false;
    }
    // filtro médico (múltiplo)
    if (filtroMedico.length > 0) {
      const med = normalizeMessage(String(item.Medico || ''));
      if (!filtroMedico.map(m => normalizeMessage(m)).includes(med)) return false;
    }
    // filtro convênio (múltiplo)
    if (filtroConvenio.length > 0) {
      const conv = normalizeMessage(String(item.Convenio || ''));
      if (!filtroConvenio.map(c => normalizeMessage(c)).includes(conv)) return false;
    }
    return true;
  };

  // Dados formatados para as tabelas (aplica filtros adicionais)
  const rowsPacientes = useMemo(() => {
    const parseDataParts = (dm?: string) => {
      if (!dm) return { y: 0, m: 0, d: 0, hh: 0, mm: 0, valid: false };
      const [dataStr, horaStr] = String(dm).split(' ');
      if (!dataStr || dataStr === 'Não agendado' || dataStr === 'Sem Data') return { y: 0, m: 0, d: 0, hh: 0, mm: 0, valid: false };
      const [diaS, mesS, anoS] = dataStr.split('/').map(Number);
      const d = Number(diaS), m = Number(mesS), y = Number(anoS);
      let hh = 0, mm = 0;
      if (horaStr) {
        const [hhS, mmS] = horaStr.split(':');
        hh = Number(hhS) || 0;
        mm = Number(mmS) || 0;
      }
      if (!y || !m || !d) return { y: 0, m: 0, d: 0, hh: 0, mm: 0, valid: false };
      return { y, m, d, hh, mm, valid: true };
    };

    const lista = pacientesFiltrados
      .filter(aplicaFiltros)
      .slice()
      .sort((a, b) => {
        const A = parseDataParts(a.DataMarcada);
        const B = parseDataParts(b.DataMarcada);
        // Regra: datas válidas vêm antes das inválidas (inválidas no final)
        if (A.valid && !B.valid) return -1;
        if (!A.valid && B.valid) return 1;
        if (!A.valid && !B.valid) return 0;
        // 1) Data crescente (mais antigas primeiro): compara ano, depois mês, depois dia
        if (A.y !== B.y) return A.y - B.y;
        if (A.m !== B.m) return A.m - B.m;
        if (A.d !== B.d) return A.d - B.d;
        // 2) Mesma data: hora crescente (mais cedo primeiro)
        if (A.hh !== B.hh) return A.hh - B.hh;
        if (A.mm !== B.mm) return A.mm - B.mm;
        return 0;
      });

    return lista.map((paciente) => {
      console.log('Processando paciente:', paciente.id, 'WhatsAppCel:', paciente.WhatsAppCel);
      return {
        id: paciente.id,
        Paciente: paciente.Paciente || 'Não informado',
        DataMarcada: paciente.DataMarcada || 'Não agendado',
        Medico: paciente.Medico || 'Não informado',
        Convenio: paciente.Convenio || 'Não informado',
        // Inclui todos os campos de telefone para uso na renderização
        Telefone: paciente.Telefone,
        TelefoneCel: paciente.TelefoneCel,
        TelefoneCom: paciente.TelefoneCom,
        TelefoneRes: paciente.TelefoneRes,
        WhatsAppCel: paciente.WhatsAppCel,
        IDMarcacao: paciente.IDMarcacao || 'N/A',
        status: paciente.status || 'pendente',
        tipo: 'paciente' as const
      };
    });
  }, [pacientesFiltrados, filtroDataExistente, filtroMedico, filtroConvenio]);

  const rowsErros = useMemo(() => {
    const lista = errosFiltrados.filter(aplicaFiltros);
    return lista.map((erro) => ({
      id: erro.id,
      Paciente: erro.Paciente || 'Não informado',
      DataMarcada: erro.DataMarcada || 'Não agendado',
      Medico: erro.Medico || 'Não informado',
      Convenio: erro.Convenio || 'Não informado',
      TelefoneRes: erro.TelefoneRes || erro.TelefoneCel || erro.Telefone || erro.TelefoneCom || 'Não informado',
      IDMarcacao: erro.IDMarcacao || 'N/A',
      status: 'erro', // Status fixo como 'erro' para destacar na tabela
      mensagem: erro.mensagem || 'Erro na confirmação'
    }));
  }, [errosFiltrados, filtroDataExistente, filtroMedico, filtroConvenio]);
  
  // Alternância de sub-aba poderá ser ativada via toggle futuramente

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box sx={{ flex: 1, minWidth: 320 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder={subTabAtiva === 0 ? "Buscar por nome/telefone..." : "Buscar por nome/telefone..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              label="Texto"
            />
          </Box>

          {/* As abas clássicas serão exibidas abaixo, dentro do Paper principal */}

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Datas existentes</InputLabel>
            <Select
              label="Datas existentes"
              multiple
              value={filtroDataExistente}
              onChange={(e) => setFiltroDataExistente(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
              renderValue={(selected) => (Array.isArray(selected) && selected.length > 0 ? (selected as string[]).join(', ') : '')}
            >
              {datasOrdenadas.map((d) => (
                <MenuItem
                  key={d}
                  value={d}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: '#bcd2ff', // azul um pouco mais escuro
                    },
                    '&.Mui-selected:hover': {
                      backgroundColor: '#a9c4ff',
                    },
                  }}
                >
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Intervalo de datas removido conforme solicitação */}

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Médico</InputLabel>
            <Select
              label="Médico"
              multiple
              value={filtroMedico}
              onChange={(e) => setFiltroMedico(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
              renderValue={(selected) => (Array.isArray(selected) && selected.length > 0 ? (selected as string[]).join(', ') : '')}
            >
              {medicosUnicos.map((m) => (
                <MenuItem
                  key={m}
                  value={m}
                  sx={{
                    '&.Mui-selected': { backgroundColor: '#bcd2ff' },
                    '&.Mui-selected:hover': { backgroundColor: '#a9c4ff' },
                  }}
                >
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Convênio</InputLabel>
            <Select
              label="Convênio"
              multiple
              value={filtroConvenio}
              onChange={(e) => setFiltroConvenio(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
              renderValue={(selected) => (Array.isArray(selected) && selected.length > 0 ? (selected as string[]).join(', ') : '')}
            >
              {conveniosUnicos.map((c) => (
                <MenuItem
                  key={c}
                  value={c}
                  sx={{
                    '&.Mui-selected': { backgroundColor: '#bcd2ff' },
                    '&.Mui-selected:hover': { backgroundColor: '#a9c4ff' },
                  }}
                >
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Atualizar dados">
            <span>
              <IconButton onClick={carregarDados} disabled={loading} color="primary" size="small" sx={{ p: 0.75 }}>
                <RefreshIcon color="inherit" fontSize="medium" />
              </IconButton>
            </span>
          </Tooltip>
          <Button variant="outlined" size="small" onClick={() => {
            setSearch('');
            setFiltroDataExistente([]);
            // filtros de intervalo removidos
            setFiltroMedico([]);
            setFiltroConvenio([]);
          }}>Limpar</Button>
          <Button 
            variant="contained" 
            size="small" 
            onClick={() => {
              setBatchSelectType('');
              setBatchSelectValue('');
              setBatchSelectOpen(true);
            }}
            sx={{ backgroundColor: '#ffc107', color: 'black', '&:hover': { backgroundColor: '#ffa000' } }}
          >
            Marcar em Lote
          </Button>
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
        minWidth: 0, // Garante que o Paper não ultrapasse o contêiner pai
        '& .MuiDataGrid-root': {
          width: '100%',
          minWidth: 0, // Evita que o DataGrid ultrapasse o contêiner
        },
        '& .MuiDataGrid-virtualScroller': {
          overflow: 'auto',
        },
        '& .MuiDataGrid-viewport': {
          minWidth: '100% !important', // Força a largura mínima da viewport
        },
        '& .MuiDataGrid-columnsContainer': {
          minWidth: '100% !important', // Força a largura mínima do container de colunas
        },
        '& .MuiDataGrid-row': {
          minWidth: '100% !important', // Força a largura mínima das linhas
        }
      }}>
        {/* Abas Pacientes/Erros */}
        <Box sx={{ px: 2, pt: 1 }}>
          <Tabs value={subTabAtiva} onChange={(_, v: number) => setSubTabAtiva(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Pacientes</span>
                  {rowsPacientes.length > 0 && (
                    <Box sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                      {rowsPacientes.length}
                    </Box>
                  )}
                </Box>
              }
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Erros</span>
                  {rowsErros.length > 0 && (
                    <Box sx={{ bgcolor: 'error.main', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                      {rowsErros.length}
                    </Box>
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>
        {subTabAtiva === 0 ? (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <DataGrid
              rows={rowsPacientes}
              columns={columnsPacientes}
              autoHeight
              disableRowSelectionOnClick
              disableColumnMenu
              pageSizeOptions={[100]}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pagination
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
                minWidth: 0, // Garante que o grid não ultrapasse o contêiner
              }}
            />
          </Box>
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <DataGrid
              rows={rowsErros}
              columns={columnsErros}
              autoHeight
              disableRowSelectionOnClick
              disableColumnMenu
              pageSizeOptions={[100]}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pagination
              getRowHeight={() => 'auto'}
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
                minWidth: 0, // Garante que o grid não ultrapasse o contêiner
                '& .MuiDataGrid-row': {
                  '& .MuiDataGrid-cell': {
                    whiteSpace: 'normal',
                    lineHeight: 'normal',
                    padding: '8px',
                  },
                },
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Snackbar para feedback de cópia */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {lastUpdated && (
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, textAlign: 'right' }}>
          Última atualização: {lastUpdated.toLocaleString('pt-BR')}
        </Typography>
      )}

      {/* Dialog para seleção em lote */}
      <Dialog open={batchSelectOpen} onClose={() => setBatchSelectOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Marcação em Lote</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Selecione um critério para marcar todos os pacientes correspondentes na tabela.
          </DialogContentText>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Critério</InputLabel>
            <Select
              label="Critério"
              value={batchSelectType}
              onChange={(e) => {
                setBatchSelectType(e.target.value);
                setBatchSelectValue(''); // Reseta o valor ao trocar o tipo
              }}
            >
              <MenuItem value="data">Data</MenuItem>
              <MenuItem value="medico">Médico</MenuItem>
              <MenuItem value="convenio">Convênio</MenuItem>
            </Select>
          </FormControl>

          {batchSelectType && (
            <FormControl fullWidth size="small" disabled={!batchSelectType}>
              <InputLabel>Valor</InputLabel>
              <Select
                label="Valor"
                value={batchSelectValue}
                onChange={(e) => setBatchSelectValue(e.target.value)}
              >
                {batchSelectType === 'data' && datasOrdenadas.map(d => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
                {batchSelectType === 'medico' && medicosUnicos.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
                {batchSelectType === 'convenio' && conveniosUnicos.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchSelectOpen(false)}>Cancelar</Button>
          <Button 
            onClick={handleBatchSelect} 
            variant="contained"
            disabled={!batchSelectType || !batchSelectValue}
          >
            Aplicar e Marcar
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default ConfirmacaoPacientes;
