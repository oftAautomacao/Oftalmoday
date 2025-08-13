import { Link } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';

/**
 * Página inicial simples com links para as demais telas.
 */
export default function Dashboard() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        OftalmoDay – Dashboard
      </Typography>

      <Stack direction="row" spacing={2}>
        <Button component={Link} to="/principal" variant="contained">
          Aba Principal
        </Button>
      </Stack>
    </Box>
  );
}
