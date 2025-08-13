import React, { useState } from 'react';
import { useAmbiente } from '../contexts/AmbienteContext';
import { 
  Box, 
  IconButton, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText, 
  Tooltip,
  Typography,
  Divider
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckIcon from '@mui/icons-material/Check';
import ComputerIcon from '@mui/icons-material/Computer';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';

const SeletorAmbiente: React.FC = () => {
  const { ambiente, atualizarAmbiente, carregando } = useAmbiente();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectAmbiente = (novoAmbiente: 'teste' | 'producao') => {
    if (novoAmbiente !== ambiente) {
      atualizarAmbiente(novoAmbiente);
    }
    handleClose();
  };

  return (
    <Box>
      <Tooltip title="Configurações de ambiente">
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{
            padding: '8px',
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          disabled={carregando}
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            AMBIENTE ATUAL
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {ambiente === 'producao' ? 'Produção' : 'Ambiente de Teste'}
          </Typography>
        </Box>
        <Divider />
        
        <MenuItem 
          onClick={() => handleSelectAmbiente('producao')}
          selected={ambiente === 'producao'}
          sx={{ minWidth: '180px' }}
        >
          <ListItemIcon>
            <ComputerIcon color={ambiente === 'producao' ? 'primary' : 'inherit'} />
          </ListItemIcon>
          <ListItemText>Produção</ListItemText>
          {ambiente === 'producao' && <CheckIcon color="primary" fontSize="small" />}
        </MenuItem>
        
        <MenuItem 
          onClick={() => handleSelectAmbiente('teste')}
          selected={ambiente === 'teste'}
          sx={{ minWidth: '180px' }}
        >
          <ListItemIcon>
            <DeveloperBoardIcon color={ambiente === 'teste' ? 'secondary' : 'inherit'} />
          </ListItemIcon>
          <ListItemText>Ambiente de Teste</ListItemText>
          {ambiente === 'teste' && <CheckIcon color="secondary" fontSize="small" />}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default SeletorAmbiente;
