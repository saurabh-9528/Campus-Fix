import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Users, Mail, BadgeCheck, Building2, IdCard } from 'lucide-react';

export const StaffList = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getStaff(true);
      setStaff(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleActivate = async (member) => {
    if (activatingId !== null) return;
    setActivatingId(member.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      await adminApi.activateStaff(member.id);
      setActionSuccess(`Activated ${member.full_name}.`);
      const data = await adminApi.getStaff(true);
      setStaff(data || []);
    } catch (err) {
      setActionError(err.message || 'Failed to activate staff member');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Staff</h1>
        <p className="text-sm text-gray-600 mt-1">Overview of active and pending maintenance staff.</p>
      </div>

      {error && <Alert type="error" message={error} />}
      {actionError && <Alert type="error" message={actionError} onClose={() => setActionError(null)} />}
      {actionSuccess && <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess(null)} />}

      {loading ? (
        <div className="flex justify-center p-12"><Spinner size={32} /></div>
      ) : staff.length === 0 ? (
        <Card className="bg-gray-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No staff found</h3>
            <p className="text-gray-500 mt-1">There are currently no staff members in the system.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(member => {
            const isPending = member.account_status === 'pending_activation';
            const isActivating = activatingId === member.id;

            return (
              <Card key={member.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="h-12 w-12 rounded-full bg-primary-100 flex flex-shrink-0 items-center justify-center text-primary-700 font-bold uppercase">
                      {member.full_name?.charAt(0) || 'S'}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
                      <div className="flex items-center text-xs text-gray-500 truncate">
                        <Mail className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      {member.employee_id && (
                        <div className="flex items-center text-xs text-gray-500 truncate">
                          <IdCard className="h-3 w-3 mr-1.5 flex-shrink-0" />
                          <span>ID: {member.employee_id}</span>
                        </div>
                      )}
                      {member.department && (
                        <div className="flex items-center text-xs text-gray-500 truncate">
                          <Building2 className="h-3 w-3 mr-1.5 flex-shrink-0" />
                          <span>{member.department}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        {isPending ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                            Pending Activation
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isPending && (
                    <Button
                      onClick={() => handleActivate(member)}
                      disabled={activatingId !== null}
                      className="w-full"
                    >
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      {isActivating ? 'Activating...' : 'Activate'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
