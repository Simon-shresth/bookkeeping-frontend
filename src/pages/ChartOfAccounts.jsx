import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

export default function ChartOfAccounts() {
  const { profile } = useAuth();
  const canDelete = hasRole(profile, 'accountant');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => api.get('/accounts') });
  const [deleteError, setDeleteError] = useState('');

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      qc.invalidateQueries({ queryKey: ['account-options'] });
      setDeleteError('');
    },
    onError: (err) => setDeleteError(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Chart of Accounts</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        User-created accounts with no transactions can be deleted. System accounts and accounts with
        transactions cannot be removed.
      </Typography>

      {deleteError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>}

      {data.map((group) => (
        <Box key={group.category} sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>{group.category}</Typography>
          {group.headings.map((h) => (
            <Box key={h.heading} sx={{ mb: 2 }}>
              {h.collapsed ? (
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        {h.heading}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          ({h.subAccountCount} {h.heading === 'Accounts Receivable' ? 'customer' : 'supplier'} account{h.subAccountCount === 1 ? '' : 's'} — see General Ledger)
                        </Typography>
                      </TableCell>
                      <TableCell align="right"><Money value={h.balance} /></TableCell>
                      {canDelete && <TableCell sx={{ width: 40 }} />}
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{h.heading}</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Account</TableCell>
                        <TableCell align="right">Balance</TableCell>
                        {canDelete && <TableCell sx={{ width: 40 }} />}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {h.accounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.name}</TableCell>
                          <TableCell align="right"><Money value={a.balance} /></TableCell>
                          {canDelete && (
                            <TableCell sx={{ width: 40, py: 0 }}>
                              {!a.is_system && (
                                <Tooltip title="Delete account (only if no transactions)">
                                  <IconButton
                                    size="small"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => {
                                      if (window.confirm(`Delete account "${a.name}"? This cannot be undone.`)) {
                                        deleteMutation.mutate(a.id);
                                      }
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
