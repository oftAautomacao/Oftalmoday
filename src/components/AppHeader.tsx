import { AppBar, Toolbar, Box } from '@mui/material';
import SeletorAmbiente from './SeletorAmbiente';

const AppHeader = () => {

  return (
    <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
      <Toolbar>
        {/* Logo aumentada */}
        <Box
          component="img"
          src="/logo pequena.png"
          alt="Logo OftalmoDay"
          sx={{
            height: 50, // Aumentado de 40 para 50
            width: 'auto',
            marginRight: 2,
            backgroundColor: 'white',
            padding: '6px', // Aumentado de 4px para 6px
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
        
        {/* Espaço vazio para alinhar o SeletorAmbiente à direita */}
        <Box sx={{ flexGrow: 1 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SeletorAmbiente />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
