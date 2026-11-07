-- Auth identities (Google, Facebook, SAML/OIDC SSO), OAuth state, SSO domains, and persisted Terms/Privacy acceptance.

ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "rawProfileJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuthOAuthState" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "returnPath" TEXT NOT NULL DEFAULT '/app',
    "termsVersion" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthOAuthState_expiresAt_idx" ON "AuthOAuthState"("expiresAt");

CREATE TABLE "SsoDomainConfig" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tenantId" TEXT,
    "idpEntryUrl" TEXT NOT NULL,
    "idpIssuer" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "tokenEndpoint" TEXT,
    "userInfoUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoDomainConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsoDomainConfig_domain_key" ON "SsoDomainConfig"("domain");
