import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { adminApi } from '../../api/admin';
import { downloadCsv, parseCsv } from '../../utils/csv';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_REGEX = /^[A-Za-z0-9_-]{2,32}$/;
const STAFF_STATUSES = ['active', 'pending_activation'];

const HEADER_ALIASES = {
  name: 'full_name',
  e_mail: 'email',
  email_address: 'email',
  employeeid: 'employee_id',
  employee_code: 'employee_id',
  staff_id: 'employee_id',
  studentid: 'student_id',
  student_code: 'student_id',
  student_no: 'student_id',
  category: 'department',
  dept: 'department',
  status: 'account_status',
};

const normalizeStatus = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const normalizeHeader = (header) =>
  String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const emptyForm = (userType) => ({
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
  employee_id: '',
  student_id: '',
  department: '',
  account_status: userType === 'staff' ? 'pending_activation' : 'active',
});

const validateSingleForm = (form, userType) => {
  const errors = {};
  const fullName = form.full_name.trim();
  const email = form.email.trim();

  if (!fullName) {
    errors.full_name = 'Full name is required.';
  } else if (fullName.length > 100) {
    errors.full_name = 'Full name must be at most 100 characters.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!form.password) {
    errors.password = 'Temporary password is required.';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (form.password.length > 100) {
    errors.password = 'Password must be at most 100 characters.';
  }

  if (form.confirm_password !== form.password) {
    errors.confirm_password = 'Passwords do not match.';
  }

  if (userType === 'staff') {
    if (!form.employee_id.trim()) {
      errors.employee_id = 'Employee ID is required.';
    } else if (!ID_REGEX.test(form.employee_id.trim())) {
      errors.employee_id = 'Use 2-32 letters, numbers, underscores, or hyphens.';
    }

    if (!form.department.trim()) {
      errors.department = 'Department is required.';
    } else if (form.department.trim().length > 100) {
      errors.department = 'Department must be at most 100 characters.';
    }

    if (!STAFF_STATUSES.includes(form.account_status)) {
      errors.account_status = 'Choose a valid staff status.';
    }
  } else {
    if (form.student_id.trim() && !ID_REGEX.test(form.student_id.trim())) {
      errors.student_id = 'Use 2-32 letters, numbers, underscores, or hyphens.';
    }
    if (form.department.trim().length > 100) {
      errors.department = 'Department must be at most 100 characters.';
    }
  }

  return errors;
};

const validateCsvRecords = (records, userType, existingUsers) => {
  const existingEmails = new Set(
    (existingUsers || []).map((user) => String(user.email || '').trim().toLowerCase())
  );
  const existingIds = new Set(
    (existingUsers || [])
      .map((user) => user.employee_id || user.student_id || '')
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  );
  const seenEmails = new Set();
  const seenIds = new Set();

  return records.map((record, index) => {
    const values = {
      full_name: String(record.full_name || '').trim(),
      email: String(record.email || '').trim().toLowerCase(),
      password: String(record.password || ''),
      employee_id: String(record.employee_id || '').trim(),
      student_id: String(record.student_id || '').trim(),
      department: String(record.department || '').trim(),
      account_status:
        userType === 'staff'
          ? normalizeStatus(record.account_status || 'pending_activation')
          : 'active',
    };
    const errors = [];

    if (!values.full_name) {
      errors.push('Full name is required.');
    } else if (values.full_name.length > 100) {
      errors.push('Full name must be at most 100 characters.');
    }

    if (!values.email) {
      errors.push('Email is required.');
    } else if (!EMAIL_REGEX.test(values.email)) {
      errors.push('Invalid email address.');
    } else if (existingEmails.has(values.email)) {
      errors.push('Email already exists.');
    } else if (seenEmails.has(values.email)) {
      errors.push('Duplicate email in file.');
    }
    if (values.email) {
      seenEmails.add(values.email);
    }

    if (!values.password) {
      errors.push('Password is required.');
    } else if (values.password.length < 8) {
      errors.push('Password must be at least 8 characters.');
    } else if (values.password.length > 100) {
      errors.push('Password must be at most 100 characters.');
    }

    if (userType === 'staff') {
      if (!values.employee_id) {
        errors.push('Employee ID is required.');
      } else if (!ID_REGEX.test(values.employee_id)) {
        errors.push('Invalid employee ID format.');
      } else if (existingIds.has(values.employee_id.toLowerCase())) {
        errors.push('Employee ID already exists.');
      } else if (seenIds.has(values.employee_id.toLowerCase())) {
        errors.push('Duplicate employee ID in file.');
      }
      if (values.employee_id) {
        seenIds.add(values.employee_id.toLowerCase());
      }

      if (!values.department) {
        errors.push('Department is required.');
      } else if (values.department.length > 100) {
        errors.push('Department must be at most 100 characters.');
      }

      if (values.account_status === 'pending') {
        values.account_status = 'pending_activation';
      }
      if (!STAFF_STATUSES.includes(values.account_status)) {
        errors.push('Status must be active or pending_activation.');
      }
    } else {
      if (values.student_id) {
        if (!ID_REGEX.test(values.student_id)) {
          errors.push('Invalid student ID format.');
        } else if (existingIds.has(values.student_id.toLowerCase())) {
          errors.push('Student ID already exists.');
        } else if (seenIds.has(values.student_id.toLowerCase())) {
          errors.push('Duplicate student ID in file.');
        }
        seenIds.add(values.student_id.toLowerCase());
      }

      if (values.department.length > 100) {
        errors.push('Department must be at most 100 characters.');
      }
    }

    return {
      rowNumber: index + 2,
      values,
      errors,
      valid: errors.length === 0,
    };
  });
};

const buildPayload = (values, userType) => {
  if (userType === 'staff') {
    return {
      full_name: values.full_name,
      email: values.email,
      password: values.password,
      employee_id: values.employee_id,
      department: values.department,
      account_status: values.account_status,
    };
  }

  return {
    full_name: values.full_name,
    email: values.email,
    password: values.password,
    student_id: values.student_id || null,
    department: values.department || null,
  };
};

export const UserFormModal = ({
  userType = 'student',
  initialMode = 'single',
  existingUsers = [],
  onClose,
  onCreated,
}) => {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(() => emptyForm(userType));
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [csvRows, setCsvRows] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState(null);
  const [csvInputKey, setCsvInputKey] = useState(0);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const isStaff = userType === 'staff';
  const label = isStaff ? 'Staff' : 'Student';
  const formId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting && !bulkSubmitting) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, submitting, bulkSubmitting]);

  const invalidCsvRows = useMemo(
    () => csvRows.filter((row) => !row.valid).length,
    [csvRows]
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSingleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    const errors = validateSingleForm(form, userType);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildPayload(form, userType);
      const created = isStaff
        ? await adminApi.createStaff(payload)
        : await adminApi.createStudent(payload);
      onCreated?.(created, userType);
      onClose?.();
    } catch (error) {
      setSubmitError(error.message || `Failed to create ${label.toLowerCase()}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvFile = async (event) => {
    const file = event.target.files?.[0];
    setCsvError(null);
    setCsvRows([]);
    setCsvFileName('');
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setCsvError('CSV must include a header row and at least one data row.');
        return;
      }

      const headers = parsed[0].map((header) => {
        const normalized = normalizeHeader(header);
        return HEADER_ALIASES[normalized] || normalized;
      });
      const requiredHeaders = isStaff
        ? ['full_name', 'email', 'password', 'employee_id', 'department']
        : ['full_name', 'email', 'password'];
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
      if (missingHeaders.length > 0) {
        setCsvError(`Missing required column(s): ${missingHeaders.join(', ')}.`);
        return;
      }

      const records = parsed.slice(1).map((cells) => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = cells[index] ?? '';
        });
        return record;
      });

      const validatedRows = validateCsvRecords(records, userType, existingUsers);
      if (validatedRows.length > 200) {
        setCsvError('Maximum 200 records per bulk upload.');
        return;
      }

      setCsvRows(validatedRows);
      setCsvFileName(file.name);
    } catch {
      setCsvError('Could not read this CSV file. Please try again.');
    }
  };

  const handleBulkSubmit = async () => {
    if (csvRows.length === 0 || invalidCsvRows > 0) return;
    setSubmitError(null);
    setBulkSubmitting(true);
    try {
      const items = csvRows.map((row) => buildPayload(row.values, userType));
      const result = isStaff
        ? await adminApi.bulkCreateStaff(items)
        : await adminApi.bulkCreateStudents(items);
      onCreated?.(result, userType, { bulk: true });
      onClose?.();
    } catch (error) {
      setSubmitError(error.message || `Failed to upload ${label.toLowerCase()} records.`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const clearCsv = () => {
    setCsvRows([]);
    setCsvFileName('');
    setCsvError(null);
    setCsvInputKey((current) => current + 1);
  };

  const downloadTemplate = () => {
    if (isStaff) {
      downloadCsv(
        'staff-bulk-template.csv',
        ['full_name', 'email', 'password', 'employee_id', 'department', 'account_status'],
        [['Jane Doe', 'jane.doe@campus.edu', 'TempPass!123', 'EMP200', 'Electrical', 'pending_activation']]
      );
      return;
    }

    downloadCsv(
      'student-bulk-template.csv',
      ['full_name', 'email', 'password', 'student_id', 'department'],
      [['Alex Smith', 'alex.smith@campus.edu', 'TempPass!123', 'STU200', 'Computer Science']]
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={() => {
          if (!submitting && !bulkSubmitting) {
            onClose?.();
          }
        }}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id={`${formId}-title`} className="text-lg font-semibold text-gray-900">
                Add {label}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Create one account or upload a CSV batch with preview validation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || bulkSubmitting}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 overflow-x-auto border-b border-gray-100 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Single user
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`ml-6 flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              mode === 'bulk'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk CSV
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {submitError && (
            <Alert
              type="error"
              message={submitError}
              className="mb-4"
            />
          )}

          {mode === 'single' ? (
            <form id={formId} onSubmit={handleSingleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={form.full_name}
                  onChange={(event) => updateField('full_name', event.target.value)}
                  placeholder="Jane Doe"
                  error={formErrors.full_name}
                  autoFocus
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="jane.doe@campus.edu"
                  error={formErrors.email}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Temporary password"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="At least 8 characters"
                  error={formErrors.password}
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm password"
                  type="password"
                  value={form.confirm_password}
                  onChange={(event) => updateField('confirm_password', event.target.value)}
                  placeholder="Re-enter password"
                  error={formErrors.confirm_password}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isStaff ? (
                  <Input
                    label="Employee ID"
                    value={form.employee_id}
                    onChange={(event) => updateField('employee_id', event.target.value)}
                    placeholder="EMP200"
                    error={formErrors.employee_id}
                  />
                ) : (
                  <Input
                    label="Student ID (optional)"
                    value={form.student_id}
                    onChange={(event) => updateField('student_id', event.target.value)}
                    placeholder="STU200"
                    error={formErrors.student_id}
                  />
                )}

                <Input
                  label={`Department${isStaff ? '' : ' (optional)'}`}
                  value={form.department}
                  onChange={(event) => updateField('department', event.target.value)}
                  placeholder={isStaff ? 'Electrical' : 'Computer Science'}
                  error={formErrors.department}
                />
              </div>

              {isStaff && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Account status
                  </label>
                  <select
                    value={form.account_status}
                    onChange={(event) => updateField('account_status', event.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <option value="pending_activation">Pending Activation</option>
                    <option value="active">Active</option>
                  </select>
                  {formErrors.account_status && (
                    <p className="mt-1 text-sm text-danger">{formErrors.account_status}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    New staff must change their temporary password at first login.
                  </p>
                </div>
              )}

              {!isStaff && (
                <p className="text-xs text-gray-500">
                  Student accounts are created active and can sign in immediately.
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Upload a CSV file</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Required columns: full_name, email, password
                    {isStaff ? ', employee_id, department' : ' (student_id and department are optional)'}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
                    <Upload className="mr-2 h-4 w-4" />
                    Choose CSV
                    <input
                      key={csvInputKey}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFile}
                      className="hidden"
                    />
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Template
                  </Button>
                </div>
              </div>

              {csvError && <Alert type="error" message={csvError} />}

              {csvFileName && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <span className="truncate font-medium text-gray-800">{csvFileName}</span>
                  <span>
                    {csvRows.length - invalidCsvRows} valid / {csvRows.length} rows
                    {invalidCsvRows > 0 ? ` · ${invalidCsvRows} need attention` : ''}
                  </span>
                </div>
              )}

              {csvRows.length > 0 && (
                <div className="max-h-64 w-full overflow-x-auto overflow-y-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium uppercase tracking-wider text-gray-500">Row</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium uppercase tracking-wider text-gray-500">Name</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium uppercase tracking-wider text-gray-500">Email</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium uppercase tracking-wider text-gray-500">
                          {isStaff ? 'Employee ID' : 'Student ID'}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium uppercase tracking-wider text-gray-500">Department</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium uppercase tracking-wider text-gray-500">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {csvRows.map((row) => (
                        <tr key={row.rowNumber} className={row.valid ? '' : 'bg-red-50/60'}>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-500">{row.rowNumber}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-900">{row.values.full_name || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.values.email || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                            {(isStaff ? row.values.employee_id : row.values.student_id) || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.values.department || '—'}</td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-start gap-1 text-red-700">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                {row.errors.join(' ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-4 sm:px-6">
          {mode === 'single' ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form={formId} disabled={submitting}>
                <UserPlus className="mr-2 h-4 w-4" />
                {submitting ? 'Creating...' : `Create ${label}`}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {csvRows.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearCsv} disabled={bulkSubmitting}>
                    Clear file
                  </Button>
                )}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="secondary" onClick={onClose} disabled={bulkSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkSubmit}
                  disabled={
                    bulkSubmitting ||
                    csvRows.length === 0 ||
                    invalidCsvRows > 0
                  }
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {bulkSubmitting
                    ? 'Uploading...'
                    : csvRows.length === 0
                      ? `Create ${label}s`
                      : `Create ${csvRows.length} ${label}${csvRows.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
