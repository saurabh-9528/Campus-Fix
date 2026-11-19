import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Users, Mail } from 'lucide-react';

export const StaffList = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getStaff();
        setStaff(data);
      } catch (err) {
        setError(err.message || 'Failed to load staff');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Active Staff</h1>
        <p className="text-sm text-gray-600 mt-1">Overview of maintenance and support staff.</p>
      </div>

      {error && <Alert type="error" message={error} />}
      
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
          {staff.map(member => (
            <Card key={member.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex flex-shrink-0 items-center justify-center text-primary-700 font-bold uppercase">
                    {member.full_name?.charAt(0) || 'S'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
                    <div className="flex items-center text-xs text-gray-500 mt-1 truncate">
                      <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
