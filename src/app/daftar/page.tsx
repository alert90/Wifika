'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showSuccess, showError } from '@/lib/sweetalert';
import { UserPlus, Loader2, Wifi, CheckCircle } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
  description: string | null;
}

export default function DaftarPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    profileId: '',
    notes: '',
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/pppoe/profiles');
      const data = await res.json();
      setProfiles(data.profiles.filter((p: any) => p.isActive) || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.address || !formData.profileId) {
      await showError('Please complete all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        await showSuccess(
          'Registration has been successfully submitted!\n\nOur team will contact you soon for further processing.'
        );
      } else {
        await showError(data.error || 'Failed to send registration');
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to send registration');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === formData.profileId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
             Registration Successful!
            </h2>
            <p className="text-gray-600 mb-6">
             Thank you for registering. Our team will contact you 
              shortly to complete the installation process.
            </p>
            <Button
              onClick={() => {
                setSuccess(false);
                setFormData({
                  name: '',
                  phone: '',
                  email: '',
                  address: '',
                  profileId: '',
                  notes: '',
                });
              }}
              className="w-full"
            >
              Register Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Wifi className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
           Affordable Internet
          </h1>
          <p className="text-lg text-gray-600">
           Complete the form below to register for unlimited internet.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Registration form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Personal Information</h3>

                <div>
                  <Label>
                   Full name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label>
                   WhatsApp Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="0778XXXXXX"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                   This number will be used for communication
                  </p>
                </div>

                {/* <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com (optional)"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div> */}

                <div>
                  <Label>
                  Complete address <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Mbezi Beach, Dar Es Salaam"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Package Selection */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Select Package</h3>

                <div>
                  <Label>
                   Internet Packages <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.profileId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, profileId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an internet package" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} - {profile.downloadSpeed}/
                          {profile.uploadSpeed} Mbps - Tsh{' '}
                          {profile.price.toLocaleString()}/month
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProfile && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">
                    Selected Package Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Package Name:</span>
                        <span className="font-medium text-gray-900">
                          {selectedProfile.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Speed:</span>
                        <span className="font-medium text-gray-900">
                          {selectedProfile.downloadSpeed}/{selectedProfile.uploadSpeed}{' '}
                          Mbps
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Price:</span>
                        <span className="font-bold text-blue-600">
                          Tsh {selectedProfile.price.toLocaleString()}
                        </span>
                      </div>
                      {selectedProfile.description && (
                        <div className="pt-2 border-t border-blue-200">
                          <p className="text-gray-700">{selectedProfile.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Notes */}
              {/* <div>
                <Label>Additional Notes</Label>
                <textarea
                  className="w-full min-h-20 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Special notes or requests (optional)"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div> */}

              {/* Submit */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Send...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-gray-500">
               By registering, you agree to our terms and conditions of service.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
           Need help? Contact us on WhatsApp or email our support team.
          </p>
        </div>
      </div>
    </div>
  );
}
