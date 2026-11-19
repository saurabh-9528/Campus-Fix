import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { complaintApi } from '../../api/complaints';
import { uploadApi } from '../../api/upload';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { ArrowLeft } from 'lucide-react';
import { CATEGORY_OPTIONS } from '../../utils/categories';

export const NewComplaint = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    location: '',
    priority: 'low',
  });
  const [imageFile, setImageFile] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let uploadedImageUrl = '';
      if (imageFile) {
        const uploadRes = await uploadApi.uploadImage(imageFile);
        uploadedImageUrl = uploadRes.image_url;
      }

      const payload = {
        ...formData,
        image_url: uploadedImageUrl || undefined
      };

      const response = await complaintApi.createComplaint(payload);
      // Navigate to details page on success
      navigate(`/student/complaints/${response.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create complaint');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/student/dashboard" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report an Issue</h1>
          <p className="text-sm text-gray-600 mt-1">Submit a new maintenance or infrastructure complaint.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <Alert type="error" message={error} />}

            <Input
              label="Title"
              id="title"
              name="title"
              required
              maxLength={100}
              placeholder="E.g., Broken fan in Room 302"
              value={formData.title}
              onChange={handleChange}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                required
                maxLength={500}
                rows={4}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                placeholder="Please describe the issue in detail..."
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  required
                  className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  value={formData.category}
                  onChange={handleChange}
                >
                  {CATEGORY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  required
                  className="w-full rounded-md border border-gray-300 h-10 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">Low - No immediate impact</option>
                  <option value="medium">Medium - Causes inconvenience</option>
                  <option value="high">High - Disrupts activities</option>
                  <option value="critical">Critical - Safety hazard</option>
                </select>
              </div>
            </div>

            <Input
              label="Location"
              id="location"
              name="location"
              required
              maxLength={100}
              placeholder="E.g., Block A, 3rd Floor, Room 302"
              value={formData.location}
              onChange={handleChange}
            />

            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                Image (Optional)
              </label>
              <input
                type="file"
                id="image"
                name="image"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-100">
              <Link to="/student/dashboard">
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
