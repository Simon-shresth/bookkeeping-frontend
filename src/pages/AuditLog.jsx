import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, Chip,
  Alert, CircularProgress,
} from '@mui/material';
import { api } from '../lib/api';
import { useAuth, hasRole } from '../context/AuthContext';

const ENTITIES = [
  ['', 'All activity'],
  ['sales_invoice', 'Sales invoices'],
  ['purchase_invoice', 'Purchase invoices'],
  ['expense', 'Expenses'],
  ['payment', 'Payments'],
  ['journal_entry', 'Journal entries'],
  ['bank_reconciliation', 'Bank reconciliations'],
  ['user', 'Users'],
];
const PAGE = 100;
const ACTION_COLOR = { create: 'success', update: 'warning', delete: 'error' };

function summarize(details) {
  if (!details) return '';
  const { before, after, replaced, ...rest } = details;
  const parts = Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`);
  if (before && after) {
    const changed = Object.keys(after).filter((k) => String(before[k]) !== String(after[k])).map((k) => `${k}: ${before[k]} → ${after[k]}`);
    if (changed.length) parts.unshift(changed.join(', '));
  }
  return parts.join(' · ');
}

export default function AuditLog() {
  const { profile } = useAuth();
  const isAdmin = hasRole(profile, 'admin');
  const [entity, setEntity] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const load = async (append) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (entity) params.set('entity', entity);
      if (append && rows.length) { const last = rows[rows.length - 1]; params.set('before', `${last.cursor_ts}|${last.id}`); }
      const page = await api.get(`/audit?${params}`);
      setRows(append ? [...rows, ...page] : page);
      setHasMore(page.length === PAGE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entity, isAdmin]);

  if (!isAdmin) return <Alert severity="warning">Only administrators can view the audit log.</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Audit Log</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A permanent record of who created, changed or deleted financial records. Edits show the old and new values.
      </Typography>

      <Select size="small" value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ minWidth: 220, mb: 2 }}>
        {ENTITIES.map(([v, label]) => <MenuItem key={v} value={v}>{label}</MenuItem>)}
      </Select>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {rows.length === 0 && !loading ? (
        <Typography variant="body2" color="text.secondary">Nothing recorded yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>What</TableCell><TableCell>Details</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.user_email || '—'}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={r.action} color={ACTION_COLOR[r.action] || 'default'} /></TableCell>
                <TableCell>{r.entity.replace(/_/g, ' ')}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{summarize(r.details)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Box sx={{ mt: 2 }}>
        {loading && <CircularProgress size={20} />}
        {!loading && hasMore && <Button onClick={() => load(true)}>Load older</Button>}
      </Box>
    </Box>
  );
}
