import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
  FormControlLabel, Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const COMMON_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'dozen', 'pack', 'MTR', 'YRD', 'bag'];

// Industry-standard conversion offered only for this exact pair — never
// silently assumed for anything else (mirrors src/services/uom.js on the backend).
function standardFactor(base, alt) {
  if (base === 'MTR' && alt === 'YRD') return 0.9144;
  if (base === 'YRD' && alt === 'MTR') return 1.09361;
  return '';
}

const emptyForm = { name: '', purchasePrice: '', sellPrice: '', stock: '', minStock: '', unit: 'pcs', altUnitEnabled: false, altUnit: 'MTR', altUnitFactor: '' };

export default function Products() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });

  const [open, setOpen] = useState(false);
  const [movementsProduct, setMovementsProduct] = useState(null);
  const [movementsData, setMovementsData] = useState(null);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const handleOpenMovements = async (p) => {
    setMovementsProduct(p);
    setLoadingMovements(true);
    setMovementsData(null);
    try {
      const res = await api.get(`/products/${p.id}/movements`);
      setMovementsData(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingMovements(false);
    }
  };
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [customUnit, setCustomUnit] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setCustomUnit(false); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, purchasePrice: p.purchase_price, sellPrice: p.sell_price, stock: p.stock, minStock: p.min_stock,
      unit: p.unit || 'pcs', altUnitEnabled: !!p.alt_unit, altUnit: p.alt_unit || 'MTR', altUnitFactor: p.alt_unit_factor || '',
    });
    setCustomUnit(!COMMON_UNITS.includes(p.unit));
    setOpen(true);
  };

  // When base or alt unit changes, suggest the standard factor if this is
  // the Meters<->Yards pair — the user can still overwrite it.
  const applyUnit = (patch) => setForm((f) => {
    const next = { ...f, ...patch };
    const suggested = standardFactor(next.unit, next.altUnit);
    return suggested !== '' ? { ...next, altUnitFactor: suggested } : next;
  });

  const body = () => ({
    name: form.name,
    purchasePrice: +form.purchasePrice || 0,
    sellPrice: +form.sellPrice || 0,
    stock: +form.stock || 0,
    minStock: +form.minStock || 0,
    unit: form.unit || 'pcs',
    ...(form.altUnitEnabled ? { altUnit: form.altUnit, altUnitFactor: +form.altUnitFactor || undefined } : {}),
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/products/${editing.id}`, body()) : api.post('/products', body())),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err) => alert(err.message),
  });

  const canSubmit = form.name && (!form.altUnitEnabled || (form.altUnit && form.altUnit !== form.unit && +form.altUnitFactor > 0));

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Products</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add</Button>}
      </Box>

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No products yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Unit</TableCell><TableCell align="right">Purchase Price</TableCell><TableCell align="right">Selling Price</TableCell>
              <TableCell align="right">Stock</TableCell><TableCell align="right">Min. Stock</TableCell>{canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((p) => {
              const low = Number(p.stock) <= Number(p.min_stock);
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    {p.unit}
                    {p.alt_unit && <Chip label={`= ${p.alt_unit}`} size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: 11 }} title={`1 ${p.alt_unit} = ${p.alt_unit_factor} ${p.unit}`} />}
                  </TableCell>
                  <TableCell align="right"><Money value={p.purchase_price} /></TableCell>
                  <TableCell align="right"><Money value={p.sell_price} /></TableCell>
                  <TableCell align="right">
                    {low ? <Chip label={`${p.stock} ${p.unit}`} size="small" color="error" variant="outlined" /> : `${p.stock} ${p.unit}`}
                    <Button size="small" sx={{ ml: 1 }} onClick={() => handleOpenMovements(p)}>Stock Book</Button>
                  </TableCell>
                  <TableCell align="right">{p.min_stock} {p.unit}</TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                      <IconButton size="small" onClick={() => deleteMutation.mutate(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <TextField label="Product Name" value={form.name} onChange={set('name')} autoFocus fullWidth />

          {customUnit ? (
            <TextField
              label="Base Unit of Measurement" value={form.unit} onChange={(e) => applyUnit({ unit: e.target.value })} fullWidth
              helperText="e.g. pcs, kg, MTR, YRD — or pick from the list"
              InputProps={{ endAdornment: <Button size="small" onClick={() => setCustomUnit(false)}>List</Button> }}
            />
          ) : (
            <Select
              value={COMMON_UNITS.includes(form.unit) ? form.unit : 'pcs'}
              onChange={(e) => (e.target.value === '__custom__' ? setCustomUnit(true) : applyUnit({ unit: e.target.value }))}
              fullWidth
            >
              {COMMON_UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              <MenuItem value="__custom__">Other…</MenuItem>
            </Select>
          )}

          <FormControlLabel
            control={<Checkbox checked={form.altUnitEnabled} onChange={(e) => setForm((f) => ({ ...f, altUnitEnabled: e.target.checked }))} />}
            label="Also sold in a second unit (e.g. Meters sold as Yards)"
          />
          {form.altUnitEnabled && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Select value={form.altUnit} onChange={(e) => applyUnit({ altUnit: e.target.value })} fullWidth>
                {COMMON_UNITS.filter((u) => u !== form.unit).map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </Select>
              <TextField
                label={`Conversion Factor (1 ${form.altUnit} = ? ${form.unit})`} type="number" value={form.altUnitFactor}
                onChange={set('altUnitFactor')} fullWidth
                helperText={standardFactor(form.unit, form.altUnit) !== '' ? 'Standard value suggested — edit if yours differs.' : 'No standard value for this pair — enter your own.'}
              />
            </Box>
          )}

          <TextField label="Purchase Price" type="number" value={form.purchasePrice} onChange={set('purchasePrice')} fullWidth helperText={`Cost per ${form.unit || 'unit'}`} />
          <TextField label="Selling Price" type="number" value={form.sellPrice} onChange={set('sellPrice')} fullWidth helperText={`Default price per ${form.unit || 'unit'}`} />
          <TextField label={editing ? 'Stock' : 'Opening Stock'} type="number" value={form.stock} onChange={set('stock')} fullWidth helperText={`In ${form.unit || 'base unit'}`} />
          <TextField label="Minimum Stock" type="number" value={form.minStock} onChange={set('minStock')} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Stock Book / Movements Dialog */}
      <Dialog open={!!movementsProduct} onClose={() => setMovementsProduct(null)} fullWidth maxWidth="md">
        <DialogTitle>
          Stock Book & Movements: {movementsProduct?.name}
        </DialogTitle>
        <DialogContent dividers>
          {loadingMovements ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
          ) : !movementsData ? (
            <Typography>Failed to load movements.</Typography>
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Current Stock: <strong>{movementsData.product.stock} {movementsData.product.unit}</strong>
              </Typography>
              <Typography variant="h6" sx={{ mb: 1, fontSize: 16 }}>Inflows (Purchases)</Typography>
              <Table size="small" sx={{ mb: 3 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Bill / Invoice #</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell align="right">Quantity Added</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movementsData.purchaseMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ fontStyle: 'italic', opacity: 0.6 }}>No purchase inflows recorded.</TableCell></TableRow>
                  ) : (
                    movementsData.purchaseMovements.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell>{m.date}</TableCell>
                        <TableCell>{m.bill_number || '—'}</TableCell>
                        <TableCell>{m.party_name}</TableCell>
                        <TableCell align="right">+{m.quantity_added} {movementsData.product.unit}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <Typography variant="h6" sx={{ mb: 1, fontSize: 16 }}>Outflows & Reductions (Sales)</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Bill / Invoice #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">Quantity Reduced</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movementsData.salesMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ fontStyle: 'italic', opacity: 0.6 }}>No sales reductions recorded.</TableCell></TableRow>
                  ) : (
                    movementsData.salesMovements.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell>{m.date}</TableCell>
                        <TableCell>
                          {m.bill_number ? <Chip label={m.bill_number} size="small" variant="outlined" /> : '—'}
                        </TableCell>
                        <TableCell>{m.party_name}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                          -{m.quantity_reduced} {movementsData.product.unit}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovementsProduct(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
