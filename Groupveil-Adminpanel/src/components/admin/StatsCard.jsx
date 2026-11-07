import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

const StatsCard = ({ label, value, icon }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" fontWeight={700} color="primary.main">
            {value}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {label}
          </Typography>
        </Box>
        <Box>
          {icon}
        </Box>
      </Box>
    </Paper>
  );
};

export default StatsCard; 