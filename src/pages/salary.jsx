import React, { useState, useEffect } from 'react';
import { formatNepaliNumber } from '../lib/formatters';

export default function SalaryPage() {
  const [activeTab, setActiveTab] = useState('disburse'); // 'disburse', 'employees', 'history'
  const [employees, setEmployees] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states for adding an employee
  const [newEmp, setNewEmp] = useState({ name: '', designation: '', base_salary: '', phone: '', email: '', bank_account_no: '' });

  // Disbursement Form states
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [notes, setNotes] = useState('');
  const [adjustments, setAdjustments] = useState({}); // { [employee_id]: { bonus: 0, deductions: 0 } }

  useEffect(() => {
    fetchEmployees();
    fetchHistory();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/payroll/employees');
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/payroll/history');
      const data = await res.json();
      if (Array.isArray(data)) setPayrollHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/payroll/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp),
      });
      if (res.ok) {
        setNewEmp({ name: '', designation: '', base_salary: '', phone: '', email: '', bank_account_no: '' });
        fetchEmployees();
        alert('Employee created successfully.');
      }
    } catch (err) {
      alert('Failed to create employee');
    }
  };

  const handleAdjustmentChange = (empId, field, value) => {
    setAdjustments((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: Number(value) || 0,
      },
    }));
  };

  const activeEmployees = employees.filter((e) => e.is_active);

  const calculateTotalDisbursement = () => {
    return activeEmployees.reduce((sum, emp) => {
      const adj = adjustments[emp.id] || {};
      const bonus = Number(adj.bonus) || 0;
      const deductions = Number(adj.deductions) || 0;
      const net = Math.max(0, Number(emp.base_salary) + bonus - deductions);
      return sum + net;
    }, 0);
  };

  const handleDisburseAll = async () => {
    if (activeEmployees.length === 0) {
      alert('No active employees to disburse salary to.');
      return;
    }

    const confirmMsg = `Are you sure you want to disburse salary for ${activeEmployees.length} employees for ${selectedMonth}?\n\nTotal Payable: Rs. ${formatNepaliNumber(calculateTotalDisbursement())}`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const payload = {
        month_year: selectedMonth,
        payment_method: paymentMethod,
        notes,
        employee_adjustments: Object.keys(adjustments).map((empId) => ({
          employee_id: empId,
          bonus: adjustments[empId]?.bonus || 0,
          deductions: adjustments[empId]?.deductions || 0,
        })),
      };

      const res = await fetch('/api/payroll/disburse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchHistory();
        setActiveTab('history');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to process salary disbursement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Salary & Payroll Management</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('disburse')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'disburse' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border'}`}
          >
            💳 Bulk Disbursement
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'employees' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border'}`}
          >
            👥 Employees ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border'}`}
          >
            📜 Payroll History
          </button>
        </div>
      </div>

      {/* TAB 1: BATCH SALARY DISBURSEMENT */}
      {activeTab === 'disburse' && (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Salary Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="mt-1 w-full border rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Payment Source Account</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full border rounded-md p-2"
              >
                <option value="bank">Bank Account (1020)</option>
                <option value="cash">Cash in Hand (1010)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Notes / Remarks</label>
              <input
                type="text"
                placeholder="Optional payroll notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full border rounded-md p-2"
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">
              Active Employees Eligible for Payroll ({activeEmployees.length})
            </h2>
            <div className="text-right">
              <span className="text-sm text-slate-500">Total Batch Payout: </span>
              <span className="text-xl font-bold font-mono text-emerald-600">
                Rs. {formatNepaliNumber(calculateTotalDisbursement())}
              </span>
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-sm">
                <th className="p-2 border">Employee Name</th>
                <th className="p-2 border">Designation</th>
                <th className="p-2 border text-right">Base Salary (Rs.)</th>
                <th className="p-2 border w-32 text-right">Bonus / Allowance</th>
                <th className="p-2 border w-32 text-right">Deductions</th>
                <th className="p-2 border text-right">Net Payable (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">
                    No active employees found. Please add employees first.
                  </td>
                </tr>
              ) : (
                activeEmployees.map((emp) => {
                  const adj = adjustments[emp.id] || {};
                  const bonus = Number(adj.bonus) || 0;
                  const deductions = Number(adj.deductions) || 0;
                  const net = Math.max(0, Number(emp.base_salary) + bonus - deductions);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="p-2 border font-medium">{emp.name}</td>
                      <td className="p-2 border text-slate-600">{emp.designation || '-'}</td>
                      <td className="p-2 border text-right font-mono">{formatNepaliNumber(emp.base_salary)}</td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          placeholder="0"
                          value={adj.bonus || ''}
                          onChange={(e) => handleAdjustmentChange(emp.id, 'bonus', e.target.value)}
                          className="w-full border rounded p-1 text-right font-mono text-emerald-600"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          placeholder="0"
                          value={adj.deductions || ''}
                          onChange={(e) => handleAdjustmentChange(emp.id, 'deductions', e.target.value)}
                          className="w-full border rounded p-1 text-right font-mono text-red-600"
                        />
                      </td>
                      <td className="p-2 border text-right font-mono font-bold text-slate-800">
                        {formatNepaliNumber(net)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleDisburseAll}
              disabled={loading || activeEmployees.length === 0}
              className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Processing Disbursement...' : `🚀 Disburse Salary to All (${activeEmployees.length} Employees)`}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEE MANAGEMENT */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add Employee Form */}
          <form onSubmit={handleAddEmployee} className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Add New Employee</h2>
            <div>
              <label className="block text-sm font-medium">Full Name *</label>
              <input
                type="text"
                required
                value={newEmp.name}
                onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                className="w-full border rounded p-2 mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Designation</label>
              <input
                type="text"
                value={newEmp.designation}
                onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                className="w-full border rounded p-2 mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Base Monthly Salary (Rs.) *</label>
              <input
                type="number"
                required
                value={newEmp.base_salary}
                onChange={(e) => setNewEmp({ ...newEmp, base_salary: e.target.value })}
                className="w-full border rounded p-2 mt-1 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Phone</label>
              <input
                type="text"
                value={newEmp.phone}
                onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                className="w-full border rounded p-2 mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Bank Account No.</label>
              <input
                type="text"
                value={newEmp.bank_account_no}
                onChange={(e) => setNewEmp({ ...newEmp, bank_account_no: e.target.value })}
                className="w-full border rounded p-2 mt-1 font-mono"
              />
            </div>
            <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700">
              Create Employee
            </button>
          </form>

          {/* Employee Directory List */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Employee Directory</h2>
            <table className="w-full text-left border-collapse border border-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Designation</th>
                  <th className="p-2 border">Bank Account</th>
                  <th className="p-2 border text-right">Base Salary</th>
                  <th className="p-2 border text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="p-2 border font-medium">{emp.name}</td>
                    <td className="p-2 border text-slate-600">{emp.designation || '-'}</td>
                    <td className="p-2 border font-mono text-slate-600">{emp.bank_account_no || '-'}</td>
                    <td className="p-2 border text-right font-mono font-semibold">
                      Rs. {formatNepaliNumber(emp.base_salary)}
                    </td>
                    <td className="p-2 border text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DISBURSEMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Past Salary Disbursements</h2>
          <table className="w-full text-left border-collapse border border-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 border">Month</th>
                <th className="p-2 border">Disbursement Date</th>
                <th className="p-2 border">Payment Source</th>
                <th className="p-2 border text-right">Total Disbursed</th>
                <th className="p-2 border">Employees Included</th>
              </tr>
            </thead>
            <tbody>
              {payrollHistory.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="p-2 border font-bold text-indigo-600">{run.month_year}</td>
                  <td className="p-2 border">{new Date(run.disbursement_date).toLocaleDateString()}</td>
                  <td className="p-2 border uppercase font-semibold">{run.payment_method}</td>
                  <td className="p-2 border text-right font-mono font-bold text-emerald-600">
                    Rs. {formatNepaliNumber(run.total_amount)}
                  </td>
                  <td className="p-2 border">
                    <div className="text-xs text-slate-600">
                      {(run.slips || []).map((s) => s.employee_name).join(', ')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}