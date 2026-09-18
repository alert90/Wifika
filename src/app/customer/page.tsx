'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/components/ThemeProvider';
import {
  Globe,
  LogOut,
  User,
  Wifi,
  Receipt,
  Loader2,
  Edit2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
} from '@/lib/sweetalert';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface VoucherInfo {
  code: string;
  profileName: string;
  speed: string;
  price: number;
  timeRemainingMs?: number;
}

interface CustomerUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  expiredAt: string | Date;
  profile: {
    name: string;
    downloadSpeed: number;
    uploadSpeed: number;
  } | null;
  voucherInfo?: VoucherInfo;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentLink: string | null;
  payments: unknown[];
}

interface HotspotProfile {
  id: string;
  name: string;
  costPrice: number;
  resellerFee: number;
  sellingPrice: number;
  speed: string;
  groupProfile: string | null;
  sharedUsers: number;
  validityValue: number;
  validityUnit: string;
  isActive: boolean;
}

interface OntDevice {
  manufacturer: string;
  model: string;
  connectionStatus: string;
  wifiSSID: string;
  // Additional properties can be declared as needed:
  [key: string]: string | number | boolean | null | undefined;
}

interface WifiForm {
  ssid: string;
  password: string;
}

type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

interface PaymentStatusResponse {
  success: boolean;
  status?: PaymentStatus;
  orderId?: string;
  error?: string;
}

interface CompanyResponse {
  success: boolean;
  company: { name: string };
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function CustomerDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ontDevice, setOntDevice] = useState<OntDevice | null>(null);
  const [loadingOnt, setLoadingOnt] = useState(true);

  const [editingWifi, setEditingWifi] = useState(false);
  const [wifiForm, setWifiForm] = useState<WifiForm>({ ssid: '', password: '' });
  const [updatingWifi, setUpdatingWifi] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const [companyName, setCompanyName] = useState('WIFIKA');

  // Hotspot profiles & payment
  const [profiles, setProfiles] = useState<HotspotProfile[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<HotspotProfile | null>(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Accordion
  const [openSection, setOpenSection] = useState<string | null>('profile');

  // Polling ref so we can clear on unmount
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleAccordion = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  /* ---------------------------------------------------------------- */
  /* Loaders                                                          */
  /* ---------------------------------------------------------------- */

  const loadCompanyName = useCallback(async () => {
    try {
      const res = await fetch('/api/public/company');
      const data: CompanyResponse = await res.json();
      if (data.success && data.company?.name) {
        setCompanyName(data.company.name);
      }
    } catch (error) {
      console.error('Load company name error:', error);
    }
  }, []);

  const loadUserData = useCallback(async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/customer/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setUser(data.user as CustomerUser);
        setPaymentPhone(data.user?.phone || '');
        localStorage.setItem('customer_user', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
        router.push('/login');
      }
    } catch (error) {
      console.error('Load user data error:', error);
      const cached = localStorage.getItem('customer_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CustomerUser;
          setUser(parsed);
          setPaymentPhone(parsed.phone || '');
        } catch {
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadInvoices = useCallback(async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await fetch('/api/customer/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Load invoices error:', error);
    }
  }, []);

  const loadOntDevice = useCallback(async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await fetch('/api/customer/ont', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.device) {
        setOntDevice(data.device as OntDevice);
      }
    } catch (error) {
      console.error('Load ONT error:', error);
    } finally {
      setLoadingOnt(false);
    }
  }, []);

  const loadHotspotProfiles = useCallback(async () => {
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/hotspot/profiles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const list: HotspotProfile[] = data.profiles || data || [];
      const active = list.filter((p) => p.isActive !== false);
      setProfiles(active);
      if (active.length > 0) setSelectedPlan(active[0]);
    } catch (error) {
      console.error('Load hotspot profiles error:', error);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Init + cleanup                                                   */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
  
    const bootstrap = async () => {
      // Run all loaders concurrently; each one handles its own errors.
      await Promise.all([
        loadCompanyName(),
        loadUserData(),
        loadInvoices(),
        loadOntDevice(),
        loadHotspotProfiles(),
      ]);
      if (cancelled) return;
    };
  
    void bootstrap();
  
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [
    loadCompanyName,
    loadUserData,
    loadInvoices,
    loadOntDevice,
    loadHotspotProfiles,
  ]);

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatValidity = (value: number, unit: string) => {
    const unitMap: Record<string, string> = {
      MINUTES: value === 1 ? 'Minute' : 'Minutes',
      HOURS: value === 1 ? 'Hour' : 'Hours',
      DAYS: value === 1 ? 'Day' : 'Days',
      MONTHS: value === 1 ? 'Month' : 'Months',
    };
    return `${value} ${unitMap[unit] || unit}`;
  };

  const handleGoToInternet = async () => {
    const redirectUrl =
      sessionStorage.getItem('redirect_url') || 'http://google.com';
    const clientIp = sessionStorage.getItem('client_ip');
    const clientMac = sessionStorage.getItem('client_mac');

    if (clientIp && clientMac && user) {
      try {
        let timeout = 3600;
        if (user.voucherInfo?.timeRemainingMs) {
          timeout = Math.floor(user.voucherInfo.timeRemainingMs / 1000);
        }
        await fetch('/api/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: clientIp,
            mac: clientMac,
            username: user.username,
            sessionTimeout: timeout,
          }),
        });
      } catch (err) {
        console.error('[Dashboard] Authorization error:', err);
      }
    }
    window.open(redirectUrl, '_blank');
  };

  /* ---------------------------------------------------------------- */
  /* WiFi update                                                      */
  /* ---------------------------------------------------------------- */

  const handleUpdateWifi = async () => {
    if (!wifiForm.ssid && !wifiForm.password) {
      await showWarning('SSID or password must be provided');
      return;
    }
    if (
      wifiForm.password &&
      (wifiForm.password.length < 8 || wifiForm.password.length > 63)
    ) {
      await showWarning('Password must be between 8 and 63 characters long');
      return;
    }

    setUpdatingWifi(true);
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/ont/update-wifi', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wifiForm),
      });
      const data = await res.json();
      if (data.success) {
        await showSuccess(data.message || 'WiFi updated');
        setEditingWifi(false);
        setWifiForm({ ssid: '', password: '' });
        setTimeout(() => void loadOntDevice(), 3000);
      } else {
        await showError(data.error || 'Failed to update WiFi');
      }
    } catch (error) {
      console.error('Update WiFi error:', error);
      await showError('Failed to update WiFi');
    } finally {
      setUpdatingWifi(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Payment — Wallet Pull + Polling                                  */
  /* ---------------------------------------------------------------- */

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollPaymentStatus = useCallback((orderId: string) => {
    stopPolling();

    const token = localStorage.getItem('customer_token');
    let attempts = 0;
    const maxAttempts = 40; // ~200s @ 5s

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(
          `/api/customer/pay/status?orderId=${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data: PaymentStatusResponse = await res.json();

        if (data.status === 'PAID') {
          stopPolling();
          setPendingOrderId(null);
          await showSuccess(
            'Payment confirmed! Your plan is now active.',
            'Payment Successful'
          );
          window.location.reload();
        } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
          stopPolling();
          setPendingOrderId(null);
          await showError('Payment was not completed. Please try again.');
        } else if (attempts >= maxAttempts) {
          stopPolling();
          setPendingOrderId(null);
          await showInfo(
            'Payment is still pending. If you already paid, it will be activated shortly.',
            'Still Pending'
          );
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 5000);
  }, []);

  const handleInitiatePayment = async () => {
    if (!selectedPlan) {
      await showWarning('Please select a hotspot profile first.');
      return;
    }
    if (!paymentPhone || paymentPhone.length < 10) {
      await showWarning('Please enter a valid mobile money phone number.');
      return;
    }

    setIsPaying(true);
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/pay', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: selectedPlan.id,
          phone: paymentPhone,
          amount: selectedPlan.sellingPrice,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        await showError(data.error || 'Failed to initiate payment.');
        return;
      }

      // ✅ NO redirect. Show "check your phone" and start polling.
      setPendingOrderId(data.orderId as string);
      await showSuccess(
        data.message ||
          'Payment request sent. Please check your phone and enter your mobile money PIN to confirm.',
        'Check Your Phone'
      );
      pollPaymentStatus(data.orderId as string);
    } catch (error) {
      console.error('Payment initiation error:', error);
      await showError('An error occurred while processing payment.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleLogout = () => {
    stopPolling();
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/login');
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  const expiredDate = user.expiredAt ? new Date(user.expiredAt) : null;
  const isExpired = expiredDate ? expiredDate < new Date() : false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {companyName}
            </h1>
            <p className="text-xs text-gray-500">Customer Portal</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Light
            </span>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Dark
            </span>
          </div>

          <button
            onClick={handleGoToInternet}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Promo video */}
        <div className="bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden shadow">
          <video
            src="/wifika.mp4"
            controls
            autoPlay
            loop
            className="w-full h-auto"
          />
        </div>

        {/* Card 1: Account Information */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleAccordion('profile')}
            className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Account Information
              </h2>
            </div>
            {openSection === 'profile' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {openSection === 'profile' && (
            <div className="px-6 pb-6 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              {user.voucherInfo ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Voucher Code:
                    </span>
                    <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                      {user.voucherInfo.code}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Package:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.voucherInfo.profileName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Speed:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.voucherInfo.speed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Price:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(user.voucherInfo.price)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Name:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Phone:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.phone}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Username:
                    </span>
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {user.username}
                    </span>
                  </div>
                  {user.profile && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Package:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {user.profile.name} — {user.profile.downloadSpeed}/
                        {user.profile.uploadSpeed} Mbps
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Status:
                </span>
                <span
                  className={`px-3 py-1 text-sm rounded-full ${
                    isExpired
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {isExpired ? 'Expired' : 'Active'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: WiFi + Hotspot renewal */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleAccordion('ont')}
            className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                <Wifi className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Wi-Fi Profile
              </h2>
            </div>
            {openSection === 'ont' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {openSection === 'ont' && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-100 dark:border-gray-800 pt-4">
              {loadingOnt ? (
                <div className="text-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" />
                </div>
              ) : ontDevice ? (
                <div className="space-y-4">
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      ONT Device Specs
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Model:</span>{' '}
                        <p className="font-medium">
                          {ontDevice.manufacturer} {ontDevice.model}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>{' '}
                        <p className="font-medium text-green-600">
                          {ontDevice.connectionStatus}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        WiFi Settings
                      </h3>
                      {!editingWifi && (
                        <button
                          onClick={() => {
                            setEditingWifi(true);
                            setWifiForm({
                              ssid: ontDevice.wifiSSID ?? '',
                              password: '',
                            });
                          }}
                          className="text-xs text-blue-600 flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>

                    {editingWifi ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={wifiForm.ssid}
                          onChange={(e) =>
                            setWifiForm({ ...wifiForm, ssid: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                          placeholder="WiFi SSID"
                        />
                        <input
                          type="text"
                          value={wifiForm.password}
                          onChange={(e) =>
                            setWifiForm({
                              ...wifiForm,
                              password: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                          placeholder="WiFi Password (8-63 characters)"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateWifi}
                            disabled={updatingWifi}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingWifi(false)}
                            className="px-3 py-2 border text-sm rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">SSID:</span>{' '}
                          <span className="font-medium">
                            {ontDevice.wifiSSID}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No ONT device configured.
                </p>
              )}

              {/* Hotspot renewal */}
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                  Select Hotspot Profile
                </h3>

                <div className="space-y-3">
                  {profiles.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No hotspot profiles available.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {profiles.map((profile) => (
                        <div
                          key={profile.id}
                          onClick={() => setSelectedPlan(profile)}
                          className={`cursor-pointer border rounded-lg p-3 transition ${
                            selectedPlan?.id === profile.id
                              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">
                              {profile.name}
                            </span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              {formatCurrency(profile.sellingPrice)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Speed: {profile.speed}</span>
                            <span>
                              {formatValidity(
                                profile.validityValue,
                                profile.validityUnit
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Payment Phone Number
                    </label>
                    <input
                      type="tel"
                      value={paymentPhone}
                      onChange={(e) => setPaymentPhone(e.target.value)}
                      placeholder="e.g. 255712345678"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 font-mono"
                      disabled={!!pendingOrderId}
                    />
                  </div>

                  <button
                    onClick={handleInitiatePayment}
                    disabled={isPaying || !selectedPlan || !!pendingOrderId}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
                  >
                    {isPaying || pendingOrderId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {pendingOrderId
                      ? 'Waiting for payment confirmation…'
                      : `Pay ${
                          selectedPlan
                            ? formatCurrency(selectedPlan.sellingPrice)
                            : ''
                        } Now`}
                  </button>

                  {pendingOrderId && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                      Order <span className="font-mono">{pendingOrderId}</span>{' '}
                      — check your phone for the mobile money prompt.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Invoices */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleAccordion('invoices')}
            className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                <Receipt className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Billing & Payments
              </h2>
            </div>
            {openSection === 'invoices' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {openSection === 'invoices' && (
            <div className="px-6 pb-6 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              {invoices.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No bills yet
                </p>
              ) : (
                invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {formatCurrency(invoice.amount)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          invoice.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}