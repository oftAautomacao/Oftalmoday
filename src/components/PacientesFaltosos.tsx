import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from 'date-fns/locale/pt-BR';

registerLocale('pt-BR', ptBR);
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
} from '@mui/material';

// Componente Alert personalizado para o Snackbar
const Alert = React.forwardRef<HTMLDivElement, MuiAlertProps>(function Alert(
  props,
  ref,
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ListAltIcon from "@mui/icons-material/ListAlt";
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

const PacientesFaltosos: React.FC = () => {
  const { database } = useAmbiente();
  const [dados, setDados] = useState<DadosFirebase>({ aEnviar: {}, erro: {} });
  const [search, setSearch] = useState('');
  // Filtros
  const [dataInicial, setDataInicial] = useState<Date | null>(null);
  const [dataFinal, setDataFinal] = useState<Date | null>(null);
  const [tipoFiltroData, setTipoFiltroData] = useState<'avulso' | 'periodo'>('avulso');
  const [filtroDataExistente, setFiltroDataExistente] = useState<string[]>([]); // [] = todas
  const [filtroMedico, setFiltroMedico] = useState<string[]>([]); // [] = todos
  const [filtroConvenio, setFiltroConvenio] = useState<string[]>([]); // [] = todos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState(0); // 0: Pacientes, 1: Erros
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [selectedRows, setSelectedRows] = useState<{ [key: string]: boolean }>({});
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 100,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // Added

  // Estados de batch select removidos



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
            mensagem: 'Erro nos pacientes faltosos' // Adjusted message
          });
        }
      }
    }

    if (!search) {
      return {
        pacientesFiltrados: listaPacientes,
        errosFiltrados: listaErros
      };
    }

    const searchNormalized = normalizeMessage(search);

    const pacientesFiltrados = listaPacientes.filter(paciente =>
      Object.entries(paciente).some(([key, value]) => {
        if (['id', 'tipo', 'IDMarcacao'].includes(key)) return false;
        return normalizeMessage(String(value)).includes(searchNormalized);
      })
    );

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

    const path = '/OFT/45/pacientesFaltosos/site';
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
    if (dados.aEnviar) {
      const novosSelecionados: { [key: string]: boolean } = {};

      // Itera sobre os pacientes e verifica se o campo 'Copiado' está como true
      Object.entries(dados.aEnviar).forEach(([id, paciente]) => {
        if (paciente.Copiado === true || paciente.Medico === "Campo Visual") {
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

  // Função para copiar apenas o telefone
  const copiarTelefone = (telefone: string) => {
    const numeroLimpo = String(telefone).replace(/\D/g, '');
    navigator.clipboard.writeText(numeroLimpo).then(() => {
      setSnackbar({ open: true, message: 'Telefone copiado!', severity: 'success' });
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
        const pacienteRef = ref(database, `/OFT/45/pacientesFaltosos/site/aEnviar/${pacienteId}`);

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
    const hora = dataMarcada[2]; // Pega a hora diretamente do segundo elemento

    // Texto principal da mensagem
    let mensagem = `Olá!\nAqui é da Oftalmo Day.`

    mensagem += `\nVimos que não pôde comparecer à consulta agendada em ${data} às ${hora} com o(a) Dr(a) ${paciente.Medico}. 
      \nGostaria de reagendar? 😊`;

    // Retorna a mensagem bruta
    return mensagem;
  }, []);

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
      const caminho = `/OFT/45/pacientesFaltosos/site/aEnviar/${rowId}/Copiado`;

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
        // Filtro por Período (Calendário)
    if (dataInicial) {
      const dStr = extrairApenasData(item.DataMarcada);
      if (dStr === 'Sem Data' || dStr === 'Não agendado') return false;
      const [dia, mes, ano] = dStr.split('/').map(Number);
      const dataPac = new Date(ano, mes - 1, dia);
      dataPac.setHours(0, 0, 0, 0);
      
      const dInicio = new Date(dataInicial);
      dInicio.setHours(0, 0, 0, 0);

      if (dataFinal) {
        const dFim = new Date(dataFinal);
        dFim.setHours(0, 0, 0, 0);
        if (dataPac < dInicio || dataPac > dFim) return false;
      } else {
        // Se só tem data inicial, mostra apenas esse dia
        if (dataPac.getTime() !== dInicio.getTime()) return false;
      }
    }

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

  // Função para Marcar/Desmarcar Visíveis
  const handleBatchAction = (action: 'marcar' | 'desmarcar') => {
    if (!database) return;

    if (allRowsPacientes.length === 0) {
      setSnackbar({ open: true, message: 'Nenhum paciente visível para selecionar.', severity: 'info' });
      return;
    }

    const novosSelecionados = { ...selectedRows };
    const updates: Record<string, boolean | null> = {};

    allRowsPacientes.forEach(p => {
      const caminho = `/OFT/45/pacientesFaltosos/site/aEnviar/${p.id}/Copiado`;
      if (action === 'marcar') {
        novosSelecionados[p.id] = true;
        updates[caminho] = true;
      } else {
        delete novosSelecionados[p.id];
        updates[caminho] = null;
      }
    });

    setSelectedRows(novosSelecionados);

    const successMessage = action === 'marcar'
      ? `${allRowsPacientes.length} paciente(s) marcados com sucesso!`
      : `${allRowsPacientes.length} paciente(s) desmarcado(s) com sucesso!`;

    update(ref(database), updates)
      .then(() => setSnackbar({ open: true, message: successMessage, severity: 'success' }))
      .catch(error => {
        console.error('Erro ao marcar pacientes no Firebase:', error);
        setSnackbar({ open: true, message: 'Ocorreu um erro ao atualizar.', severity: 'error' });
      });
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

  // Coluna de texto para pacientes faltosos
  const linkColumn: GridColDef = {
    field: 'link',
    headerName: 'Texto Faltosos',
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
              overflowY: 'auto',
              cursor: 'pointer',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: '#f0f0f0',
              },
              padding: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'flex-start',
              transition: 'background-color 0.2s',
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
                    copiarTelefone(tel);
                  }}
                  sx={{ p: '2px' }}
                >
                  <ContentCopyIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          );
        };

        // Para a aba de Pacientes, mostra APENAS o WhatsAppCel
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
              Erro nos pacientes faltosos
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

  ];

  // Colunas para a aba de pacientes (inclui o link e a numeração)
  const columnsPacientes = [numeroSequencialColumn, linkColumn, ...commonColumns];

  // Colunas para a aba de erros (inclui a numeração)
  const columnsErros = [numeroSequencialColumn, ...commonColumns];

  // Para pacientes faltosos, também envia no dia seguinte à consulta (exceto segunda)
  const calcularDiaEnvio = (dataStr: string): Date | null => {
    if (!dataStr) return null;
    const parts = String(dataStr).split(' ')[0].split('/');
    if (parts.length !== 3) return null;
    const [dia, mes, ano] = parts.map(Number);
    if (!dia || !mes || !ano) return null;
    const diaEnvio = new Date(ano, mes - 1, dia);
    diaEnvio.setDate(diaEnvio.getDate() + 1);
    // Se o dia seguinte cai na segunda, não manda
    if (diaEnvio.getDay() === 1) return null;
    return diaEnvio;
  };

  const formatarDataEnvio = (data: Date): string => {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    return `${diasSemana[data.getDay()]}, ${dia}/${mes}/${ano}`;
  };

  // Métricas de Envio
  const metricasEnvio = useMemo(() => {
    let comTemplate = 0;
    let semTemplate = 0;
    let erros = 0;
    let naoEnviados = 0;
    let manual = 0;
    let remarcados = 0;
    let isentoCampoVisual = 0;
    const listaCompletaEnvio: any[] = [];

    if (dados.aEnviar) {
      Object.entries(dados.aEnviar).forEach(([id, p]) => {
        const paciente = p as any;
        
        if (!aplicaFiltros(paciente as Paciente)) return;

        let pStatus = 'Não Enviado';
        let pMetodo = 'Não informado';
        let remarcado = false;

        const temDadosEnvioAuto = !!(paciente.Metodo || paciente.Status || paciente.response);
        const temCopiado = paciente.Copiado === true;
        const isCampoVisual = String(paciente.Medico || '').trim().toUpperCase() === 'CAMPO VISUAL';

        if (isCampoVisual) {
          pMetodo = 'Não se aplica';
          pStatus = 'Não Enviado';
          isentoCampoVisual++;
          paciente.response = 'Não enviamos mensagem para pacientes de Campo Visual.';
        } else if (paciente.Status === 'failed') {
          erros++;
          pStatus = 'Erro';
          if (!temCopiado) {
            remarcado = true;
            remarcados++;
          }
        } else if (temDadosEnvioAuto) {
          pStatus = 'Sucesso';
          if (String(paciente.Metodo).toLowerCase().includes('com template')) {
            comTemplate++;
            pMetodo = 'Com Template';
          } else if (String(paciente.Metodo).toLowerCase().includes('sem template')) {
            semTemplate++;
            pMetodo = 'Sem Template';
          } else {
            pMetodo = paciente.Metodo || 'Não informado';
          }
          if (!temCopiado) {
            remarcado = true;
            remarcados++;
          }
        } else if (temCopiado) {
          pMetodo = 'Manual';
          pStatus = 'Sucesso';
          manual++;
        }

        let atrasado = false;
        let dataEnvioCalculada: string | null = null;
        if (paciente.DataMarcada) {
          const dEnvio = calcularDiaEnvio(String(paciente.DataMarcada));
          if (dEnvio) {
            dataEnvioCalculada = formatarDataEnvio(dEnvio);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (dEnvio < hoje) {
              atrasado = true;
            }
          }
        }

        if (pStatus === 'Não Enviado') {
          naoEnviados++;
        }

        listaCompletaEnvio.push({
          ...paciente,
          id,
          StatusEnvio: pStatus,
          MetodoEnvio: pMetodo,
          remarcado,
          dataEnvioCalculada,
          atrasado
        });
      });
    }

    listaCompletaEnvio.sort((a, b) => {
      const cmpData = (d?: string) => {
        if (!d) return 0;
        const [dia, mes, ano] = d.split(' ')[0].split('/').map(Number);
        return new Date(ano, mes - 1, dia).getTime();
      }
      return cmpData(a.DataMarcada) - cmpData(b.DataMarcada);
    });

    return { 
      comTemplate, 
      semTemplate, 
      erros, 
      naoEnviados,
      manual,
      remarcados,
      isentoCampoVisual,
      listaCompletaEnvio, 
      custo: comTemplate * 0.04 
    };
  }, [dados.aEnviar, pacientesFiltrados, filtroDataExistente, filtroMedico, filtroConvenio, dataInicial, dataFinal, search]);

  // Atualiza métricas diárias silenciosamente
  useEffect(() => {
    const naoTemFiltros = !search && !dataInicial && !dataFinal && filtroDataExistente.length === 0 && filtroMedico.length === 0 && filtroConvenio.length === 0;
    
    if (naoTemFiltros && database && (metricasEnvio.comTemplate > 0 || metricasEnvio.semTemplate > 0)) {
      const hoje = new Date().toISOString().split('T')[0];
      const metricasRef = ref(database, `/OFT/45/pacientesFaltosos/metricasEnvio/${hoje}`);
      update(metricasRef, {
        templates: metricasEnvio.comTemplate,
        semTemplates: metricasEnvio.semTemplate
      }).catch(err => console.error('Erro ao salvar métricas:', err));
    }
  }, [database, metricasEnvio.comTemplate, metricasEnvio.semTemplate, search, dataInicial, dataFinal, filtroDataExistente, filtroMedico, filtroConvenio]);

  // Dados formatados para as tabelas (aplica filtros adicionais)
  const allRowsPacientes = useMemo(() => {
    const parseDataParts = (dm?: string) => {
      if (!dm) return { y: 0, m: 0, d: 0, hh: 0, mm: 0, valid: false };

      // Usa regex para dividir por qualquer quantidade de espaços em branco
      const parts = String(dm).trim().split(/\s+/);
      const dataStr = parts[0];
      const horaStr = parts.length > 1 ? parts[1] : '';

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
  }, [pacientesFiltrados, filtroDataExistente, filtroMedico, filtroConvenio, dataInicial, dataFinal]);




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
      mensagem: erro.mensagem || 'Erro nos pacientes faltosos',
      Copiado: erro.Copiado, // Include Copiado status
    }));
  }, [errosFiltrados, filtroDataExistente, filtroMedico, filtroConvenio, dataInicial, dataFinal]);


  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Linha 1: Filtros */}
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Buscar por nome/telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              label="Texto"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tipoFiltroData === 'avulso' ? (
                <FormControl size="small" fullWidth>
                  <InputLabel>Datas existentes</InputLabel>
                  <Select
                    label="Datas existentes"
                    multiple
                    value={filtroDataExistente}
                    onChange={(e) => setFiltroDataExistente(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                    renderValue={(selected) => (Array.isArray(selected) && selected.length > 0 ? (selected.length > 2 ? `${(selected as string[]).slice(0, 2).join(', ')} (+${selected.length - 2})` : (selected as string[]).join(', ')) : '')}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}
                  >
                    {datasOrdenadas.map((d) => (
                      <MenuItem key={d} value={d} sx={{ '&.Mui-selected': { backgroundColor: '#bcd2ff' }, '&.Mui-selected:hover': { backgroundColor: '#a9c4ff' } }}>
                        {d}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <DatePicker
                  selectsRange={true}
                  startDate={dataInicial}
                  endDate={dataFinal}
                  onChange={(update) => {
                    const [start, end] = update;
                    setDataInicial(start);
                    setDataFinal(end);
                  }}
                  isClearable={true}
                  locale="pt-BR"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Selecione o período"
                  customInput={
                    <TextField
                      fullWidth
                      size="small"
                      label="Período"
                      InputProps={{
                        startAdornment: <CalendarMonthIcon sx={{ mr: 1, color: 'text.secondary', fontSize: '1.2rem' }} />,
                      }}
                    />
                  }
                />
              )}
              <Tooltip title={tipoFiltroData === 'avulso' ? "Mudar para Período (Calendário)" : "Mudar para Datas Avulsas"}>
                <IconButton 
                  onClick={() => setTipoFiltroData(tipoFiltroData === 'avulso' ? 'periodo' : 'avulso')}
                  color="primary"
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  {tipoFiltroData === 'avulso' ? <CalendarMonthIcon /> : <ListAltIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Médico</InputLabel>
              <Select
                label="Médico"
                multiple
                value={filtroMedico}
                onChange={(e) => setFiltroMedico(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                renderValue={(selected) => (Array.isArray(selected) && selected.length > 0 ? (selected.length > 1 ? `${(selected as string[]).slice(0, 1).join(', ')} (+${selected.length - 1})` : (selected as string[]).join(', ')) : '')}
                MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}
              >
                {medicosUnicos.map((m) => (
                  <MenuItem key={m} value={m} sx={{ '&.Mui-selected': { backgroundColor: '#bcd2ff' }, '&.Mui-selected:hover': { backgroundColor: '#a9c4ff' } }}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Convênio</InputLabel>
              <Select
                label="Convênio"
                multiple
                value={filtroConvenio}
                onChange={(e) => setFiltroConvenio(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                renderValue={(selected) => (Array.isArray(selected) && selected.length > 0 ? (selected.length > 1 ? `${(selected as string[]).slice(0, 1).join(', ')} (+${selected.length - 1})` : (selected as string[]).join(', ')) : '')}
                MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}
              >
                {conveniosUnicos.map((c) => (
                  <MenuItem key={c} value={c} sx={{ '&.Mui-selected': { backgroundColor: '#bcd2ff' }, '&.Mui-selected:hover': { backgroundColor: '#a9c4ff' } }}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Linha 2: Ações */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', mt: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Atualizar dados">
                  <span>
                    <IconButton
                      onClick={carregarDados}
                      disabled={loading}
                      sx={{
                        backgroundColor: '#e8f5e9',
                        '&:hover': { backgroundColor: '#c8e6c9' },
                        '&:disabled': { backgroundColor: 'action.disabledBackground', color: 'action.disabled' }
                      }}
                    >
                      {loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
                
                <Button variant="outlined" size="small" onClick={() => {
                  setSearch('');
                  setFiltroDataExistente([]);
                  setFiltroMedico([]);
                  setFiltroConvenio([]);
                  setDataInicial(null);
                  setDataFinal(null);
                }}>
                  Limpar
                </Button>

                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleBatchAction('marcar')}
                  sx={{ backgroundColor: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb', boxShadow: 'none', '&:hover': { backgroundColor: '#bbdefb', boxShadow: 'none' } }}
                >
                  Marcar Todos
                </Button>
                
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  onClick={() => handleBatchAction('desmarcar')} sx={{ color: "text.secondary", borderColor: "divider", "&:hover": { borderColor: "text.secondary", backgroundColor: "transparent" } }}
                >
                  Desmarcar Todos
                </Button>
              </Stack>
            </Box>
          </Grid>
        </Grid>
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
        },
        '& .MuiDataGrid-row': {
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
                {allRowsPacientes.length > 0 && (
                  <Box sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                    {allRowsPacientes.length}
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
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Informações de Envio</span>
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
              rows={allRowsPacientes} // Changed from pacientes
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
                      {search ? 'Nenhum resultado para a busca atual' : 'Nenhum paciente na lista de faltosos'}
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
          ) : tabAtiva === 2 ? (
            <Box sx={{ p: 3, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#e3f2fd', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Com Template</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{metricasEnvio.comTemplate}</Typography>
                </Paper>
  
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#f3e5f5', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Sem Template</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{metricasEnvio.semTemplate}</Typography>
                </Paper>
  
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#e8f5e9', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Envio Manual</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{metricasEnvio.manual}</Typography>
                </Paper>
  
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#fff8e1', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Remarcados</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#e65100' }}>{metricasEnvio.remarcados}</Typography>
                </Paper>
  
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#ffebee', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Erros</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{metricasEnvio.erros}</Typography>
                </Paper>
  
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#f5f5f5', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Não Enviadas</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{metricasEnvio.naoEnviados}</Typography>
                </Paper>
  
                <Paper sx={{ p: 1.5, flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#fff3e0', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" align="center" color="textSecondary" sx={{ minHeight: 40 }}>Custo (R$ 0,04)</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>R$ {metricasEnvio.custo.toFixed(2).replace('.', ',')}</Typography>
                </Paper>
              </Box>
              
              <Box sx={{ mt: 3, flex: 1, minHeight: 400 }}>
                <DataGrid
                  rows={metricasEnvio.listaCompletaEnvio}
                  columns={[
                    { field: 'DataMarcada', headerName: 'Data Agendada', width: 140 },
                    { 
                      field: 'Paciente', 
                      headerName: 'Paciente', 
                      flex: 1, 
                      minWidth: 200,
                      renderCell: (params: any) => (
                        <Tooltip title="Duplo clique para buscar na aba Pacientes">
                          <Box 
                            onDoubleClick={() => {
                              setSearch(params.value);
                              setTabAtiva(0); // Muda para a aba Pacientes
                            }}
                            sx={{ 
                              cursor: 'pointer', 
                              '&:hover': { textDecoration: 'underline', color: 'primary.main' },
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {params.value}
                          </Box>
                        </Tooltip>
                      )
                    },
                    { field: 'TelefoneRes', headerName: 'Telefone', width: 150, renderCell: (params: any) => params.row.WhatsAppCel || params.row.TelefoneCel || params.row.TelefoneRes || 'Não informado' },
                    { 
                      field: 'StatusEnvio', 
                      headerName: 'Status', 
                      width: 120,
                      renderCell: (params: any) => {
                        let color = 'text.secondary';
                        if (params.value === 'Sucesso') color = 'success.main';
                        else if (params.value === 'Erro') color = 'error.main';
                        else if (params.value === 'Não Enviado') {
                          // Se for isento (Não se aplica), usa cor neutra, senão checa atraso
                          if (params.row.MetodoEnvio === 'Não se aplica') color = 'text.disabled';
                          else color = params.row.atrasado ? 'error.main' : 'text.secondary';
                        }
                        
                        return (
                          <Box sx={{ color, fontWeight: 'bold' }}>
                            {params.value}
                          </Box>
                        );
                      }
                    },
                    { 
                      field: 'MetodoEnvio', 
                      headerName: 'Método', 
                      width: 170,
                      renderCell: (params: any) => {
                        if (params.value === 'Manual') {
                          return (
                            <Box sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              bgcolor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7',
                              borderRadius: '4px', px: 1.5, py: 0.5,
                              fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                              ✋ Manual
                            </Box>
                          );
                        }
                        if (params.value === 'Não se aplica') {
                          return (
                            <Box sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              bgcolor: '#f5f5f5', color: '#757575', border: '1px solid #e0e0e0',
                              borderRadius: '4px', px: 1.5, py: 0.5,
                              fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                              🚫 Não se aplica
                            </Box>
                          );
                        }
                        return <span>{params.value || '—'}</span>;
                      }
                    },
                    { 
                      field: 'response', 
                      headerName: 'Detalhes/Erro', 
                      flex: 2, 
                      minWidth: 280,
                      renderCell: (params: any) => (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5, width: '100%' }}>
                          {params.row.remarcado && (
                            <Box sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              bgcolor: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80',
                              borderRadius: '4px', px: 1, py: 0.25,
                              fontSize: '0.75rem', fontWeight: 'bold', width: 'fit-content'
                            }}>
                              ⚠️ Paciente Remarcado
                            </Box>
                          )}
                          {params.row.remarcado && params.row.dataEnvioCalculada && (
                            <Box sx={{ fontSize: '0.75rem', color: '#b03000', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              📅 <strong>Confirmar novamente em:</strong>&nbsp;{params.row.dataEnvioCalculada}
                            </Box>
                          )}
                          {params.row.StatusEnvio === 'Não Enviado' && params.row.dataEnvioCalculada && params.row.MetodoEnvio !== 'Não se aplica' && (
                            <Box sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              bgcolor: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9',
                              borderRadius: '4px', px: 1, py: 0.25,
                              fontSize: '0.75rem', fontWeight: 'bold', width: 'fit-content'
                            }}>
                              📅 Envio previsto: {params.row.dataEnvioCalculada}
                            </Box>
                          )}
                          {params.row.response && (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary', wordBreak: 'break-word' }}>
                              {params.row.response}
                            </Box>
                          )}
                        </Box>
                      )
                    }
                  ]}
                  autoHeight
                  disableRowSelectionOnClick
                  pageSizeOptions={[100]}
                />
              </Box>
            </Box>
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
                      {search ? 'Nenhum resultado para a busca atual' : 'Nenhum erro na lista de faltosos'}
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

      {/* Dialog removido */}
    </Box>
  );
};

export default PacientesFaltosos;