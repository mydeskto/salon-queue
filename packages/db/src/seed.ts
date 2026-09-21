import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createDb } from './client';
import {
  chairs,
  employeeServices,
  employees,
  salons,
  services,
  users,
} from './schema';

interface SeedServiceSpec {
  name: string;
  category: string;
  description: string;
  price: string;
  durationMinutes: number;
}

interface SeedEmployeeSpec {
  name: string;
  email: string;
  phone: string;
  shiftStart: string;
  shiftEnd: string;
  specialties: string[];
}

interface SeedSalonSpec {
  name: string;
  address: string;
  phone: string;
  adminEmail: string;
  receptionistEmail: string;
  chairLabels: string[];
  services: SeedServiceSpec[];
  employees: SeedEmployeeSpec[];
}

const DEFAULT_PASSWORD = 'password123';

const SALON_SPECS: SeedSalonSpec[] = [
  {
    name: 'Downtown Cuts',
    address: '12 Market Street, Springfield',
    phone: '+1-555-0100',
    adminEmail: 'admin@downtowncuts.test',
    receptionistEmail: 'reception@downtowncuts.test',
    chairLabels: ['Chair 1', 'Chair 2', 'Chair 3', 'Chair 4'],
    services: [
      {
        name: 'Classic Haircut',
        category: 'Hair',
        description: 'Scissor cut with wash and styling.',
        price: '25.00',
        durationMinutes: 30,
      },
      {
        name: 'Skin Fade',
        category: 'Hair',
        description: 'Clipper fade tapered to the skin.',
        price: '32.00',
        durationMinutes: 45,
      },
      {
        name: 'Beard Trim',
        category: 'Beard',
        description: 'Shape-up, line-up and hot towel finish.',
        price: '15.00',
        durationMinutes: 20,
      },
      {
        name: 'Hot Towel Shave',
        category: 'Beard',
        description: 'Traditional straight razor shave.',
        price: '28.00',
        durationMinutes: 40,
      },
      {
        name: 'Hair Colour',
        category: 'Colour',
        description: 'Full colour application with gloss.',
        price: '70.00',
        durationMinutes: 90,
      },
      {
        name: 'Kids Cut',
        category: 'Hair',
        description: 'Quick cut for under-12s.',
        price: '18.00',
        durationMinutes: 20,
      },
    ],
    employees: [
      {
        name: 'Maya Torres',
        email: 'maya@downtowncuts.test',
        phone: '+1-555-0111',
        shiftStart: '09:00',
        shiftEnd: '18:00',
        specialties: ['Classic Haircut', 'Skin Fade', 'Kids Cut'],
      },
      {
        name: 'Jonas Reed',
        email: 'jonas@downtowncuts.test',
        phone: '+1-555-0112',
        shiftStart: '10:00',
        shiftEnd: '19:00',
        specialties: ['Beard Trim', 'Hot Towel Shave', 'Classic Haircut'],
      },
      {
        name: 'Priya Shah',
        email: 'priya@downtowncuts.test',
        phone: '+1-555-0113',
        shiftStart: '08:00',
        shiftEnd: '17:00',
        specialties: ['Hair Colour', 'Classic Haircut'],
      },
    ],
  },
  {
    name: 'Riverside Salon',
    address: '88 River Road, Springfield',
    phone: '+1-555-0200',
    adminEmail: 'admin@riverside.test',
    receptionistEmail: 'reception@riverside.test',
    chairLabels: ['Station A', 'Station B'],
    services: [
      {
        name: 'Blow Dry',
        category: 'Styling',
        description: 'Wash and blow dry.',
        price: '22.00',
        durationMinutes: 30,
      },
      {
        name: 'Keratin Treatment',
        category: 'Treatment',
        description: 'Smoothing keratin treatment.',
        price: '120.00',
        durationMinutes: 120,
      },
      {
        name: 'Layered Cut',
        category: 'Hair',
        description: 'Layered cut and finish.',
        price: '40.00',
        durationMinutes: 50,
      },
    ],
    employees: [
      {
        name: 'Ana Costa',
        email: 'ana@riverside.test',
        phone: '+1-555-0211',
        shiftStart: '09:00',
        shiftEnd: '17:00',
        specialties: ['Blow Dry', 'Layered Cut'],
      },
      {
        name: 'Ben Okafor',
        email: 'ben@riverside.test',
        phone: '+1-555-0212',
        shiftStart: '11:00',
        shiftEnd: '20:00',
        specialties: ['Keratin Treatment', 'Blow Dry'],
      },
    ],
  },
];

async function main() {
  const { sql, db } = createDb(undefined, 1);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await db.transaction(async (tx) => {
    const superAdminEmail = 'super@salonqueue.test';
    const existingSuper = await tx.query.users.findFirst({
      where: eq(users.email, superAdminEmail),
    });

    const superAdminId =
      existingSuper?.id ??
      (
        await tx
          .insert(users)
          .values({
            name: 'Platform Owner',
            email: superAdminEmail,
            passwordHash,
            role: 'super_admin',
            salonId: null,
          })
          .returning({ id: users.id })
      )[0].id;

    for (const spec of SALON_SPECS) {
      const existingSalon = await tx.query.salons.findFirst({
        where: eq(salons.name, spec.name),
      });
      if (existingSalon) {
        console.log(`Salon "${spec.name}" already seeded, skipping.`);
        continue;
      }

      const [salon] = await tx
        .insert(salons)
        .values({
          name: spec.name,
          address: spec.address,
          phone: spec.phone,
          createdBy: superAdminId,
        })
        .returning();

      await tx.insert(users).values([
        {
          salonId: salon.id,
          name: `${spec.name} Admin`,
          email: spec.adminEmail,
          passwordHash,
          role: 'salon_admin',
        },
        {
          salonId: salon.id,
          name: `${spec.name} Reception`,
          email: spec.receptionistEmail,
          passwordHash,
          role: 'receptionist',
        },
      ]);

      await tx.insert(chairs).values(
        spec.chairLabels.map((label) => ({
          salonId: salon.id,
          label,
        })),
      );

      const insertedServices = await tx
        .insert(services)
        .values(
          spec.services.map((service) => ({
            salonId: salon.id,
            name: service.name,
            description: service.description,
            category: service.category,
            price: service.price,
            durationMinutes: service.durationMinutes,
          })),
        )
        .returning();

      const serviceByName = new Map(insertedServices.map((s) => [s.name, s.id]));

      for (const employeeSpec of spec.employees) {
        const [employeeUser] = await tx
          .insert(users)
          .values({
            salonId: salon.id,
            name: employeeSpec.name,
            email: employeeSpec.email,
            phone: employeeSpec.phone,
            passwordHash,
            role: 'employee',
          })
          .returning();

        const [employee] = await tx
          .insert(employees)
          .values({
            userId: employeeUser.id,
            salonId: salon.id,
            shiftStart: employeeSpec.shiftStart,
            shiftEnd: employeeSpec.shiftEnd,
          })
          .returning();

        const specialtyIds = employeeSpec.specialties
          .map((name) => serviceByName.get(name))
          .filter((id): id is string => Boolean(id));

        if (specialtyIds.length > 0) {
          await tx.insert(employeeServices).values(
            specialtyIds.map((serviceId) => ({
              employeeId: employee.id,
              serviceId,
            })),
          );
        }
      }

      console.log(`Seeded salon "${spec.name}" (${salon.id})`);
    }
  });

  await sql.end();

  console.log('\nDemo logins (password: %s)', DEFAULT_PASSWORD);
  console.log('  super admin   super@salonqueue.test');
  for (const spec of SALON_SPECS) {
    console.log(`  ${spec.name}: ${spec.adminEmail} / ${spec.receptionistEmail}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
