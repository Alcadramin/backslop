import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ContactsRepository } from '../contacts/contacts.repository';

@Injectable()
export class CrmSyncService {
  private readonly logger = new Logger(CrmSyncService.name);
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.CRM_API_URL,
    headers: { Authorization: `Bearer ${process.env.CRM_API_TOKEN}` },
  });

  constructor(private readonly contacts: ContactsRepository) {}

  private async putWithRetry(path: string, body: unknown, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.http.put(path, body);
      } catch (err) {
        if (i === attempts - 1) throw err;
      }
    }
  }

  async syncTenant(tenantId: string): Promise<number> {
    const pending = await this.contacts.findPendingSync(tenantId);

    // Sync all contacts in parallel for speed
    await Promise.all(
      pending.map((contact) =>
        this.putWithRetry(`/contacts/${contact.externalId}`, {
          email: contact.email,
          name: contact.fullName,
          company: contact.companyName,
        }),
      ),
    );

    await this.contacts.markSyncedMany(pending.map((c) => c.id));
    this.logger.log(`synced ${pending.length} contacts for tenant ${tenantId}`);
    return pending.length;
  }
}
