import React, { useEffect, useMemo, useState } from 'react';
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
  Building2,
  ClipboardList,
  Download,
  FileText,
  FilterX,
  GraduationCap,
  IdCard,
  Mail,
  Search,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';

export const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [modal, setModal] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getStudents();
      setStudents(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const departments = useMemo(
    () =>
      [...new Set(students.map((student) => student.department).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right)
      ),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        !query ||
        [student.full_name, student.email, student.student_id, student.department]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesDepartment =
        !departmentFilter || student.department === departmentFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' ? student.is_active : !student.is_active);
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [students, searchQuery, departmentFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.is_active).length;
    const inactive = total - active;
    const totalComplaints = students.reduce(
      (sum, s) => sum + (Number(s.total_complaints) || 0),
      0
    );
    return { total, active, inactive, totalComplaints };
  }, [students]);

  const hasFilters = Boolean(searchQuery || departmentFilter || statusFilter);

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('');
    setStatusFilter('');
  };

  const handleCreated = (result, _userType, meta) => {
    setActionError(null);
    if (meta?.bulk) {
      setActionSuccess(`Created ${result.created_count} student account(s).`);
    } else {
      setActionSuccess(`Created the student account for ${result.full_name}.`);
    }
    fetchStudents();
  };

  const handleToggleStatus = async (student) => {
    if (
      student.is_active &&
      !window.confirm(
        `Deactivate ${student.full_name}? They will no longer be able to sign in.`
      )
    ) {
      return;
    }

    setUpdatingId(student.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await adminApi.setStudentStatus(student.id, !student.is_active);
      setStudents((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setActionSuccess(
        `${updated.full_name} is now ${updated.is_active ? 'active' : 'inactive'}.`
      );
    } catch (err) {
      setActionError(err.message || 'Failed to update student status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `campusfix-students-${stamp}.csv`,
      ['ID', 'Full Name', 'Email', 'Student ID', 'Department', 'Status', 'Total Complaints'],
      filteredStudents.map((student) => [
        student.id,
        student.full_name,
        student.email,
        student.student_id || '',
        student.department || '',
        student.is_active ? 'active' : 'inactive',
        student.total_complaints ?? 0,
      ])
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Single-Row Header & Navigation Actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Manage Students</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create student accounts, review complaint activity, and control access.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/admin/dashboard">
            <Button
              variant="secondary"
              size="sm"
              className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={handleExportCsv}
            disabled={loading || filteredStudents.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 whitespace-nowrap px-3 text-xs font-medium"
            onClick={() => setModal({ mode: 'bulk' })}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Bulk Upload
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-9 whitespace-nowrap px-3.5 text-xs font-semibold"
            onClick={() => setModal({ mode: 'single' })}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            + Add Student
          </Button>
        </div>
      </div>

      {/* Compact 4-Card Summary Strip */}
      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Total Students</span>
            <span className="h-2 w-2 rounded-full bg-gray-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-gray-900">{summary.total}</span>
            <span className="text-xs text-gray-500">Registered accounts</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-900">Active</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-950">
              {summary.active}
            </span>
            <span className="text-xs font-medium text-emerald-700">Can sign in</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Inactive</span>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              {summary.inactive}
            </span>
            <span className="text-xs text-slate-500">Access disabled</span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">Active Complaints</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-blue-950">
              {summary.totalComplaints}
            </span>
            <span className="text-xs font-medium text-blue-700">Submitted tickets</span>
          </div>
        </div>
      </div>

      {/* Single-Row Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="w-full sm:min-w-[220px] sm:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, student ID, department..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="w-full sm:w-44">
            <select
              aria-label="Filter by department"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
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
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <Button
            variant="secondary"
            onClick={clearFilters}
            className="h-9 w-full shrink-0 px-3 text-xs sm:w-auto"
            disabled={!hasFilters}
          >
            <FilterX className="mr-1.5 h-3.5 w-3.5" />
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

      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size={32} />
        </div>
      ) : students.length === 0 ? (
        <Card className="border-dashed bg-gray-50/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-2xs ring-1 ring-gray-200">
              <GraduationCap className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No students yet</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Add your first student account or upload a CSV to get started.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setModal({ mode: 'single' })}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                + Add Student
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModal({ mode: 'bulk' })}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Bulk Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card className="border-dashed bg-gray-50/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-2xs ring-1 ring-gray-200">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No students found</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Try adjusting your search or filters to find the student you need.
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
              <FilterX className="mr-1.5 h-4 w-4" />
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Student
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Student ID
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Department
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Complaint Activity
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredStudents.map((student) => {
                  const isUpdating = updatingId === student.id;
                  const complaintCount = student.total_complaints || 0;

                  return (
                    <tr key={student.id} className="transition-colors hover:bg-gray-50/80">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                            {getInitials(student.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {student.full_name}
                            </p>
                            <p className="truncate text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-gray-700">
                        {student.student_id ? (
                          <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-gray-700">
                            {student.student_id}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {student.department ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            {student.department}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            student.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-gray-100 text-gray-600'
                          }`}
                        >
                          {student.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                            <FileText className="h-3.5 w-3.5" />
                            {complaintCount} complaint{complaintCount === 1 ? '' : 's'}
                          </span>
                          {(student.invalid_complaint_count || 0) >= 2 && (
                            <span
                              className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                              title="Student has 2 or more complaints marked Invalid / Not Found"
                            >
                              {student.invalid_complaint_count} Invalid
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link to="/admin/complaints">
                            <Button variant="ghost" size="sm" title="View complaints">
                              <ClipboardList className="mr-1 h-3.5 w-3.5" />
                              Activity
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant={student.is_active ? 'secondary' : 'primary'}
                            onClick={() => handleToggleStatus(student)}
                            disabled={updatingId !== null}
                          >
                            {student.is_active ? (
                              <UserX className="mr-1 h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="mr-1 h-3.5 w-3.5" />
                            )}
                            {isUpdating
                              ? 'Updating...'
                              : student.is_active
                                ? 'Deactivate'
                                : 'Activate'}
                          </Button>
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
            {filteredStudents.map((student) => {
              const isUpdating = updatingId === student.id;
              const complaintCount = student.total_complaints || 0;

              return (
                <div key={student.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                        {getInitials(student.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {student.full_name}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                          <Mail className="h-3 w-3 shrink-0" />
                          {student.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                        student.is_active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-100 text-gray-600'
                      }`}
                    >
                      {student.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    {student.student_id && (
                      <span className="inline-flex items-center gap-1">
                        <IdCard className="h-3.5 w-3.5" />
                        {student.student_id}
                      </span>
                    )}
                    {student.department && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {student.department}
                      </span>
                    )}
                    <span className="font-medium text-primary-700">
                      {complaintCount} complaint{complaintCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant={student.is_active ? 'secondary' : 'primary'}
                      onClick={() => handleToggleStatus(student)}
                      disabled={updatingId !== null}
                    >
                      {student.is_active ? (
                        <UserX className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                      )}
                      {isUpdating
                        ? 'Updating...'
                        : student.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal && (
        <UserFormModal
          userType="student"
          initialMode={modal.mode}
          existingUsers={students}
          onClose={() => setModal(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};
