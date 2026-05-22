'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Smartphone, ArrowRight, Loader2, Ticket } from 'lucide-react';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<'phone' | 'voucher'>('phone');
  const [phone, setPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('Skylink');

  useEffect(() => {
    fetch('/api/public/company')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.company.name) {
          setCompanyName(data.company.name);
        }
      })
      .catch(err => console.error('Load company name error:', err));
  }, []);

  const getCaptivePortalParams = () => {
    const params = new URLSearchParams(window.location.search);

    const loginUrl = params.get('loginurl');
    if (loginUrl) {
      console.log('[Captive Portal] Found loginurl parameter, parsing...');
      const decodedUrl = decodeURIComponent(loginUrl);
      console.log('[Captive Portal] Decoded URL:', decodedUrl);

      const urlParts = decodedUrl.split('?');
      if (urlParts.length > 1) {
        const nestedParams = new URLSearchParams(urlParts[1]);
        return {
          ip: nestedParams.get('ip') || '',
          mac: nestedParams.get('mac') || '',
          userurl: nestedParams.get('userurl') ? decodeURIComponent(nestedParams.get('userurl')!) : 'http://google.com',
          uamip: nestedParams.get('uamip') || '',
          uamport: nestedParams.get('uamport') || '',
          challenge: nestedParams.get('challenge') || '',
          called: nestedParams.get('called') || '',
          nasid: nestedParams.get('nasid') || '',
          sessionid: nestedParams.get('sessionid') || '',
        };
      }
    }

    return {
      ip: params.get('ip') || params.get('client_ip') || '',
      mac: params.get('mac') || params.get('client_mac') || '',
      userurl: params.get('userurl') || 'http://google.com',
    };
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
  
    // Store captive portal params first
    const portalParams = getCaptivePortalParams();
    const { ip: clientIp, mac: clientMac, userurl } = portalParams;
    
    console.log('[Login] Captive portal params:', { clientIp, clientMac, userurl });
  
    if (clientIp) sessionStorage.setItem('client_ip', clientIp);
    if (clientMac) sessionStorage.setItem('client_mac', clientMac);
    if (userurl) sessionStorage.setItem('redirect_url', userurl);
  
    try {
      console.log('[Login] Starting phone login with:', phone);
      
      const res = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
  
      const data = await res.json();
      console.log('[Login] Phone login response:', data);
  
      if (data.success) {
        // Store token and user data FIRST
        localStorage.setItem('customer_token', data.token);
        localStorage.setItem('customer_user', JSON.stringify(data.user));
      
        // ALWAYS go to dashboard first
        console.log('[Login] Redirecting to /customer');
        router.push('/customer');
  
        // Try authorization in the background (don't block)
        if (clientIp && clientMac) {
          let timeout = 86400;
          const value = data.user.profile?.validityValue || 1;
          const unit = data.user.profile?.validityUnit || 'DAYS';
  
          if (unit === 'MINUTES') timeout = value * 60;
          if (unit === 'HOURS') timeout = value * 3600;
          if (unit === 'DAYS') timeout = value * 86400;
  
          // Do this asynchronously - don't await
          fetch('/api/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip: clientIp,
              mac: clientMac,
              username: data.user.username,
              sessionTimeout: timeout
            })
          }).then(authRes => authRes.json())
            .then(authData => {
              console.log('[Login] Background authorization result:', authData);
            })
            .catch(err => {
              console.error('[Login] Background authorization error:', err);
            });
        } 
      } else {
        setError(data.error || 'Phone number not registered');
      }
    } catch (error) {
      console.error('[Login] Unexpected error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Store captive portal params first
    const portalParams = getCaptivePortalParams();
    const { ip: clientIp, mac: clientMac, userurl } = portalParams;

    console.log('[Login] Captive portal params:', { clientIp, clientMac, userurl });
  
    if (clientIp) sessionStorage.setItem('client_ip', clientIp);
    if (clientMac) sessionStorage.setItem('client_mac', clientMac);
    if (userurl) sessionStorage.setItem('redirect_url', userurl);
  
    try {
      console.log('[Login] Starting voucher login with code:', voucherCode);
      
      const res = await fetch('/api/customer/auth/voucher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voucherCode: voucherCode,
          customerName: customerName || 'Guest User',
          customerPhone: customerPhone || ''
        }),
      });
  
      const data = await res.json();
      console.log('[Login] Voucher login response:', data);
  
      if (data.success) {
        // Store token and user data FIRST
        localStorage.setItem('customer_token', data.token);
        localStorage.setItem('customer_user', JSON.stringify(data.user));
  
        // ALWAYS go to dashboard first
        console.log('[Login] Redirecting to /customer');
        router.push('/customer');
        
        // Try authorization in the background (don't block)
        if (clientIp && clientMac) {
          // Calculate timeout from user data
          let timeout = 3600;
          const validityMs = (data.user as any)?.voucherInfo?.timeRemainingMs;
          if (validityMs) {
            timeout = Math.floor(validityMs / 1000);
          }
  
          // Do this asynchronously - don't await
          fetch('/api/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip: clientIp,
              mac: clientMac,
              username: voucherCode,
              sessionTimeout: timeout
            })
          }).then(authRes => authRes.json())
            .then(authData => {
              console.log('[Login] Background authorization result:', authData);
            })
            .catch(err => {
              console.error('[Login] Background authorization error:', err);
            });
        } else {
          console.log('[Login] No IP/MAC in URL, skipping authorization');
        }
      } else {
        console.error('[Login] Voucher login failed:', data.error);
        setError(data.error || 'Invalid voucher code');
      }
    } catch (error) {
      console.error('[Login] Unexpected error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginTypeChange = (type: 'phone' | 'voucher') => {
    setLoginType(type);
    setError('');
    setPhone('');
    setVoucherCode('');
    setCustomerName('');
    setCustomerPhone('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div> */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {companyName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Affordable WiFi Connection
          </p>
          <div className="flex justify-center my-4">
        <Image src="/wifika.png" alt="WiFi" width={445} height={200} className="rounded-lg shadow-md" priority />
        </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Login Type Selector */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button
                type="button"
                onClick={() => handleLoginTypeChange('phone')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  loginType === 'phone'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Smartphone className="w-4 h-4 inline mr-2" />
                Phone
              </button>
              <button
                type="button"
                onClick={() => handleLoginTypeChange('voucher')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  loginType === 'voucher'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Ticket className="w-4 h-4 inline mr-2" />
                Voucher
              </button>
            </div>
          </div>

          {/* Phone Login Form */}
          {loginType === 'phone' && (
            <form onSubmit={handlePhoneLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Smartphone className="w-4 h-4 inline mr-2" />
                  Registered Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="0743XXXXXX"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Voucher Login Form */}
          {loginType === 'voucher' && (
            <form onSubmit={handleVoucherLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Ticket className="w-4 h-4 inline mr-2" />
                  Voucher Code
                </label>
                <input
                  type="text"
                  required
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="ABC123"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter your voucher code (case-insensitive)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !voucherCode}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Redeem Voucher
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Registration Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?
              <br />
              <Link 
                href="/daftar" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium transition-colors"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Powered by Cyberwiz
        </p>
      </div>
    </div>
  );
}