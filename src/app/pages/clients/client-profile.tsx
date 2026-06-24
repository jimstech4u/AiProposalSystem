import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { selectRows } from '../../../lib/supabase';
import { openGmailCompose } from '../../../lib/gmail';

type ClientRow = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  industry?: string | null;
  segment?: string | null;
  address?: string | null;
  notes?: string | null;
  rating?: number | null;
  created_at: string;
};

export default function ClientProfile() {
  const { id } = useParams();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClient() {
      if (!id) return;
      try {
        const [row] = await selectRows<ClientRow>('clients', `select=*&id=eq.${id}`);
        setClient(row ?? null);
      } catch (error) {
        console.warn('Unable to load client:', error);
      } finally {
        setLoading(false);
      }
    }

    loadClient();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <Link to="/clients" className="mb-4 inline-flex">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Button>
        </Link>
        <p className="text-sm text-gray-600">Loading client profile...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Link to="/clients" className="mb-4 inline-flex">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Button>
        </Link>
        <p className="text-sm text-gray-600">Client record was not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-2xl font-bold text-white">
            {client.company_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">{client.company_name}</h1>
            <p className="text-gray-600 mt-1">{client.industry || 'Industry not set'}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to="/clients" aria-label="Back to Clients">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          {client.contact_email && (
              <Button
                variant="outline"
                className="h-10 w-10 px-0 sm:w-auto sm:px-4"
                aria-label="Send Email"
                onClick={() => openGmailCompose({
                  to: client.contact_email!,
                  subject: `Follow up from JimsTech4U about ${client.company_name}`,
                  body: `Hello ${client.contact_name || client.company_name},\n\n`,
                })}
              >
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Send Email</span>
              </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Segment</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{client.segment || 'Not set'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Rating</p>
            <p className="text-2xl font-bold text-sky-700 mt-2">{client.rating == null ? 'Not rated' : `${client.rating}/5`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Client Since</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{new Date(client.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Primary Contact</p>
                  <p className="font-medium text-gray-900">{client.contact_name || 'No contact person set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <p className="text-gray-700">{client.contact_email || 'No email set'}</p>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <p className="text-gray-700">{client.contact_phone || 'No phone set'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <p className="text-gray-700 whitespace-pre-line">{client.address || 'No address set'}</p>
              </div>
              <Badge variant="default">{client.segment || 'Client'}</Badge>
            </div>
          </div>
          {client.notes && <p className="mt-6 text-sm leading-6 text-gray-700">{client.notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
