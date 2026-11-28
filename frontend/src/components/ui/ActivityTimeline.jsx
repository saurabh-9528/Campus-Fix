import React from 'react';
import { Check, Clock, UserPlus, UserMinus, FileText, CheckCircle, RefreshCcw } from 'lucide-react';

const ActionIcon = ({ action }) => {
  switch (action) {
    case 'submitted':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'assigned':
    case 'reassigned':
      return <UserPlus className="h-4 w-4 text-orange-600" />;
    case 'unassigned':
      return <UserMinus className="h-4 w-4 text-gray-600" />;
    case 'status_changed':
    case 'in_progress':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'resolved':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'closed':
      return <Check className="h-4 w-4 text-gray-800" />;
    default:
      return <RefreshCcw className="h-4 w-4 text-gray-500" />;
  }
};

const ActionLabel = ({ action, details }) => {
  switch (action) {
    case 'submitted':
      return 'Complaint Submitted';
    case 'assigned':
      return `Assigned: ${details || 'to staff'}`;
    case 'reassigned':
      return `Reassigned: ${details || 'to new staff'}`;
    case 'unassigned':
      return 'Unassigned';
    case 'status_changed':
      return details && details.startsWith('Priority changed') ? 'Priority Updated' : 'Status Updated';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return action;
  }
};

export const ActivityTimeline = ({ history = [] }) => {
  if (!history || history.length === 0) {
    return (
      <div className="py-4 text-gray-500 italic text-sm">
        No activity history available for this complaint.
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        <div className="space-y-6 relative">
          {history.map((event, index) => {
            return (
              <div key={event.id || index} className="flex space-x-4">
                <div className="z-10 h-8 w-8 rounded-full flex items-center justify-center bg-white border-2 border-gray-200 shadow-sm shrink-0 mt-1">
                  <ActionIcon action={event.action} />
                </div>
                <div className="flex-1 text-sm bg-gray-50 p-3 rounded-md border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-gray-900">
                      <ActionLabel action={event.action} details={event.details} />
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="text-gray-600 text-xs mt-1">
                    By <span className="font-medium text-gray-700">{event.actor?.full_name}</span> ({event.actor?.role})
                  </div>
                  
                  {event.action === 'status_changed' && event.previous_status && event.new_status && (
                    <div className="mt-2 text-xs bg-white px-2 py-1 rounded border border-gray-200 inline-block">
                      <span className="text-gray-500 line-through mr-1">{event.previous_status}</span>
                      <span className="text-gray-900 font-medium">→ {event.new_status}</span>
                    </div>
                  )}

                  {event.action === 'status_changed' && event.details && (
                    <div className="mt-2 text-xs bg-white text-gray-700 px-2 py-1 rounded border border-gray-200 inline-block">
                      {event.details}
                    </div>
                  )}

                  {event.action === 'resolved' && event.details && (
                    <div className="mt-2 text-xs bg-green-50 text-green-800 px-2 py-1 rounded border border-green-200 italic">
                      "{event.details}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
