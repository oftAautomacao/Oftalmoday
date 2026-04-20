import { AppBar, Toolbar, Box } from '@mui/material';
import SeletorAmbiente from './SeletorAmbiente';

const AppHeader = () => {

  return (
    <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
      <Toolbar>
        <Box
          component="img"
          src="/logo Lobo Olho.jpg"
          alt="Dr. Antônio Lobo - Olho"
          sx={{
            height: 60, // Tamanho ajustado para um ícone circular
            width: 60,
            marginRight: 2,
            backgroundColor: 'white',
            padding: '2px',
            borderRadius: '50%', // Formato circular para o olho
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            objectFit: 'contain'
          }}
        />
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SeletorAmbiente />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
