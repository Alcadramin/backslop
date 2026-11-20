import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ContactsRepository } from '../contacts/contacts.repository';

@Injectable()
export class CrmSyncService {
  private readonly logger = new Logger(CrmSyncService.name);
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.CRM_API_URL,
    timeout: 5_000,
    headers: { Authorization: `Bearer ${process.env.CRM_API_TOKEN}` },
  });

  constructor(private readonly contacts: ContactsRepository) {}

  async syncTenant(tenantId: string): Promise<number> {
    const pending = await this.contacts.findPendingSync(tenantId);
    const syncedIds: string[] = [];

    for (const contact of pending) {
      await this.http.put(`/contacts/${contact.externalId}`, {
        email: contact.email,
        name: contact.fullName,
        company: contact.companyName,
      });
      syncedIds.push(contact.id);
    }

    await this.contacts.markSyncedMany(syncedIds);
    this.logger.log(`synced ${syncedIds.length} contacts for tenant ${tenantId}`);
    return syncedIds.length;
  }
}
