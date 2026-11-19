import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { complaintApi } from '../../api/complaints';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { getCategoryLabel } from '../../utils/categories';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { ArrowLeft, MapPin, Calendar, LayoutGrid, AlertCircle, MessageSquare } from 'lucide-react';

export const ComplaintDetails = () => {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Feedback Form State
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const data = await complaintApi.getComplaint(id);
      setComplaint(data);
      
      // If closed, fetch existing feedback
      if (data.status === 'closed') {
        try {
          const feedbackData = await complaintApi.getFeedback(id);
          setFeedback(feedbackData);
        } catch (fErr) {
          console.error("No feedback found or error fetching", fErr);
        }
      }
      
      try {
        const historyData = await complaintApi.getHistory(id);
        setHistory(historyData);
      } catch (hErr) {
        console.error("Failed to fetch history", hErr);
      }
    } catch (err) {
      setError(err.message || 'Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await complaintApi.submitFeedback(id, {
        rating: parseInt(feedbackRating),
        comment: feedbackComment
      });
      // Refresh to get closed status and feedback
      await fetchDetails();
    } catch (err) {
      setFeedbackError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size={32} /></div>;
  }

  if (error || !complaint) {
    return (
      <div className="space-y-4">
        <Link to="/student/complaints">
          <Button variant="secondary"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Complaints</Button>
        </Link>
        <Alert type="error" message={error || "Complaint not found"} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Link to="/student/complaints" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaint Details</h1>
          <p className="text-sm text-gray-600">ID: #{complaint.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Details (Left Col) */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">{complaint.title}</h2>
                <StatusBadge status={complaint.status} />
              </div>
              
              <p className="text-gray-700 whitespace-pre-wrap mb-6">
                {complaint.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div className="flex items-center text-gray-600">
                  <LayoutGrid className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Category:</span>
                  <span className="capitalize">{getCategoryLabel(complaint.category)}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Location:</span>
                  <span>{complaint.location}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <AlertCircle className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Priority:</span>
                  <PriorityBadge priority={complaint.priority} />
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="font-medium mr-2">Submitted:</span>
                  <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {complaint.image_url && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Attached Image</h3>
                  <div className="mb-2">
                    <img src={complaint.image_url} alt="Complaint Attachment" className="max-w-full h-auto max-h-96 rounded-md shadow-sm border border-gray-200" />
                  </div>
                  <a href={complaint.image_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm break-all">
                    {complaint.image_url}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resolution Note if available */}
          {complaint.resolution_note && (
            <Card className="border-success/20 bg-green-50/30">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-2">
                  <MessageSquare className="mr-2 h-5 w-5 text-success" />
                  Resolution Note
                </h3>
                <p className="text-gray-700">{complaint.resolution_note}</p>
              </CardContent>
            </Card>
          )}

          {/* Feedback Form (Only if resolved) */}
          {complaint.status === 'resolved' && (
            <Card className="border-primary-100 shadow-sm">
              <CardHeader className="bg-primary-50/50 border-b border-primary-100 pb-4">
                <CardTitle className="text-primary-800">Submit Feedback</CardTitle>
                <p className="text-sm text-primary-600">Your issue has been resolved. Please rate the service.</p>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  {feedbackError && <Alert type="error" message={feedbackError} />}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
                    <select 
                      className="w-full sm:w-1/3 rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      value={feedbackRating}
                      onChange={(e) => setFeedbackRating(e.target.value)}
                      required
                    >
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Average</option>
                      <option value="2">2 - Poor</option>
                      <option value="1">1 - Terrible</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comment (Optional)</label>
                    <textarea
                      className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      rows={3}
                      placeholder="Any additional feedback..."
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                    />
                  </div>
                  
                  <Button type="submit" disabled={isSubmittingFeedback}>
                    {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback & Close'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Existing Feedback View (Only if closed) */}
          {complaint.status === 'closed' && feedback && (
            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Feedback</h3>
                <div className="flex items-center mb-2">
                  <span className="font-medium text-gray-700 mr-2">Rating:</span>
                  <div className="flex text-amber-500">
                    {'★'.repeat(feedback.rating)}
                    <span className="text-gray-300">{'★'.repeat(5 - feedback.rating)}</span>
                  </div>
                </div>
                {feedback.comment && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">Comment:</span>
                    <p className="text-gray-600 bg-white p-3 border border-gray-200 rounded-md">{feedback.comment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar (Right Col) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline history={history} />
            </CardContent>
          </Card>

          {complaint.assigned_staff_id && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-500 uppercase tracking-wider">Assigned Staff</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold uppercase">
                    ST
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Staff Member</p>
                    <p className="text-xs text-gray-500">ID: {complaint.assigned_staff_id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
