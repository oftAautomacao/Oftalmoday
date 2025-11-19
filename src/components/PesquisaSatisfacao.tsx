import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue, update, DataSnapshot } from 'firebase/database';
import { useAmbiente } from '../contexts/AmbienteContext';
import { normalizeMessage } from '../utils/normalizeMessage';
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
  AlertProps as MuiAlertProps,
  FormControl, // Added
  InputLabel, // Added
  Select, // Added
  MenuItem, // Added
  Button, // Added
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
  WhatsAppCel?: string;
  TelefoneCel?: string;
  TelefoneRes?: string;
  TelefoneCom?: string;
  Telefone?: string;
  IDMarcacao?: string;
  status: string;
  tipo?: 'paciente' | 'erro';
  mensagem?: string;
  Copiado?: boolean; // Added for checkbox state
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

interface Mensagem {
  ID: number;
  Texto: string;
}

const PesquisaSatisfacao: React.FC = () => {
  const { database } = useAmbiente();
  const [dados, setDados] = useState<DadosFirebase>({ aEnviar: {}, erro: {} });
  const [search, setSearch] = useState('');
  // Filtros
  const [filtroDataExistente, setFiltroDataExistente] = useState<string[]>([]); // [] = todas
  const [filtroMedico, setFiltroMedico] = useState<string[]>([]); // [] = todos
  const [filtroConvenio, setFiltroConvenio] = useState<string[]>([]); // [] = todos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState(0);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [selectedRows, setSelectedRows] = useState<{[key: string]: boolean}>({});
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 100,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // Added
  const [mensagensPesquisa, setMensagensPesquisa] = useState<Mensagem[]>([]);

  // Estado para o dialog de seleção em lote
  const [batchSelectOpen, setBatchSelectOpen] = useState(false);
  const [batchSelectType, setBatchSelectType] = useState(''); // 'data', 'medico', 'convenio'
  const [batchSelectValue, setBatchSelectValue] = useState('');

  useEffect(() => {
    if (database) {
      const pesquisaRef = ref(database, '/OFT/45/pesquisaSatisfacao/mensagens/consulta/1RPT5vKrcbNRRQZ7AeyfMNK620ksxeAqqIDJ-YivIPS0/mensagemConsulta');
      onValue(pesquisaRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const mensagensArray = Object.values(data) as Mensagem[];
          setMensagensPesquisa(mensagensArray);
        }
      });
    }
  }, [database]);

  // Processa os dados para exibição
  const { pacientesFiltrados, errosFiltrados } = useMemo(() => {
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
            mensagem: 'Erro na pesquisa de satisfação' // Adjusted message
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

    const filteredPacientes = search
      ? listaPacientes.filter(p => filterFn(p, searchTerm))
      : listaPacientes;
    const filteredErros = search
      ? listaErros.filter(e => filterFn(e, searchTerm))
      : listaErros;

    return { pacientesFiltrados: filteredPacientes, errosFiltrados: filteredErros }; // Renamed
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

    [...pacientesFiltrados, ...errosFiltrados].forEach((item: Paciente) => {
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
      setError('Banco de dados não está disponível');
      return;
    }

    setLoading(true); // Set loading true when starting data load
    setError(null);

    const path = '/OFT/45/pesquisaSatisfacao/site';
    const rootRef = ref(database, path);

    const onDataChange = (snapshot: DataSnapshot) => {
      try {
        if (snapshot.exists()) {
          const dadosFirebase = snapshot.val();
          setDados(dadosFirebase || { aEnviar: {}, erro: {} });
          setLastUpdated(new Date()); // Set last updated time
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

    const onError = (error: Error) => {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao conectar ao banco de dados');
      setLoading(false); // Set loading false on error
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
    const novosSelecionados: { [key: string]: boolean } = {};
    if (dados.aEnviar) {
      Object.entries(dados.aEnviar).forEach(([id, paciente]) => {
        if (paciente.Copiado === true || paciente.Medico === "Campo Visual") {
          novosSelecionados[id] = true;
        }
      });
    }
    setSelectedRows(novosSelecionados);
  }, [dados]);

  // Efeito para marcar 'Campo Visual' como Copiado no Firebase ao carregar
  useEffect(() => {
    if (!database || !dados.aEnviar) return;

    const updates: Record<string, true> = {};
    Object.entries(dados.aEnviar).forEach(([id, paciente]) => {
      if (paciente.Medico === "Campo Visual" && paciente.Copiado !== true) {
        updates[`/OFT/45/pesquisaSatisfacao/site/aEnviar/${id}/Copiado`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      update(ref(database), updates).catch(error => {
        console.error("Erro ao marcar 'Campo Visual' automaticamente no DB:", error);
        setSnackbar({ open: true, message: "Erro ao atualizar status para Campo Visual.", severity: 'error' });
      });
    }
  }, [dados, database]); // Depende de dados e database para re-executar

  // Efeito para carregar os dados
  useEffect(() => {
    const unsubscribe = carregarDados();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [carregarDados]);

  // Função para copiar apenas o telefone
  const copiarTelefone = (telefone: string, pacienteId: string) => {
    const numeroLimpo = String(telefone).replace(/\D/g, '');
    navigator.clipboard.writeText(numeroLimpo).then(() => {
      setSnackbar({ open: true, message: 'Telefone copiado!', severity: 'success' });
      
      // Atualiza o banco de dados para marcar como copiado
      if (database) {
        const pacienteRef = ref(database, `/OFT/45/pesquisaSatisfacao/site/aEnviar/${pacienteId}`);
        update(pacienteRef, { Copiado: true }).catch((error: Error) => {
          console.error('Erro ao atualizar status de cópia no banco de dados:', error);
        });
      }
    }).catch((err) => {
      console.error('Falha ao copiar telefone: ', err);
      setSnackbar({ open: true, message: 'Falha ao copiar telefone.', severity: 'error' });
    });
  };

  // Função para copiar o link do WhatsApp para a área de transferência
  const copiarParaAreaTransferencia = (texto: string, pacienteId: string) => {
    // Primeiro copia para a área de transferência
    navigator.clipboard.writeText(texto).then(() => {
      setSnackbar({
        open: true,
        message: 'Texto copiado para a área de transferência!',
        severity: 'success'
      });

      // Atualiza o banco de dados para marcar como copiado
      if (database) {
        // Atualiza apenas o campo Copiado sem modificar outros campos
        const pacienteRef = ref(database, `/OFT/45/pesquisaSatisfacao/site/aEnviar/${pacienteId}`);

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
    let mensagem: string;

    if (mensagensPesquisa.length > 0) {
      // Escolhe uma mensagem aleatória
      const randomIndex = Math.floor(Math.random() * mensagensPesquisa.length);
      mensagem = mensagensPesquisa[randomIndex].Texto;

      // Substitui as variáveis na mensagem
      mensagem = mensagem.replace(/{Paciente}/g, paciente.Paciente || '');
      mensagem = mensagem.replace(/{DataMarcada}/g, paciente.DataMarcada || '');
      mensagem = mensagem.replace(/{Medico}/g, paciente.Medico || '');
      mensagem = mensagem.replace(/{Convenio}/g, paciente.Convenio || '');
      
    } else {
      // Texto principal da mensagem (fallback)
      mensagem = `Olá!\nSomos da Clínica Oftalmo Day.`;
      mensagem += `\n\nObrigado por escolher nosso atendimento para ${paciente.Paciente} em ${data}.`;
      mensagem += `\n\nPara que possamos melhorar ainda mais, pedimos que clique no link abaixo, avalie-nos no Google e deixe um comentário.`;
      mensagem += `\n\nhttps://g.page/r/CfkFYbj9RhlpEBM/review`;
      mensagem += `\n\nObrigado e até a próxima consulta.`;
    }

    // Adiciona o telefone no final
    if (paciente.WhatsAppCel) {
      mensagem += `\n\n${paciente.WhatsAppCel}`;
    }

    // Retorna a mensagem bruta
    return mensagem;
  }, [mensagensPesquisa]);

  // Função para alternar a seleção de uma linha
  const toggleRowSelection = (rowId: string) => {
    const novoEstado = !selectedRows[rowId];

    setSelectedRows(prev => ({
      ...prev,
      [rowId]: novoEstado
    }));

    // Atualiza o Firebase
    if (database) {
      const updates: Record<string, boolean | null> = {};
      const caminho = `/OFT/45/pesquisaSatisfacao/site/aEnviar/${rowId}/Copiado`;

      if (novoEstado) { // Use novoEstado here
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

  // Predicados de filtro
  const extrairApenasData = (dm?: string) => (dm ? String(dm).split(' ')[0] : 'Sem Data');

  const aplicaFiltros = (item: Paciente) => {
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

  // Função para Seleção Multipla
  const handleBatchAction = (action: 'marcar' | 'desmarcar') => {
    if (!batchSelectType || !batchSelectValue || !database) {
      setSnackbar({ open: true, message: 'Por favor, selecione o tipo e o valor do filtro.', severity: 'warning' });
      return;
    }

    const pacientesVisiveis = pacientesFiltrados.filter(aplicaFiltros);
    let pacientesParaMarcar: string[] = [];

    if (batchSelectType === 'data') {
      pacientesParaMarcar = pacientesVisiveis
        .filter(p => extrairApenasData(p.DataMarcada) === batchSelectValue)
        .map(p => p.id);
    } else if (batchSelectType === 'medico') {
      pacientesParaMarcar = pacientesVisiveis
        .filter(p => p.Medico === batchSelectValue)
        .map(p => p.id);
    } else if (batchSelectType === 'convenio') {
      pacientesParaMarcar = pacientesVisiveis
        .filter(p => p.Convenio === batchSelectValue)
        .map(p => p.id);
    }

    if (pacientesParaMarcar.length === 0) {
      setSnackbar({ open: true, message: 'Nenhum paciente encontrado com o critério selecionado.', severity: 'info' });
      setBatchSelectOpen(false);
      return;
    }

    const novosSelecionados = { ...selectedRows };
    const updates: Record<string, boolean | null> = {};

    pacientesParaMarcar.forEach(id => {
      const caminho = `/OFT/45/pesquisaSatisfacao/site/aEnviar/${id}/Copiado`;
      if (action === 'marcar') {
        novosSelecionados[id] = true;
        updates[caminho] = true;
      } else { // 'desmarcar'
        delete novosSelecionados[id];
        updates[caminho] = null; // null remove o campo no Firebase
      }
    });

    // Atualiza o estado local
    setSelectedRows(novosSelecionados);

    const successMessage = action === 'marcar'
      ? `${pacientesParaMarcar.length} paciente(s) marcados com sucesso!`
      : `${pacientesParaMarcar.length} paciente(s) desmarcado(s) com sucesso!`;

    const errorMessage = action === 'marcar'
      ? 'Ocorreu um erro ao marcar os pacientes.'
      : 'Ocorreu um erro ao desmarcar os pacientes.';

    // Atualiza o Firebase em lote
    update(ref(database), updates)
      .then(() => setSnackbar({ open: true, message: successMessage, severity: 'success' }))
      .catch(error => {
        console.error('Erro ao marcar pacientes em lote no Firebase:', error);
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      });

    setBatchSelectOpen(false);
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
              checked={!!selectedRows[rowId] || params.row.Medico === "Campo Visual"}
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

  // Coluna de texto para pesquisa de satisfação
  const linkColumn: GridColDef = {
    field: 'link',
    headerName: 'Texto Pesquisa',
    flex: 1,
    minWidth: 300,
    sortable: false,
    filterable: false,
    renderCell: (params: GridRenderCellParams) => {
      if (params.row.Medico === "Campo Visual") {
        return '';
      }
      const whatsappCel = params.row.WhatsAppCel || '';
      if (!whatsappCel || whatsappCel.trim() === '') return 'Sem WhatsApp';

      const mensagem = formatarMensagem(params.row);
      // const numeroParaEnvio = ambiente === 'teste' ? '21972555867' : whatsappCel.replace(/\D/g, '').replace(/^55/, '');
      // const encodedMensagem = encodeURIComponent(mensagem).replace(/'/g, "%27").replace(/\*/g, "%2A");
      // const whatsappLink = `https://api.whatsapp.com/send/?phone=55${numeroParaEnvio}&text=${encodedMensagem}&type=phone_number&app_absent=0`;

      return (
        <Tooltip title="Clique para copiar o link" arrow>
          <Box
            component="div"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copiarParaAreaTransferencia(mensagem, params.row.id);
            }}
            sx={{
              width: '100%',
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: 'pointer',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: '#f0f0f0',
              },
              padding: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
              transition: 'background-color 0.2s',
              boxSizing: 'border-box',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {mensagem}
          </Box>
        </Tooltip>
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
              Erro na pesquisa de satisfação
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
        if (tabAtiva === 0) {
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

    return lista.map((paciente) => ({
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
      tipo: 'paciente' as const,
      Copiado: paciente.Copiado, // Include Copiado status
    }));
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
      mensagem: erro.mensagem || 'Erro na pesquisa de satisfação',
      Copiado: erro.Copiado, // Include Copiado status
    }));
  }, [errosFiltrados, filtroDataExistente, filtroMedico, filtroConvenio]);


  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap"> {/* Added flexWrap */}
          <Box sx={{ flex: 1, minWidth: 320 }}> {/* Added minWidth */}
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder={tabAtiva === 0 ? "Buscar por nome/telefone..." : "Buscar por nome/telefone..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              label="Texto" // Added label
            />
          </Box>

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

          <Box sx={{ flexGrow: 1 }} /> {/* Spacer */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Atualizar dados">
              <span>
                <IconButton
                  onClick={carregarDados} // Call carregarDados directly
                  disabled={loading}
                  sx={{
                    backgroundColor: '#e8f5e9', // Verde claro
                    '&:hover': {
                      backgroundColor: '#c8e6c9' // Verde um pouco mais escuro no hover
                    },
                    '&:disabled': {
                      backgroundColor: 'action.disabledBackground',
                      color: 'action.disabled'
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
            <Button variant="outlined" size="small" onClick={() => {
              setSearch('');
              setFiltroDataExistente([]);
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
              Seleção Multipla
            </Button>
          </Stack>
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
                <span>Pesquisas</span>
                {rowsPacientes.length > 0 && (
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
                    {rowsErros.length}
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
              rows={rowsPacientes} // Changed from pacientes
              columns={columnsPacientes} // Changed from colunas
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
                      {search ? 'Nenhum resultado para a busca atual' : 'Nenhum paciente na lista de pesquisa de satisfação'}
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
              rows={rowsErros} // Changed from erros
              columns={columnsErros} // Changed from colunas
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
                      {search ? 'Nenhum resultado para a busca atual' : 'Nenhum erro na lista de pesquisa de satisfação'}
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
          <Button onClick={() => handleBatchAction('desmarcar')} variant="outlined" color="secondary" disabled={!batchSelectType || !batchSelectValue}>Desmarcar</Button>
          <Button onClick={() => handleBatchAction('marcar')} variant="contained" disabled={!batchSelectType || !batchSelectValue}>Marcar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PesquisaSatisfacao;
