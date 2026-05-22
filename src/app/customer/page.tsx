'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/components/ThemeProvider';
import { Globe, LogOut, User, Wifi, Receipt, Loader2, ExternalLink, Edit2, X, Check } from 'lucide-react';

interface CustomerUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  expiredAt: Date;
  profile: {
    name: string;
    downloadSpeed: number;
    uploadSpeed: number;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentLink: string | null;
  payments: any[];
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ontDevice, setOntDevice] = useState<any>(null);
  const [loadingOnt, setLoadingOnt] = useState(true);
  const [editingWifi, setEditingWifi] = useState(false);
  const [wifiForm, setWifiForm] = useState({ ssid: '', password: '' });
  const [updatingWifi, setUpdatingWifi] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [companyName, setCompanyName] = useState('WIFIKA');

  useEffect(() => {
    loadCompanyName();
    loadUserData();
    loadInvoices();
    loadOntDevice();
  }, [router]);

  const loadCompanyName = async () => {
    try {
      const res = await fetch('/api/public/company');
      const data = await res.json();
      if (data.success && data.company.name) {
        setCompanyName(data.company.name);
      }
    } catch (error) {
      console.error('Load company name error:', error);
    }
  };

  const loadUserData = async () => {
    const token = localStorage.getItem('customer_token');

    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // Fetch fresh data from API
      const res = await fetch('/api/customer/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        // Update localStorage with fresh data
        localStorage.setItem('customer_user', JSON.stringify(data.user));
      } else {
        // Token invalid/expired, logout
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
        router.push('/login');
      }
    } catch (error) {
      console.error('Load user data error:', error);
      // On error, try to use cached data
      const userData = localStorage.getItem('customer_user');
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await fetch('/api/customer/invoices', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Load invoices error:', error);
    }
  };

  const handleGoToInternet = async () => {
    const redirectUrl = sessionStorage.getItem('redirect_url') || 'http://google.com';
    const clientIp = sessionStorage.getItem('client_ip');
    const clientMac = sessionStorage.getItem('client_mac');
    
    console.log('[Dashboard] Go to Internet clicked');
    console.log('[Dashboard] Redirect URL:', redirectUrl);
    console.log('[Dashboard] Stored IP:', clientIp, 'MAC:', clientMac);
    console.log('[Dashboard] Current user:', user?.username);
    
    if (clientIp && clientMac && user) {
      try {
        let timeout = 3600;
        if ((user as any)?.voucherInfo?.timeRemainingMs) {
          timeout = Math.floor((user as any).voucherInfo.timeRemainingMs / 1000);
        }
        
        console.log('[Dashboard] Sending authorization request...');
        
        const authRes = await fetch('/api/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: clientIp,
            mac: clientMac,
            username: user.username,
            sessionTimeout: timeout
          })
        });
        
        const authData = await authRes.json();
        console.log('[Dashboard] Authorization response:', authData);
        
      } catch (err) {
        console.error('[Dashboard] Authorization error:', err);
      }
    }
    
    window.open(redirectUrl, '_blank');
  };

  const loadOntDevice = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await fetch('/api/customer/ont', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success && data.device) {
        setOntDevice(data.device);
      }
    } catch (error) {
      console.error('Load ONT error:', error);
    } finally {
      setLoadingOnt(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleUpdateWifi = async () => {
    if (!wifiForm.ssid && !wifiForm.password) {
      alert('SSID atau password harus diisi');
      return;
    }

    if (wifiForm.password && (wifiForm.password.length < 8 || wifiForm.password.length > 63)) {
      alert('Password harus 8-63 karakter');
      return;
    }

    setUpdatingWifi(true);
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/ont/update-wifi', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wifiForm),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        setEditingWifi(false);
        setWifiForm({ ssid: '', password: '' });
        setTimeout(() => {
          loadOntDevice();
        }, 3000);
      } else {
        alert(data.error || 'Fail update WiFi');
      }
    } catch (error) {
      console.error('Update WiFi error:', error);
      alert('Fail update WiFi');
    } finally {
      setUpdatingWifi(false);
    }
  };

  // Add countdown timer for voucher users
useEffect(() => {
  if ((user as any)?.voucherInfo?.timeRemainingMs > 0 && !(user as any)?.voucherInfo?.isExpired) {
    const interval = setInterval(() => {
      setUser(prevUser => {
        if (!prevUser || !(prevUser as any).voucherInfo) return prevUser;
        
        const remainingMs = (prevUser as any).voucherInfo.timeRemainingMs - 1000;
        if (remainingMs <= 0) {
          clearInterval(interval);
          return {
            ...prevUser,
            voucherInfo: {
              ...(prevUser as any).voucherInfo,
              timeRemainingMs: 0,
              timeRemainingText: 'Expired',
              isExpired: true,
            },
            status: 'expired',
          };
        }
        
        const totalSeconds = Math.floor(remainingMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        let timeRemainingText = '';
        if (days > 0) {
          timeRemainingText = `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
          timeRemainingText = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          timeRemainingText = `${minutes}m ${seconds}s`;
        } else {
          timeRemainingText = `${seconds}s`;
        }
        
        return {
          ...prevUser,
          voucherInfo: {
            ...(prevUser as any).voucherInfo,
            timeRemainingMs: remainingMs,
            timeRemainingText: timeRemainingText,
          },
        };
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }
}, [user]);

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const expiredDate = user.expiredAt ? new Date(user.expiredAt) : null;
  const isExpired = expiredDate ? expiredDate < new Date() : false;
  const daysLeft = expiredDate ? Math.ceil((expiredDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

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
          <span className="text-xs text-gray-500 dark:text-gray-400">Light</span>
        <Switch
          checked={theme === 'dark'}
          onCheckedChange={toggleTheme}
          aria-label="Toggle dark mode"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">Dark</span>
          </div>
          <button onClick={handleGoToInternet} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
          <Globe className="w-4 h-4"/>
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Wifika: Video */}
        <div className="bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden shadow">
        <video
          src="/wifika.mp4"
          controls
          autoPlay
          loop
          className="w-full h-auto"
        />
      </div>
        {/* Card 1: Profile */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Account Information
            </h2>
          </div>
          
          <div className="space-y-3">
            {/* Only show Name and Phone for non-voucher users */}
            {(user as any).voucherInfo ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Voucher Code:</span>
                  <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                    {(user as any).voucherInfo.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Package:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {(user as any).voucherInfo.profileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Speed:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {(user as any).voucherInfo.speed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Price:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency((user as any).voucherInfo.price)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{user.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Username:</span>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Package:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.profile.name} - {user.profile.downloadSpeed}/{user.profile.uploadSpeed} Mbps
                  </span>
                </div>
              </>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              {(user as any).voucherInfo?.isExpired || isExpired ? (
                <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-sm rounded-full">
                  Expired
                </span>
              ) : (user as any).voucherInfo ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-sm rounded-full">
                  Active
                </span>
              ) : user.status === 'active' ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-sm rounded-full">
                  Active
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 text-sm rounded-full">
                  {user.status}
                </span>
              )}
            </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Expires:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {expiredDate ? (
                <>
                  {expiredDate.toLocaleDateString('en-US', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                  {!isExpired && !(user as any).voucherInfo && daysLeft > 0 && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({daysLeft} days left)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-400">Not set</span>
              )}
            </span>
          </div>
          </div>

          {/* Countdown Timer for Vouchers */}
          {(user as any).voucherInfo && !(user as any).voucherInfo.isExpired && (user as any).voucherInfo.timeRemainingMs > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Time Remaining</p>
                <div className="text-3xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {(user as any).voucherInfo.timeRemainingText}
                </div>
              </div>
            </div>
          )}

          {!isExpired && daysLeft <= 7 && !(user as any).voucherInfo && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                ⚠️ Your account will expire in {daysLeft} days. Please renew to avoid service interruption.
              </p>
            </div>
          )}

          {/* Voucher Information Card */}
          {/* {(user as any).voucherInfo && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-400">Voucher Details:</p>
              <div className="text-xs text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                <p>📝 Code: <span className="font-mono font-bold">{(user as any).voucherInfo.code}</span></p>
                <p>📦 Package: {(user as any).voucherInfo.profileName}</p>
                <p>⚡ Speed: {(user as any).voucherInfo.speed}</p>
                <p>💰 Price: {formatCurrency((user as any).voucherInfo.price)}</p>
                <p>⏱️ Validity: {(user as any).voucherInfo.validityDisplay}</p>
                <p>📊 Status: {(user as any).voucherInfo.status}</p>
              </div>
            </div>
          )} */}
        </div>
        {/* Card 2: ONT/WiFi */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <Wifi className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              ONT / WiFi Information
            </h2>
          </div>
          
          {loadingOnt ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
            </div>
          ) : !ontDevice ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Wifi className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>ONT not found or not configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Device Info */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">ONT device</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Model:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{ontDevice.manufacturer} {ontDevice.model}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Serial:</span>
                    <p className="font-mono text-xs font-medium text-gray-900 dark:text-white">{ontDevice.serialNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <p className="font-medium">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        ontDevice.connectionStatus === 'Online' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {ontDevice.connectionStatus}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">IP Address:</span>
                    <p className="font-mono text-xs font-medium text-gray-900 dark:text-white">{ontDevice.ipAddress}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{ontDevice.uptime}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">PON Mode:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{ontDevice.ponMode}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">RX Power:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{ontDevice.rxPower} dBm</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{ontDevice.temperature}°C</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Active Clients:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{ontDevice.activeClients}</p>
                  </div>
                </div>
              </div>

              {/* WiFi Info */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">WiFi Information</h3>
                  {!editingWifi && (
                    <button
                      onClick={() => {
                        setEditingWifi(true);
                        setWifiForm({ ssid: ontDevice.wifiSSID, password: '' });
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>
                
                {editingWifi ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">SSID WiFi:</label>
                      <input
                        type="text"
                        value={wifiForm.ssid}
                        onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="Wifi SSID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Password WiFi:</label>
                      <input
                        type="text"
                        value={wifiForm.password}
                        onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="Wifi Password (8-63 karakter)"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank if you don't want to change</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateWifi}
                        disabled={updatingWifi}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition"
                      >
                        {updatingWifi ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditingWifi(false);
                          setWifiForm({ ssid: '', password: '' });
                        }}
                        disabled={updatingWifi}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">SSID:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ontDevice.wifiSSID}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Password:</span>
                      <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
                        {ontDevice.wifiPassword ? '••••••••' : 'Not available'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status WiFi:</span>
                      <span className={`font-medium ${
                        ontDevice.wifiEnabled 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {ontDevice.wifiEnabled ? 'Active' : 'Nonactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Channel:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ontDevice.wifiChannel}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Invoices */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <Receipt className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Billing & Payments
            </h2>
          </div>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No bill yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const dueDate = new Date(invoice.dueDate);
                const isPaid = invoice.status === 'PAID';
                const isOverdue = !isPaid && dueDate < new Date();

                return (
                  <div
                    key={invoice.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Due date: {dueDate.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(invoice.amount)}
                        </p>
                        {isPaid ? (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-xs rounded-full">
                            Paid off
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                            Late
                          </span>
                        ) : (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 text-xs rounded-full">
                            Not yet paid
                          </span>
                        )}
                      </div>
                    </div>

                    {!isPaid && invoice.paymentLink && (
                      <a
                        href={invoice.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                      >
                        Pay Now
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    {isPaid && invoice.paidAt && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Paid: {new Date(invoice.paidAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
