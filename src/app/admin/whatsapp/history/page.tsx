'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Phone,
  TrendingUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { showError } from '@/lib/sweetalert';
import Swal from 'sweetalert2';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const getProviderColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'mpwa':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'waha':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'fonnte':
      return 'bg-purple-100 text-purple-700 border-purple-300';
    case 'wablas':
      return 'bg-orange-100 text-orange-700 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

interface HistoryItem {
  id: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed';
  response: string;
  providerName?: string;
  providerType?: string;
  sentAt: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  last24Hours: number;
}

export default function WhatsAppHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, last24Hours: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/whatsapp/history?${params}`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.data);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        showError('Gagal memuat history');
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      showError('Gagal memuat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchHistory();
  };

  const showDetail = (item: HistoryItem) => {
    let responseData;
    try {
      responseData = JSON.parse(item.response);
    } catch {
      responseData = item.response;
    }

    Swal.fire({
      title: 'Detail Pesan',
      html: `
        <div class="text-left space-y-3">
          <div>
            <div class="font-semibold text-sm text-gray-600">Nomor:</div>
            <div class="text-sm">${item.phone}</div>
          </div>
          <div>
            <div class="font-semibold text-sm text-gray-600">Status:</div>
            <div class="text-sm">${item.status === 'sent' ? '✅ Terkirim' : '❌ Gagal'}</div>
          </div>
          ${item.providerName ? `
          <div>
            <div class="font-semibold text-sm text-gray-600">Provider:</div>
            <div class="text-sm">
              <span class="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                ${item.providerName} (${item.providerType?.toUpperCase()})
              </span>
            </div>
          </div>
          ` : ''}
          <div>
            <div class="font-semibold text-sm text-gray-600">Waktu:</div>
            <div class="text-sm">${new Date(item.sentAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
          </div>
          <div>
            <div class="font-semibold text-sm text-gray-600">Pesan:</div>
            <div class="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded mt-1 max-h-48 overflow-auto">${item.message}</div>
          </div>
          <div>
            <div class="font-semibold text-sm text-gray-600">Response:</div>
            <pre class="text-xs bg-gray-50 p-3 rounded mt-1 max-h-64 overflow-auto">${JSON.stringify(responseData, null, 2)}</pre>
          </div>
        </div>
      `,
      width: 600,
      confirmButtonText: 'Tutup',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          WhatsApp History
        </h1>
        <p className="text-gray-500 mt-1">
         WhatsApp message delivery history with status and provider details
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">All messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Sent (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
            <p className="text-xs text-gray-500 mt-1">Sent successfully</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Failed (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-gray-500 mt-1">Failed to send</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Activity (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.last24Hours}</div>
            <p className="text-xs text-gray-500 mt-1">Total delivery</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>Filter messages by status and search for numbers/messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setPage(1);
                }}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('sent');
                  setPage(1);
                }}
                className={statusFilter === 'sent' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Sent
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('failed');
                  setPage(1);
                }}
                className={statusFilter === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Failed
              </Button>
            </div>

            <div className="flex gap-2 flex-1 min-w-[300px]">
              <Input
                placeholder="Search for number or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>
           Displays {history.length} of total recorded messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No message history yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="whitespace-nowrap">
                              {formatDistanceToNow(new Date(item.sentAt), {
                                addSuffix: true,
                                locale: localeId,
                              })}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(item.sentAt).toLocaleString('id-ID', { 
                              timeZone: 'Africa/Dar_Es_Salaam',
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="font-mono">{item.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm">
                            {item.message}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.providerName ? (
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getProviderColor(item.providerType)}`}>
                              <span>{item.providerName}</span>
                              {item.providerType && (
                                <span className="opacity-75 text-[10px]">({item.providerType.toUpperCase()})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.status === 'sent' ? (
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Sent
                            </Badge>
                          ) : (
                            <Badge className="bg-red-600">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => showDetail(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                 Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
