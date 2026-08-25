import { AiProviderNotConfiguredError, type AiProviderPort } from './ai-provider.port';
import { ObjectStorageNotConfiguredError, type ObjectStoragePort } from './object-storage.port';
import { WorkDriveNotConfiguredError, type WorkDrivePort } from './workdrive.port';
import {
  WebsiteConnectorNotConfiguredError,
  type WebsiteConnectorPort,
} from './website-connector.port';
import {
  PaidMediaNotConfiguredError,
  type PaidMediaConnectorPort,
} from './paid-media-connector.port';
import {
  RetentionPolicyNotConfiguredError,
  type RetentionPolicyPort,
} from './retention-policy.port';

export const refusingAiProvider: AiProviderPort = {
  async generate() {
    throw new AiProviderNotConfiguredError();
  },
};

export const refusingObjectStorage: ObjectStoragePort = {
  async putObject() {
    throw new ObjectStorageNotConfiguredError();
  },
  async getObject() {
    throw new ObjectStorageNotConfiguredError();
  },
  async headObject() {
    throw new ObjectStorageNotConfiguredError();
  },
  async deleteObject() {
    throw new ObjectStorageNotConfiguredError();
  },
};

export const refusingWorkDrive: WorkDrivePort = {
  async mapFolder() {
    throw new WorkDriveNotConfiguredError();
  },
  async syncApproved() {
    throw new WorkDriveNotConfiguredError();
  },
  async reconcile() {
    throw new WorkDriveNotConfiguredError();
  },
};

export const refusingWebsiteConnector: WebsiteConnectorPort = {
  async validateSource() {
    throw new WebsiteConnectorNotConfiguredError();
  },
  async startIngestion() {
    throw new WebsiteConnectorNotConfiguredError();
  },
  async getProgress() {
    throw new WebsiteConnectorNotConfiguredError();
  },
};

export const refusingPaidMedia: PaidMediaConnectorPort = {
  async listAccounts() {
    throw new PaidMediaNotConfiguredError();
  },
  async createDraft() {
    throw new PaidMediaNotConfiguredError();
  },
  async activate() {
    throw new PaidMediaNotConfiguredError();
  },
  async reconcileWebhook() {
    throw new PaidMediaNotConfiguredError();
  },
};

export const refusingRetentionPolicy: RetentionPolicyPort = {
  async resolveRetentionDays() {
    throw new RetentionPolicyNotConfiguredError();
  },
};
