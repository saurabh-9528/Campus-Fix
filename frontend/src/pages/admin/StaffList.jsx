import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { UserFormModal } from '../../components/admin/UserFormModal';
import { downloadCsv } from '../../utils/csv';
import { getInitials } from '../../utils/analytics';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardList,
  Download,
  FilterX,
  IdCard,
  Mail,
  Search,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';

const STATUS_BADGE = {
  active: { label: 'Active', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  pending_activation: {
    label: 'Pending Activation',
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  inactive: { label: 'Inactive', classes: 'border-gray-200 bg-gray-100 text-gray-600' },
};

export const StaffList = () => {
  const [staff, setStaff] = useState([]);
  const [workloadByStaffId, setWorkloadByStaffId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [modal, setModal] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [staffData, analyticsData] = await Promise.all([
        adminApi.getStaff(true, true),
        adminApi.getAnalytics().catch(() => null),
      ]);
      setStaff(staffData || []);

      const workloadMap = {};
      (analyticsData?.staff_workload || []).forEach((item) => {
        workloadMap[String(item.staff_id)] = item;
      });
      setWorkloadByStaffId(workloadMap);
    } catch (err) {
      setError(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const departments = useMemo(
    () =>
      [...new Set(staff.map((member) => member.department).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        !query ||
        [member.full_name, member.email, member.employee_id, member.department]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesDepartment =
        !departmentFilter || member.department === departmentFilter;
      const effectiveStatus = member.account_status || (member.is_active ? 'active' : 'inactive');
      const matchesStatus = !statusFilter || effectiveStatus === statusFilter;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [staff, searchQuery, departmentFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = staff.length;
    const active = staff.filter(
      (m) => (m.account_status || (m.is_active ? 'active' : 'inactive')) === 'active'
    ).length;
    const pending = staff.filter((m) => m.account_status === 'pending_activation').length;
    const activeTasks = staff.reduce((sum, m) => sum + (Number(m.active_tasks) || 0), 0);
    return { total, active, pending, activeTasks };
  }, [staff]);

  const hasFilters = Boolean(searchQuery || departmentFilter || statusFilter);

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('');
    setStatusFilter('');
  };

  const handleCreated = (result, _userType, meta) => {
    setActionError(null);
    if (meta?.bulk) {
      setActionSuccess(`Created ${result.created_count} staff account(s).`);
    } else {
      setActionSuccess(`Created staff account for ${result.full_name}.`);
    }
    fetchStaff();
  };

  const handleActivate = async (member) => {
    if (updatingId !== null) return;
    setUpdatingId(member.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.activateStaff(member.id);
      setActionSuccess(`Activated ${member.full_name}.`);
      await fetchStaff();
    } catch (err) {
      setActionError(err.message || 'Failed to activate staff member');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (member, makeActive) => {
    if (updatingId !== null) return;
    if (
      !makeActive &&
      !window.confirm(
        `Deactivate ${member.full_name}? They will no longer be able to sign in.`
      )
    ) {
      return;
    }

    setUpdatingId(member.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.setStaffStatus(member.id, makeActive);
      setActionSuccess(
        makeActive
          ? `Reactivated ${member.full_name}.`
          : `Deactivated ${member.full_name}.`
      );
      await fetchStaff();
    } catch (err) {
      setActionError(err.message || 'Failed to update staff status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `campusfix-staff-${stamp}.csv`,
      ['ID', 'Full Name', 'Email', 'Employee ID', 'Department', 'Status', 'Active Tasks', 'Resolved Tasks'],
      filteredStaff.map((member) => {
        const workload = workloadByStaffId[String(member.id)];
        return [
          member.id,
          member.full_name,
          member.email,
          member.employee_id || '',
          member.department || '',
          member.account_status || (member.is_active ? 'active' : 'inactive'),
          member.active_tasks ?? workload?.active_complaints ?? 0,
          workload?.resolved_complaints ?? 0,
        ];
      })
    );
  };

  return (
    <div className="w-full space-y-5">
      {/* Header & Quick Actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Manage Staff</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage maintenance technicians, activation status, and active task workload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link to="/admin/dashboard">
            <Button variant="secondary" size="sm" className="h-9 px-3 text-xs font-medium whitespace-nowrap">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-3 text-xs font-medium whitespace-nowrap"
            onClick={handleExportCsv}
            disabled={loading || filteredStaff.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-3 text-xs font-medium whitespace-nowrap"
            onClick={() => setModal({ initialMode: 'bulk' })}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Bulk CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-9 px-3.5 text-xs font-semibold whitespace-nowrap"
            onClick={() => setModal({ initialMode: 'single' })}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            + Add Staff
          </Button>
        </div>
      </div>

      {/* Workforce Summary Strip */}
      <div className="grid w-full grid-cols-2 gap-3.5 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Total Staff</span>
            <span className="h-2 w-2 rounded-full bg-gray-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900">{summary.total}</span>
            <span className="text-xs text-gray-500">Registered technicians</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-900">Active</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-950">{summary.active}</span>
            <span className="text-xs font-medium text-emerald-700">Available for dispatch</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900">Pending</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-950">{summary.pending}</span>
            <span className="text-xs font-medium text-amber-700">Awaiting activation</span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">Active Tasks</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-950">
              {summary.activeTasks}
            </span>
            <span className="text-xs font-medium text-blue-700">Assigned open tickets</span>
          </div>
        </div>
      </div>

      {/* Single-Row Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="w-full sm:min-w-[220px] sm:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, employee ID..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full sm:w-44">
            <select
              aria-label="Filter by department"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-40">
            <select
              aria-label="Filter by status"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending_activation">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <Button
            variant="secondary"
            onClick={clearFilters}
            className="h-10 w-full shrink-0 px-3.5 sm:w-auto"
            disabled={!hasFilters}
          >
            <FilterX className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {actionError && (
        <Alert type="error" message={actionError} onClose={() => setActionError(null)} />
      )}
      {actionSuccess && (
        <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess(null)} />
      )}

      {/* Staff Table / Cards / Empty State */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size={32} />
        </div>
      ) : filteredStaff.length === 0 ? (
        <Card className="border-dashed bg-gray-50/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-2xs ring-1 ring-gray-200">
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {hasFilters ? 'No matching staff members' : 'No staff members yet'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {hasFilters
                ? 'Try adjusting your search or filter criteria.'
                : 'Add maintenance staff individually or import a team roster via CSV.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  <FilterX className="mr-1.5 h-4 w-4" />
                  Clear Filters
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setModal({ initialMode: 'single' })}
                  >
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    + Add Staff
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setModal({ initialMode: 'bulk' })}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    Bulk CSV
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-2xs">
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Staff Member
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Employee ID
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Department
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Workload
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredStaff.map((member) => {
                  const statusKey =
                    member.account_status || (member.is_active ? 'active' : 'inactive');
                  const badge = STATUS_BADGE[statusKey] || STATUS_BADGE.inactive;
                  const workload = workloadByStaffId[String(member.id)];
                  const activeCount = member.active_tasks ?? workload?.active_complaints ?? 0;
                  const resolvedCount = workload?.resolved_complaints ?? 0;
                  const isBusy = updatingId === member.id;

                  return (
                    <tr key={member.id} className="transition-colors hover:bg-gray-50/80">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                            {getInitials(member.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {member.full_name}
                            </p>
                            <p className="truncate text-xs text-gray-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-gray-700">
                        {member.employee_id ? (
                          <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-gray-700">
                            {member.employee_id}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {member.department ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            {member.department}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                              activeCount > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {activeCount} active
                          </span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-600">{resolvedCount} resolved</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link to="/admin/complaints">
                            <Button variant="ghost" size="sm" title="View complaints">
                              <ClipboardList className="mr-1 h-3.5 w-3.5" />
                              Tasks
                            </Button>
                          </Link>
                          {statusKey === 'pending_activation' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={updatingId !== null}
                              onClick={() => handleActivate(member)}
                            >
                              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                              {isBusy ? 'Activating...' : 'Activate'}
                            </Button>
                          ) : statusKey === 'active' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={updatingId !== null}
                              onClick={() => handleToggleStatus(member, false)}
                            >
                              <UserX className="mr-1 h-3.5 w-3.5" />
                              {isBusy ? 'Updating...' : 'Deactivate'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={updatingId !== null}
                              onClick={() => handleToggleStatus(member, true)}
                            >
                              <UserCheck className="mr-1 h-3.5 w-3.5" />
                              {isBusy ? 'Updating...' : 'Reactivate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {filteredStaff.map((member) => {
              const statusKey =
                member.account_status || (member.is_active ? 'active' : 'inactive');
              const badge = STATUS_BADGE[statusKey] || STATUS_BADGE.inactive;
              const workload = workloadByStaffId[String(member.id)];
              const activeCount = member.active_tasks ?? workload?.active_complaints ?? 0;
              const isBusy = updatingId === member.id;

              return (
                <div key={member.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                        {getInitials(member.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {member.full_name}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                          <Mail className="h-3 w-3 shrink-0" />
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    {member.employee_id && (
                      <span className="inline-flex items-center gap-1">
                        <IdCard className="h-3.5 w-3.5" />
                        {member.employee_id}
                      </span>
                    )}
                    {member.department && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {member.department}
                      </span>
                    )}
                    <span className="font-medium text-gray-700">{activeCount} active tasks</span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {statusKey === 'pending_activation' ? (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={updatingId !== null}
                        onClick={() => handleActivate(member)}
                      >
                        <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                        {isBusy ? 'Activating...' : 'Activate'}
                      </Button>
                    ) : statusKey === 'active' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={updatingId !== null}
                        onClick={() => handleToggleStatus(member, false)}
                      >
                        <UserX className="mr-1 h-3.5 w-3.5" />
                        {isBusy ? 'Updating...' : 'Deactivate'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={updatingId !== null}
                        onClick={() => handleToggleStatus(member, true)}
                      >
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                        {isBusy ? 'Updating...' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal && (
        <UserFormModal
          userType="staff"
          initialMode={modal.initialMode}
          existingUsers={staff}
          onClose={() => setModal(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};
