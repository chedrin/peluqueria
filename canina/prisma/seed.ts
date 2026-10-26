/**
 * Datos de demostración. Ejecuta: npm run db:seed
 * Usuarios (contraseña "cania1234"):
 *   admin@cania.test · recepcion@cania.test · laura@cania.test (peluquera) · cliente@cania.test
 */
import { PrismaClient, type CoatType, type DogSize } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TZDate } from "@date-fns/tz";

const prisma = new PrismaClient();
const TZ = "Europe/Madrid";

function todayAt(h: number, m = 0, addDays = 0) {
  const now = new TZDate(Date.now(), TZ);
  return new Date(new TZDate(now.getFullYear(), now.getMonth(), now.getDate() + addDays, h, m, 0, TZ).getTime());
}

async function main() {
  const passwordHash = await bcrypt.hash("cania1234", 10);

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      legalName: "Peluquería Canina CANIA S.L.",
      tradeName: "CANIA",
      taxId: "B12345674",
      address: "Calle del Perro Feliz 12",
      postalCode: "28001",
      city: "Madrid",
      province: "Madrid",
      email: "hola@cania.test",
      phone: "+34 910 000 000",
      registryInfo: "Inscrita en el Registro Mercantil de Madrid, Tomo 0000, Folio 00, Hoja M-000000",
    },
  });

  await prisma.loyaltyProgram.upsert({ where: { id: "default" }, update: {}, create: { id: "default", mode: "POINTS", pointsPerEuro: 1, centsPer100Points: 500 } });

  // ---------- Staff ----------
  const mkStaff = async (email: string, first: string, last: string, role: "ADMIN" | "GROOMER" | "RECEPTION", color: string, order: number, groomer: boolean) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email, firstName: first, lastName: last, role, passwordHash,
        staffProfile: groomer
          ? {
              create: {
                displayName: first, color, sortOrder: order,
                // L-V 9:00-14:00 y 16:00-20:00; sábado 9:00-14:00
                workingHours: {
                  create: [1, 2, 3, 4, 5].flatMap((weekday) => [
                    { weekday, startMin: 540, endMin: 840 },
                    { weekday, startMin: 960, endMin: 1200 },
                  ]).concat([{ weekday: 6, startMin: 540, endMin: 840 }]),
                },
              },
            }
          : undefined,
      },
      include: { staffProfile: true },
    });

  const admin = await mkStaff("admin@cania.test", "Marta", "Gerente", "ADMIN", "#0f766e", 0, false);
  await mkStaff("recepcion@cania.test", "Pablo", "Recepción", "RECEPTION", "#64748b", 0, false);
  const laura = await mkStaff("laura@cania.test", "Laura", "Peluquera", "GROOMER", "#ec4899", 1, true);
  const david = await mkStaff("david@cania.test", "David", "Peluquero", "GROOMER", "#6366f1", 2, true);
  const sara = await mkStaff("sara@cania.test", "Sara", "Peluquera", "GROOMER", "#f59e0b", 3, true);

  // ---------- Catálogo ----------
  const cat = async (name: string, sortOrder: number) => prisma.serviceCategory.upsert({ where: { name }, update: {}, create: { name, sortOrder } });
  const higiene = await cat("Baño e higiene", 1);
  const corte = await cat("Corte y estilismo", 2);
  const spa = await cat("Spa y tratamientos", 3);
  const extras = await cat("Extras", 4);

  const sizes: DogSize[] = ["SMALL", "MEDIUM", "LARGE", "GIANT"];
  const svc = async (slug: string, name: string, categoryId: string, base: number, min: number, matrix: [number, number][], extra: Partial<{ coat: [CoatType, DogSize, number, number][]; buffer: number; description: string }> = {}) =>
    prisma.service.upsert({
      where: { slug },
      update: {},
      create: {
        slug, name, categoryId, basePriceCents: base, baseDurationMin: min, bufferAfterMin: extra.buffer ?? 10, description: extra.description,
        pricing: {
          create: [
            ...matrix.map(([price, dur], i) => ({ size: sizes[i], priceCents: price, durationMin: dur })),
            ...(extra.coat ?? []).map(([coatType, size, price, dur]) => ({ size, coatType, priceCents: price, durationMin: dur })),
          ],
        },
      },
    });

  const bano = await svc("bano-basico", "Baño básico", higiene.id, 2500, 45, [[2500, 45], [3200, 60], [4200, 75], [5500, 90]], {
    description: "Baño con champú adaptado, secado y cepillado.",
    coat: [["DOUBLE", "LARGE", 5200, 105], ["DOUBLE", "GIANT", 6800, 120]],
  });
  const tijera = await svc("corte-tijera", "Corte a tijera", corte.id, 4000, 90, [[4000, 90], [5000, 105], [6200, 120], [7500, 150]], { coat: [["CURLY", "SMALL", 4500, 105], ["CURLY", "MEDIUM", 5600, 120]] });
  const stripping = await svc("stripping", "Stripping", corte.id, 5000, 120, [[5000, 120], [6000, 150], [7000, 180], [8500, 210]], { description: "Arrancado manual para pelo duro (terriers, schnauzer…)." });
  const deslanado = await svc("deslanado", "Deslanado", higiene.id, 3500, 75, [[3500, 60], [4500, 75], [5500, 90], [7000, 120]]);
  const ozono = await svc("spa-ozono", "Spa de ozono", spa.id, 1500, 20, [], { buffer: 5, description: "Hidroterapia con ozono para pieles sensibles y dermatitis." });
  const unas = await svc("corte-unas", "Corte de uñas", extras.id, 800, 10, [], { buffer: 0 });
  const glandulas = await svc("vaciado-glandulas", "Vaciado de glándulas", extras.id, 800, 10, [], { buffer: 0 });

  for (const s of [laura, david, sara]) {
    const services = s === sara ? [bano, deslanado, ozono, unas, glandulas] : [bano, tijera, stripping, deslanado, ozono, unas, glandulas];
    for (const sv of services)
      await prisma.staffService.upsert({ where: { staffId_serviceId: { staffId: s.staffProfile!.id, serviceId: sv.id } }, update: {}, create: { staffId: s.staffProfile!.id, serviceId: sv.id } });
  }

  // ---------- Bonos ----------
  const bonoBanos = await prisma.voucherProduct.upsert({
    where: { id: "bono-5-1-mediano" },
    update: {},
    create: { id: "bono-5-1-mediano", name: "Bono 5 Baños + 1 Gratis (mediano)", priceCents: 16000, totalSessions: 6, validityDays: 365, size: "MEDIUM", services: { create: [{ serviceId: bano.id }] } },
  });
  await prisma.voucherProduct.upsert({
    where: { id: "pack-mantenimiento" },
    update: {},
    create: { id: "pack-mantenimiento", name: "Pack Mantenimiento Mensual", description: "Uñas + glándulas cada mes", priceCents: 1500 * 6, totalSessions: 12, validityDays: 180, services: { create: [{ serviceId: unas.id }, { serviceId: glandulas.id }] } },
  });

  // ---------- Razas ----------
  const breeds = [
    ["Caniche", "SMALL", "CURLY"], ["Bichón maltés", "SMALL", "LONG"], ["Schnauzer miniatura", "SMALL", "WIRE"],
    ["Border collie", "MEDIUM", "DOUBLE"], ["Cocker spaniel", "MEDIUM", "LONG"], ["Golden retriever", "LARGE", "DOUBLE"],
    ["Pastor alemán", "LARGE", "DOUBLE"], ["Terranova", "GIANT", "DOUBLE"], ["Yorkshire terrier", "SMALL", "LONG"],
  ] as const;
  const breed: Record<string, string> = {};
  for (const [name, defaultSize, defaultCoatType] of breeds)
    breed[name] = (await prisma.breed.upsert({ where: { name }, update: {}, create: { name, defaultSize, defaultCoatType } })).id;

  // ---------- Clientes y perros ----------
  const client = await prisma.user.upsert({
    where: { email: "cliente@cania.test" },
    update: {},
    create: {
      email: "cliente@cania.test", firstName: "Lucía", lastName: "García", phone: "+34 600 111 222", passwordHash, role: "CLIENT",
      consents: { create: [{ purpose: "PRIVACY_POLICY", granted: true, policyVersion: "2026-10-v1" }, { purpose: "CANCELLATION_POLICY", granted: true, policyVersion: "2026-10-v1" }] },
      ownerProfile: {
        create: {
          taxId: "12345678Z", whatsapp: "+34 600 111 222", address: "Calle Sol 2, 3ºB", postalCode: "28002", city: "Madrid", province: "Madrid",
          preferredCutStyle: "Corte cachorro", personalNotes: "Prefiere que la llamemos al terminar, no WhatsApp.", favoriteGroomerId: laura.staffProfile!.id,
          loyaltyCard: { create: { cardNumber: "CAN-DEMO-0001", pointsBalance: 140, lifetimePoints: 140 } },
        },
      },
    },
    include: { ownerProfile: true },
  });
  const owner = client.ownerProfile!;

  const mkDog = (data: Parameters<typeof prisma.dog.create>[0]["data"]) => prisma.dog.create({ data });
  const existingDogs = await prisma.dog.count({ where: { ownerId: owner.id } });
  if (existingDogs === 0) {
    const toby = await mkDog({
      owner: { connect: { id: owner.id } }, name: "Toby", breed: { connect: { id: breed["Border collie"] } }, size: "MEDIUM", coatType: "DOUBLE",
      currentWeightKg: 18.5, birthDate: new Date("2021-04-10"), temperament: "NERVOUS", toleratesDryer: "PARTIAL", toleratesBlower: "NO", allowsNailTrim: "YES",
      handlingNotes: "Se tranquiliza si le hablas bajito. No le gusta que le toquen la cola.", favoriteTreats: "Bolitas de pollo", favoriteToys: "Pelota naranja",
      healthAlerts: { create: [{ type: "SKIN_ALLERGY", severity: "CRITICAL", description: "Alergia a la clorhexidina: usar champú de avena" }] },
      weightHistory: { create: [{ weightKg: 18.5 }] },
    });
    const luna = await mkDog({
      owner: { connect: { id: owner.id } }, name: "Luna", breed: { connect: { id: breed["Caniche"] } }, size: "SMALL", coatType: "CURLY", currentWeightKg: 6.2,
      temperament: "DOCILE", toleratesDryer: "YES", toleratesBlower: "YES", allowsNailTrim: "PARTIAL", allowedTreats: "Solo premios sin cereales",
      healthAlerts: { create: [{ type: "RECENT_SURGERY", severity: "WARNING", description: "Esterilizada hace 2 semanas: evitar abdomen", bodyArea: "Abdomen", validUntil: todayAt(0, 0, 20) }] },
    });

    await prisma.groomingRecord.create({
      data: {
        dogId: luna.id, groomerId: laura.staffProfile!.id, performedAt: todayAt(11, 0, -35), servicesDone: ["Corte a tijera", "Corte de uñas"],
        shampoo: "Champú hipoalergénico avena", conditioner: "Acondicionador desenredante", bladeNumber: "7F", combGuide: "13 mm cuerpo, tijera en cabeza",
        cutDescription: "Corte cachorro, orejas redondeadas", behaviorNotes: "Muy tranquila", weightKg: 6.2,
        photos: { create: [
          { dogId: luna.id, kind: "BEFORE", url: "https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=400" },
          { dogId: luna.id, kind: "AFTER", url: "https://images.unsplash.com/photo-1616190264687-b7ebf7aa2eb4?w=400" },
        ] },
      },
    });

    // Bono vendido a Lucía para Toby (mediano)
    await prisma.voucher.create({
      data: { code: "B-DEMO0001", productId: bonoBanos.id, ownerId: owner.id, dogId: toby.id, totalSessions: 6, usedSessions: 2, expiresAt: todayAt(0, 0, 300) },
    });

    // Citas de hoy
    const appt = async (dogId: string, groomerId: string | null, h: number, m: number, services: { id: string; price: number; min: number }[], status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" = "CONFIRMED") => {
      const startsAt = todayAt(h, m);
      const total = services.reduce((s, x) => s + x.min + 10, 0);
      return prisma.appointment.create({
        data: {
          dogId, ownerId: owner.id, groomerId, startsAt, endsAt: new Date(startsAt.getTime() + total * 60_000), status, stage: status === "IN_PROGRESS" ? "BATH" : null,
          estimatedCents: services.reduce((s, x) => s + x.price, 0), createdById: admin.id,
          services: { create: services.map((x) => ({ serviceId: x.id, priceCents: x.price, durationMin: x.min })) },
        },
      });
    };
    await appt(toby.id, laura.staffProfile!.id, 9, 30, [{ id: bano.id, price: 3200, min: 60 }, { id: unas.id, price: 800, min: 10 }], "IN_PROGRESS");
    await appt(luna.id, david.staffProfile!.id, 11, 0, [{ id: tijera.id, price: 4500, min: 105 }]);
    await appt(toby.id, null, 17, 0, [{ id: ozono.id, price: 1500, min: 20 }], "PENDING");
  }

  // Otros clientes para llenar la agenda
  const others = [
    ["Carlos", "Ruiz", "Rocky", "Golden retriever", "LARGE", "DOUBLE", 32, [deslanado], sara, 10, 0],
    ["Elena", "Martín", "Kira", "Schnauzer miniatura", "SMALL", "WIRE", 7.5, [stripping], david, 16, 30],
    ["Jorge", "López", "Bruno", "Terranova", "GIANT", "DOUBLE", 60, [bano], sara, 16, 0],
  ] as const;
  for (const [first, last, dogName, breedName, size, coat, kg, services, groomer, h, m] of others) {
    const email = `${first.toLowerCase()}@cania.test`;
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const u = await prisma.user.create({
      data: { email, firstName: first, lastName: last, phone: "+34 600 000 000", role: "CLIENT", passwordHash, ownerProfile: { create: { loyaltyCard: { create: { cardNumber: `CAN-${first.toUpperCase()}` } } } } },
      include: { ownerProfile: true },
    });
    const dog = await prisma.dog.create({ data: { ownerId: u.ownerProfile!.id, name: dogName, breedId: breed[breedName], size, coatType: coat, currentWeightKg: kg, temperament: dogName === "Rocky" ? "REACTIVE" : "DOCILE", needsMuzzle: dogName === "Rocky" } });
    const startsAt = todayAt(h, m);
    const dur = services.reduce((s, x) => s + x.baseDurationMin + x.bufferAfterMin, 0);
    await prisma.appointment.create({
      data: {
        dogId: dog.id, ownerId: u.ownerProfile!.id, groomerId: groomer.staffProfile!.id, startsAt, endsAt: new Date(startsAt.getTime() + dur * 60_000), status: "CONFIRMED",
        estimatedCents: services.reduce((s, x) => s + x.basePriceCents, 0),
        services: { create: services.map((x) => ({ serviceId: x.id, priceCents: x.basePriceCents, durationMin: x.baseDurationMin })) },
      },
    });
  }

  // Descanso de Laura a mediodía de hoy
  const breakStart = todayAt(13, 0);
  if (!(await prisma.timeBlock.findFirst({ where: { staffId: laura.staffProfile!.id, startsAt: breakStart } })))
    await prisma.timeBlock.create({ data: { staffId: laura.staffProfile!.id, type: "BREAK", startsAt: breakStart, endsAt: todayAt(13, 30), reason: "Descanso" } });

  console.log("✅ Seed completado. Entra en http://localhost:3025 con admin@cania.test / cania1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
