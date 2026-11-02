import { PrismaClient } from '@prisma/client';
import { newId } from '@oma/domain';

const prisma = new PrismaClient();
const TENANT_NAME = 'OMA Demo Agency';
const OWNER_EMAIL = 'platform-owner@example.com';

const svg = (label: string, color: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${color}"/><text x="50%" y="46%" text-anchor="middle" font-family="Arial,sans-serif" font-size="48" fill="#0f172a">${label}</text><text x="50%" y="56%" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#334155">نور ميديا</text></svg>`,
  )}`;

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) throw new Error(`missing owner ${OWNER_EMAIL}`);
  const tenant = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (!tenant) throw new Error(`missing tenant ${TENANT_NAME}`);

  const brands = [
    { name: 'Yasmeen Bakery', nameAr: 'مخبز ياسمين', website: 'https://yasmeen-bakery.example/', color: '#fde68a' },
    { name: 'Anaqa Gaza', nameAr: 'أناقة غزة', website: 'https://anaqa-gaza.example/', color: '#fbcfe8' },
    { name: 'Amal Academy', nameAr: 'أكاديمية أمل', website: 'https://amal-academy.example/', color: '#bfdbfe' },
  ];

  const brandIds: string[] = [];
  for (const b of brands) {
    let row = await prisma.brandWorkspace.findFirst({ where: { tenantId: tenant.id, name: b.name } });
    if (!row) {
      row = await prisma.brandWorkspace.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          name: b.name,
          status: 'ACTIVE',
          logoUrl: svg(b.nameAr, b.color),
        },
      });
    }
    brandIds.push(row.id);
    console.log('brand', b.nameAr, row.id);
  }

  // Rename existing English lock-seed deliverables to Arabic Noor titles + images
  const deliv = [
    { en: 'Lock seed — approved', ar: 'منشور عيد الفطر — مخبز ياسمين', img: svg('ياسمين', '#fde68a'), brand: 0 },
    { en: 'Lock seed — changes requested', ar: 'حملة أناقة غزة — تعديلات مطلوبة', img: svg('أناقة', '#fbcfe8'), brand: 1 },
    { en: 'Lock seed — in review', ar: 'ريلز أكاديمية أمل — بانتظار المراجعة', img: svg('أمل', '#bfdbfe'), brand: 2 },
    { en: 'Lock seed — draft', ar: 'قصة صباحية — مسودة', img: svg('مسودة', '#e2e8f0'), brand: 0 },
    // already renamed?
    { en: 'منشور عيد الفطر — مخبز ياسمين', ar: 'منشور عيد الفطر — مخبز ياسمين', img: svg('ياسمين', '#fde68a'), brand: 0 },
  ];

  for (const d of deliv) {
    const rows = await prisma.workDeliverable.findMany({ where: { tenantId: tenant.id, titleEn: d.en } });
    for (const row of rows) {
      await prisma.workDeliverable.update({
        where: { id: row.id },
        data: {
          titleEn: d.ar,
          titleAr: d.ar,
          brandId: brandIds[d.brand] ?? row.brandId,
          assetUrl: d.img,
        },
      });
      const versions = await prisma.workDeliverableVersion.findMany({ where: { deliverableId: row.id } });
      for (const v of versions) {
        await prisma.workDeliverableVersion.update({
          where: { id: v.id },
          data: { assetUrl: d.img, notesAr: d.ar, notesEn: d.ar },
        });
      }
      console.log('deliverable', d.ar);
    }
  }

  const reqs = [
    { en: 'Lock seed — brief ready', ar: 'طلب محتوى عيد — مخبز ياسمين', brand: 0 },
    { en: 'Lock seed — brief incomplete', ar: 'طلب حملة رمضان — أناقة غزة', brand: 1 },
    { en: 'طلب محتوى عيد — مخبز ياسمين', ar: 'طلب محتوى عيد — مخبز ياسمين', brand: 0 },
  ];
  for (const r of reqs) {
    const rows = await prisma.workRequest.findMany({ where: { tenantId: tenant.id, titleEn: r.en } });
    for (const row of rows) {
      await prisma.workRequest.update({
        where: { id: row.id },
        data: {
          titleEn: r.ar,
          titleAr: r.ar,
          descriptionAr: 'موجز إنتاج لنور ميديا — جمهور محلي في غزة.',
          descriptionEn: 'موجز إنتاج لنور ميديا — جمهور محلي في غزة.',
          brandId: brandIds[r.brand] ?? row.brandId,
        },
      });
      console.log('request', r.ar);
    }
  }

  // Rename old demo brand workspaces if they still have English demo names
  const alias = [
    { from: 'Globex Group (Demo)', to: 'Yasmeen Bakery', website: 'https://yasmeen-bakery.example/' },
    { from: 'Acme Retail', to: 'Anaqa Gaza', website: 'https://anaqa-gaza.example/' },
    { from: 'Northwind Services', to: 'Amal Academy', website: 'https://amal-academy.example/' },
  ];
  for (const a of alias) {
    const row = await prisma.brandWorkspace.findFirst({ where: { tenantId: tenant.id, name: a.from } });
    if (row) {
      await prisma.brandWorkspace.update({
        where: { id: row.id },
        data: { name: a.to },
      });
      console.log('renamed brand', a.from, '->', a.to);
    }
  }

  // SOFT_DELETE_JUNK_NOV03: keep only Noor brands visible
  await prisma.brandWorkspace.updateMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      NOT: { name: { in: ['Yasmeen Bakery', 'Anaqa Gaza', 'Amal Academy'] } },
    },
    data: { deletedAt: new Date() },
  });
  console.log('soft-deleted non-Noor brands');

  console.log('done');
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

